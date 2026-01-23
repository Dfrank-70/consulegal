import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { executeWorkflow } from "@/lib/workflow-executor";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  let logUserId: string = 'unknown';
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    logUserId = userId;

    const prismaAny = prisma as any;

    const user = await prismaAny.user.findUnique({
      where: { id: userId },
      select: { role: true, defaultExpertId: true },
    });

    const effectiveRole = ((user as any)?.role === 'CLIENT' ? 'CUSTOMER' : (user as any)?.role) as string;

    const expertRpm = parseInt(process.env.EXPERT_RPM || '10');
    const rateLimit = checkRateLimit(userId, expertRpm);
    if (!rateLimit.allowed) {
      console.warn(`[REQUEST-EXPERT][RATE_LIMIT] userId=${userId} retryAfterSeconds=${rateLimit.retryAfterSeconds}`);
      return NextResponse.json(
        { error: 'rate_limited', retry_after_seconds: rateLimit.retryAfterSeconds || 60 },
        { status: 429 }
      );
    }

    // 2. Entitlement check (active subscription) - solo CUSTOMER
    if (effectiveRole === 'CUSTOMER') {
      const subscription = await prisma.subscription.findUnique({
        where: { userId }
      });

      const isSubscribed = !!(
        subscription &&
        subscription.currentPeriodEnd &&
        subscription.currentPeriodEnd.getTime() > Date.now()
      );

      if (!isSubscribed) {
        return NextResponse.json(
          { error: "Abbonamento attivo richiesto per richiedere parere esperto" },
          { status: 402 } // Payment Required
        );
      }
    }

    // 3. Parse body
    const body = await req.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId richiesto" },
        { status: 400 }
      );
    }

    // 4. Recupera conversation + verifica ownership
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: userId, // Verifica che appartenga all'utente
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 2, // Ultimi 2 messaggi (user + assistant)
        }
      }
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversazione non trovata o non autorizzato" },
        { status: 404 }
      );
    }

    // 5. Verifica di avere almeno un messaggio utente e uno assistant
    const lastAssistantMessage = conversation.messages.find(m => m.role === 'ASSISTANT');
    const lastUserMessage = conversation.messages.find(m => m.role === 'USER');

    if (!lastUserMessage || !lastAssistantMessage) {
      return NextResponse.json(
        { error: "Conversazione deve contenere almeno una domanda e una risposta AI" },
        { status: 400 }
      );
    }

    // 6. Estrai attachments preview dall'ultimo messaggio utente
    const attachments = lastUserMessage.attachments 
      ? (Array.isArray(lastUserMessage.attachments) ? lastUserMessage.attachments : [lastUserMessage.attachments])
      : [];

    const citationsBlock = extractSourcesBlock(lastAssistantMessage.content);

    const existingCase = await prismaAny.case.findFirst({
      where: {
        userId,
        conversationId,
        status: { in: ['OPEN', 'WAITING_EXPERT'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingCase?.expertPacket) {
      return NextResponse.json(
        {
          success: true,
          caseId: existingCase.id,
          status: existingCase.status,
          reused: true,
        },
        { status: 200 }
      );
    }

    const defaultExpertId = (user as any)?.defaultExpertId ?? null;

    const caseToUse = existingCase
      ? existingCase
      : await prismaAny.case.create({
          data: {
            userId,
            conversationId,
            assignedToId: defaultExpertId,
            status: 'WAITING_EXPERT',
            priority: 'MEDIUM',
            triggeredBy: 'USER_REQUEST',
          }
        });

    if (existingCase && existingCase.assignedToId == null && defaultExpertId) {
      await prismaAny.case.update({
        where: { id: existingCase.id },
        data: { assignedToId: defaultExpertId },
      });
      (caseToUse as any).assignedToId = defaultExpertId;
    }

    const reused = !!existingCase;

    // 9. Costruisci payload per workflow
    const workflowPayload = JSON.stringify({
      conversationId,
      userId,
      caseId: caseToUse.id,
      user_message: lastUserMessage.content,
      ai_draft: lastAssistantMessage.content,
      attachments: attachments.map((att: any) => ({
        filename: att.filename,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        extractedChars: att.extractedChars,
        previewChars: att.previewChars,
        isTruncated: att.isTruncated
      })),
      citations_block: citationsBlock
    }, null, 2);

    // 10. Recupera workflow globale system_expert_packet_v1
    const expertWorkflow = (await prisma.workflow.findMany({
      where: {
        name: 'system_expert_packet_v1',
        userId: null
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    }))[0];

    if (!expertWorkflow) {
      console.error(`[REQUEST-EXPERT][WORKFLOW_NOT_CONFIGURED] userId=${userId} workflow=system_expert_packet_v1`);
      await prismaAny.case.update({
        where: { id: caseToUse.id },
        data: {
          expertPacket: {
            error: 'workflow_not_configured',
            workflow: 'system_expert_packet_v1'
          },
          status: 'OPEN'
        }
      });

      return NextResponse.json(
        { error: 'workflow_not_configured', workflow: 'system_expert_packet_v1' },
        { status: 500 }
      );
    }

    // 11. Esegui workflow per generare expert packet
    let workflowExecution;
    try {
      workflowExecution = await executeWorkflow(
        expertWorkflow.id,
        userId,
        workflowPayload
      );
    } catch (workflowError: any) {
      console.error(`[REQUEST-EXPERT][WORKFLOW_EXECUTION_FAILED] userId=${userId} caseId=${caseToUse.id}`);
      await prismaAny.case.update({
        where: { id: caseToUse.id },
        data: {
          expertPacket: {
            error: 'workflow_execution_failed',
            message: workflowError.message || 'Workflow execution failed'
          },
          status: 'OPEN'
        }
      });

      return NextResponse.json(
        {
          error: "Errore generazione dossier esperto",
          details: workflowError.message,
          caseId: caseToUse.id,
          status: 'OPEN'
        },
        { status: 500 }
      );
    }

    // 12. Estrai output dal workflow e parsifica JSON
    let expertPacketData;
    const workflowOutput = workflowExecution.steps[workflowExecution.steps.length - 1]?.output || '';
    
    try {
      // Prova a parsare come JSON
      expertPacketData = JSON.parse(workflowOutput);
    } catch (parseError) {
      // Se non è JSON valido, salva come string
      expertPacketData = {
        raw_output: workflowOutput,
        parse_error: 'Output non è JSON valido',
        input: JSON.parse(workflowPayload)
      };
    }

    // 13. Salva expert packet e aggiorna status a WAITING_EXPERT
    await prismaAny.case.update({
      where: { id: caseToUse.id },
      data: {
        expertPacket: expertPacketData,
        status: 'WAITING_EXPERT',
      }
    });

    // 14. (Opzionale) Salva anche come CaseMessage per storico
    await prismaAny.caseMessage.create({
      data: {
        caseId: caseToUse.id,
        authorId: null, // SYSTEM
        role: 'SYSTEM',
        content: `Dossier esperto generato automaticamente dal workflow system_expert_packet_v1`,
        meta: {
          workflowId: expertWorkflow.id,
          workflowExecutionId: workflowExecution.workflowId,
          totalTokens: workflowExecution.totalTokensUsed,
          totalCost: workflowExecution.totalCost,
          steps: workflowExecution.steps.length
        }
      }
    });

    // 15. Return success
    return NextResponse.json({
      success: true,
      caseId: caseToUse.id,
      status: 'WAITING_EXPERT',
      ...(reused ? { reused: true } : {})
    }, { status: 200 });

  } catch (error: any) {
    console.error(`[REQUEST-EXPERT][UNHANDLED] userId=${logUserId}`);
    return NextResponse.json(
      { error: "Errore interno del server", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Estrae citazioni RAG dal contenuto AI
 * Cerca pattern come: [Fonte N: filename - Score: X.XXX]
 */
function extractSourcesBlock(content: string): string | null {
  const m = content.match(/(?:^|\n)SOURCES:\s*\n[\s\S]*$/);
  return m ? m[0].trim() : null;
}
