import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "../../../auth";
import { OpenAI } from "openai";
import mammoth from "mammoth";
import { executeWorkflow, getWorkflowFinalOutput } from "@/lib/workflow-executor";
import { stripe } from "@/lib/stripe";
import { checkSubscriptionEntitlement } from "@/lib/entitlement";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { estimateChatInputTokens, checkTokenLimit } from "@/lib/token-estimator";

// Configurazione rimossa - usiamo le API native di Next.js

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: OPENAI_API_KEY non è configurata sul server.");
    throw new Error("Configurazione del server incompleta per la funzionalità AI.");
  }
  return new OpenAI({ apiKey });
};

// Helper function to count tokens (semplice approssimazione)
function countTokens(text: string): number {
  // Una stima semplificata: circa 4 caratteri = 1 token
  return Math.ceil(text.length / 4);
}

// Funzione per generare il messaggio di sistema per l'AI (rimossa - usa system semplice)

function cleanExtractedText(text: string): string {
  return text
    .split('\n')
    .filter(line => line.trim() !== '') // Rimuove righe vuote
    .join('\n')
    .trim();
}

function appendSourcesDelimiterIfPresent(text: string): string {
  if (!text) return text;
  if (/\nSOURCES:\s*\n/.test(text)) return text;
  if (/\[Fonte\s+\d+:/i.test(text)) {
    return `${text}\n\nSOURCES:\n- [RAG] (fonti presenti nella risposta sopra)`;
  }
  return text;
}

interface FileExtractionResult {
  text: string;
  metadata: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    extractedChars: number;
    uploadedAt: string;
  };
}

async function extractTextFromFile(file: File): Promise<FileExtractionResult> {
  const fileName = file.name || 'file sconosciuto';
  const fileType = file.type;
  const fileSize = file.size;

  console.log(`[FILE EXTRACT] Processing: ${fileName}, MIME: ${fileType}, Size: ${fileSize} bytes`);

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  let extractedText = "";

  try {
    if (fileType === "application/pdf" || fileName.toLowerCase().endsWith('.pdf')) {
      console.log("[PDF] Parsing with pdf-parse...");
      // pdf-parse is a CommonJS module, need to access default export
      const pdfParseModule = await import("pdf-parse");
      const pdfParse =
        (pdfParseModule as any).pdf ||
        (pdfParseModule as any).default ||
        (pdfParseModule as any).PDFParse ||
        (pdfParseModule as any);

      if (typeof pdfParse !== 'function') {
        throw new Error('PDF_PARSER_INVALID_EXPORT');
      }

      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text;
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(`PDF "${fileName}" non contiene testo estraibile. Potrebbe essere un'immagine scansionata.`);
      }
      
    } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.toLowerCase().endsWith('.docx')) {
      console.log("[DOCX] Parsing with mammoth...");
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = value;
      
    } else if (fileType === "application/msword" || fileName.toLowerCase().endsWith('.doc')) {
      console.log("[DOC] Parsing with word-extractor...");
      const WordExtractor = (await import("word-extractor")).default;
      const extractor = new WordExtractor();
      
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      
      const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}.doc`);
      fs.writeFileSync(tempFilePath, fileBuffer);
      
      try {
        const extracted = await extractor.extract(tempFilePath);
        extractedText = extracted.getBody();
      } finally {
        fs.unlinkSync(tempFilePath);
      }
      
    } else if (fileType === "text/plain" || fileName.toLowerCase().endsWith('.txt')) {
      console.log("[TXT] Parsing as UTF-8 text...");
      extractedText = fileBuffer.toString('utf-8');
      
    } else {
      console.error(`[UNSUPPORTED] MIME: ${fileType}`);
      throw new Error(`UNSUPPORTED_FILE_TYPE:${fileType}`);
    }

    const cleanedText = cleanExtractedText(extractedText);
    console.log(`[FILE EXTRACT] Success: ${cleanedText.length} chars (original: ${extractedText.length})`);
    
    return {
      text: cleanedText,
      metadata: {
        filename: fileName,
        mimeType: fileType,
        sizeBytes: fileSize,
        extractedChars: cleanedText.length,
        uploadedAt: new Date().toISOString()
      }
    };
    
  } catch (error: any) {
    console.error(`[FILE EXTRACT] Error processing ${fileName}:`, error);
    
    if (error.message?.startsWith('UNSUPPORTED_FILE_TYPE:')) {
      const mimeType = error.message.split(':')[1];
      throw { code: 'unsupported_file_type', mimeType, filename: fileName };
    }
    
    throw { code: 'file_parse_failed', filename: fileName, details: error.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const userId = session.user.id as string;

    // RATE LIMITING: Check requests per minute
    const rateLimitIdentifier = userId || getClientIP(req.headers);
    const rateLimit = checkRateLimit(rateLimitIdentifier);
    
    if (!rateLimit.allowed) {
      console.log(`🚫 Rate limit exceeded for ${userId || 'IP:' + rateLimitIdentifier}`);
      return NextResponse.json(
        { 
          error: 'rate_limited', 
          retry_after_seconds: rateLimit.retryAfterSeconds 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds || 60)
          }
        }
      );
    }

    // --- FETCH USER + SUBSCRIPTION (before expensive operations) ---
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        workflow: {
          include: {
            nodes: true,
            edges: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }
    if (user.isBlocked) {
      return NextResponse.json(
        { error: "Il tuo account è stato bloccato. Contatta l'amministratore." },
        { status: 403 }
      );
    }

    const effectiveRole = ((user as any).role === 'CLIENT' ? 'CUSTOMER' : (user as any).role) as string;

    // ENTITLEMENT CHECK: solo per CUSTOMER
    if (effectiveRole === 'CUSTOMER') {
      const entitlement = checkSubscriptionEntitlement(user.subscription);
      
      if (!entitlement.entitled) {
        console.log(`🚫 Access denied for user ${userId}: ${entitlement.reason}`);
        return NextResponse.json(
          { 
            error: 'subscription_inactive', 
            reason: entitlement.reason,
            action: 'subscribe'
          },
          { status: 402 }
        );
      }
    }

    // --- PARSE FORM DATA (after entitlement check) ---
    const formData = await req.formData();
    const message = formData.get("message") as string || "";
    let conversationId = formData.get("conversationId") as string || null;
    const file = formData.get("file") as File | null;

    if (!message && !file) {
      return NextResponse.json(
        { error: "È richiesto un messaggio o un file." },
        { status: 400 }
      );
    }

    // FILE SIZE CHECK: Usa limiti dal piano utente
    if (file) {
      const maxFileBytes = user.subscription?.maxFileBytes || parseInt(process.env.MAX_FILE_BYTES || '1048576'); // 1MB default
      if (file.size > maxFileBytes) {
        console.log(`🚫 File too large for user ${userId}: ${file.size} bytes (max: ${maxFileBytes})`);
        return NextResponse.json(
          { 
            error: 'file_too_large',
            message: `File troppo grande (${(file.size / 1024 / 1024).toFixed(1)}MB / max ${(maxFileBytes / 1024 / 1024).toFixed(1)}MB)`,
            suggestion: 'Per documenti grandi, usa la funzione "Knowledge Base" per analisi approfondita.',
            max_file_bytes: maxFileBytes,
            file_bytes: file.size
          },
          { status: 413 }
        );
      }
    }
    
    // Extract file content for token estimation
    let fileContentPreview = "";
    let fileExtractionResult: FileExtractionResult | null = null;
    
    if (file) {
      try {
        fileExtractionResult = await extractTextFromFile(file);
        const attachmentMaxChars = user.subscription?.maxAttachmentChars || parseInt(process.env.ATTACHMENT_MAX_CHARS || '25000'); // 25K default
        fileContentPreview =
          fileExtractionResult.text.length > attachmentMaxChars
            ? fileExtractionResult.text.substring(0, attachmentMaxChars) + '\n\n[...contenuto troncato...]'
            : fileExtractionResult.text;
      } catch (error: any) {
        console.error(`[FILE EXTRACT] Failed:`, error);
        
        if (error.code === 'unsupported_file_type') {
          return NextResponse.json(
            { 
              error: 'unsupported_file_type',
              mimeType: error.mimeType,
              filename: error.filename,
              supported_types: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain']
            },
            { status: 400 }
          );
        }
        
        if (error.code === 'file_parse_failed') {
          return NextResponse.json(
            { 
              error: 'file_parse_failed',
              filename: error.filename,
              details: error.details
            },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { error: 'file_processing_error', details: error.message || 'Unknown error' },
          { status: 500 }
        );
      }
    }

    // TOKEN LIMIT: Check input size before LLM call
    const estimatedInputTokens = estimateChatInputTokens(
      message,
      "You are a helpful legal assistant.",
      fileContentPreview
    );
    
    const tokenLimitCheck = checkTokenLimit(estimatedInputTokens);
    
    if (!tokenLimitCheck.withinLimit) {
      console.log(`🚫 Input too large for user ${userId}: ${estimatedInputTokens} tokens (max: ${tokenLimitCheck.maxTokens})`);
      return NextResponse.json(
        { 
          error: 'input_too_large', 
          max_input_tokens: tokenLimitCheck.maxTokens,
          estimated_tokens: estimatedInputTokens
        },
        { status: 413 }
      );
    }

    // Subscription attiva: solo per CUSTOMER. Per EXPERT/ADMIN non è richiesta.
    let subscription = user.subscription;
    let isSubscribed = effectiveRole === 'CUSTOMER';

    // Fallback: Se subscription mancante ma user ha stripeCustomerId, sincronizza
    if (!subscription && user.stripeCustomerId) {
      console.log(`🔄 Utente ${user.email} non ha abbonamento attivo nel DB, controllo Stripe...`);
      try {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
          limit: 1
        });

        if (stripeSubscriptions.data.length > 0) {
          const stripeSub = stripeSubscriptions.data[0];
          console.log(`✅ Trovata subscription attiva su Stripe: ${stripeSub.id}`);

          // Sincronizza nel DB
          subscription = await prisma.subscription.upsert({
            where: { userId: userId },
            create: {
              userId: userId,
              stripeSubscriptionId: stripeSub.id,
              stripePriceId: stripeSub.items.data[0].price.id,
              stripeProductId: stripeSub.items.data[0].price.product as string,
              status: stripeSub.status,
              currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
              currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end || false,
              tokenLimit: 10000, // Default per piano intermedio
            },
            update: {
              stripeSubscriptionId: stripeSub.id,
              stripePriceId: stripeSub.items.data[0].price.id,
              stripeProductId: stripeSub.items.data[0].price.product as string,
              status: stripeSub.status,
              currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
              currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end || false,
              tokenLimit: 10000,
            }
          });

          isSubscribed = !!(
            subscription &&
            subscription.currentPeriodEnd &&
            subscription.currentPeriodEnd.getTime() > Date.now()
          );

          console.log(`✅ Abbonamento sincronizzato per ${user.email}, attivo: ${isSubscribed}`);
        }
      } catch (error) {
        console.error(`❌ Errore sincronizzazione Stripe per ${user.email}:`, error);
      }
    }

    if (isSubscribed) {
      if (process.env.DRY_RUN_LLM === 'true') {
        // no-op
      } else if (process.env.DISABLE_DAILY_TOKEN_LIMIT !== 'true') {
        const dailyTokenLimit = parseInt(
          process.env.DAILY_TOKEN_LIMIT || String(subscription!.tokenLimit || 10000)
        );

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const usageAggregation = await prisma.tokenUsage.aggregate({
          _sum: {
            tokensUsed: true,
          },
          where: {
            userId: userId,
            date: { gte: todayStart, lte: todayEnd },
          },
        });
        const totalTokensUsedToday = usageAggregation._sum.tokensUsed || 0;

        if (totalTokensUsedToday >= dailyTokenLimit) {
          return NextResponse.json(
            { error: `Hai raggiunto il limite giornaliero di ${dailyTokenLimit.toLocaleString('it-IT')} token. Potrai utilizzare nuovamente il servizio domani o contattare l'assistenza per un upgrade.` },
            { status: 429 } // Too Many Requests
          );
        }
      }
    } else {
      // Se l'abbonamento non esiste o non è attivo, blocca la richiesta
      return NextResponse.json(
        { error: "Nessun abbonamento attivo trovato. Per favore, sottoscrivi un piano." },
        { status: 403 } // Forbidden
      );
    }

    // --- FINE BLOCCO DI VALIDAZIONE ---
    
    // Determina quale workflow utilizzare
    let workflowToUse = user.workflow;

    if (workflowToUse?.name?.startsWith('system_')) {
      workflowToUse = null;
    }
    
    // Se l'utente non ha un workflow assegnato, usa quello di default
    if (!workflowToUse) {
      workflowToUse = await prisma.workflow.findFirst({
        where: { isDefault: true, name: { not: { startsWith: 'system_' } } },
        include: {
          nodes: true,
          edges: true,
        },
      });
    }

    // Se non c'è nemmeno un workflow di default, usa la logica legacy
    const useWorkflow = workflowToUse && workflowToUse.nodes.length > 0;

    // Create or get conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });
      
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversazione non trovata" },
          { status: 404 }
        );
      }

      if ((conversation as any).workflowId) {
        const conversationWorkflow = await prisma.workflow.findUnique({
          where: { id: (conversation as any).workflowId },
          select: { name: true },
        });

        if (conversationWorkflow?.name?.startsWith('system_')) {
          conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: { workflowId: null },
          });
        }
      }
    } else {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: `Consulenza ${new Date().toLocaleDateString("it-IT")}`,
          workflowId: workflowToUse?.id || null,
        },
      });
    }
    
    let fullMessage = message;
    let attachmentContext = "";
    let attachmentMeta: any = null;
    
    if (file && fileExtractionResult) {
      const ATTACHMENT_MAX_CHARS = parseInt(process.env.ATTACHMENT_MAX_CHARS || '12000');
      
      // Limita preview per evitare overflow token
      const preview = fileExtractionResult.text.length > ATTACHMENT_MAX_CHARS
        ? fileExtractionResult.text.substring(0, ATTACHMENT_MAX_CHARS) + '\n\n[...contenuto troncato...]'
        : fileExtractionResult.text;
      
      attachmentContext = preview;
      attachmentMeta = {
        ...fileExtractionResult.metadata,
        previewChars: preview.length,
        isTruncated: fileExtractionResult.text.length > ATTACHMENT_MAX_CHARS
      };
      
      // Costruisci prompt strutturato distinguendo allegato da fonti RAG
      fullMessage = `${message}

--- DOCUMENTO ALLEGATO DALL'UTENTE ---
File: ${file.name}
Contenuto:
${attachmentContext}
--- FINE DOCUMENTO ALLEGATO ---`;
      
      console.log(`[ATTACHMENT] Preview: ${preview.length} chars (original: ${fileExtractionResult.text.length}, truncated: ${attachmentMeta.isTruncated})`);
    }

    // Count tokens for user message
    const tokensIn = countTokens(fullMessage);
    
    // Save user message to database with attachment metadata
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: fullMessage,
        tokensIn,
        attachments: attachmentMeta ? [attachmentMeta] : undefined,
      },
    });
    
    let content: string;
    let tokensOut: number;
    let totalTokens: number;
    let executionDetails: any = null;

    if (useWorkflow && workflowToUse) {
      // Esegui il workflow
      console.log(`Eseguendo workflow: ${workflowToUse.name} (ID: ${workflowToUse.id})`);
      
      const workflowExecution = await executeWorkflow(workflowToUse.id, userId, fullMessage);
      
      if (workflowExecution.success) {
        content = getWorkflowFinalOutput(workflowExecution);
        tokensOut = workflowExecution.totalTokensUsed;
        totalTokens = workflowExecution.totalTokensUsed;
        executionDetails = {
          workflowId: workflowToUse.id,
          workflowName: workflowToUse.name,
          steps: workflowExecution.steps.length,
          totalCost: workflowExecution.totalCost,
        };
      } else {
        content = `Errore nell'esecuzione del workflow: ${workflowExecution.error}`;
        tokensOut = countTokens(content);
        totalTokens = tokensOut;
      }
    } else {
      // Fallback alla logica legacy se non c'è workflow
      console.log("Nessun workflow configurato, usando logica legacy");
      
      // Prepare conversation history for context
      const messageHistory = await prisma.message.findMany({
        where: {
          conversationId: conversation.id,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 10, // Limit recent messages to avoid token limit
      });

      // Format messages for OpenAI API
      const messages = messageHistory.map((msg: any) => ({
        role: msg.role === "USER" ? "user" : "assistant",
        content: msg.content,
      }));

      const systemMessage = { role: "system", content: "Sei Traspolegal, un assistente legale virtuale." };

      const openaiClient = getOpenAIClient();
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-3.5-turbo", // Usa il modello specificato
        messages: [
          systemMessage as any,
          ...messages as any,
        ],
        temperature: 0.7,
        max_tokens: 1000, // Limita il numero di token nell'output
      });

      content = completion.choices[0].message.content || "Mi dispiace, non sono stato in grado di generare una risposta.";
      content = appendSourcesDelimiterIfPresent(content);

      // Count tokens for assistant message
      tokensOut = completion.usage?.completion_tokens || countTokens(content);

      totalTokens = messages.reduce((acc: number, msg: any) => acc + countTokens(msg.content || ""), 0);
    }

    content = appendSourcesDelimiterIfPresent(content);

    // Save assistant message to database
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content,
        tokensOut,
        tokensIn: totalTokens,
        llmProvider: "OpenAI",
      },
    });

    if (process.env.DRY_RUN_LLM !== 'true') {
      // Track token usage
      await prisma.tokenUsage.create({
        data: {
          userId,
          tokensUsed: tokensIn + tokensOut,
          cost: ((tokensIn / 1000) * 0.0015) + ((tokensOut / 1000) * 0.002), // Stima dei costi
        },
      });
    }
    
    return NextResponse.json({
      content,
      messageId: assistantMessage.id,
      userMessageId: userMessage.id,
      conversationId: conversation.id,
      title: conversation.title,
      tokensIn: tokensIn,
      tokensOut: tokensOut,
      llmProvider: useWorkflow ? "Workflow" : "OpenAI",
      allowExpertEscalation: !!(workflowToUse as any)?.allowExpertEscalation,
      pendingExpertCaseStatus: ((prisma as any).case?.findFirst
        ? await (prisma as any).case.findFirst({
            where: {
              userId,
              conversationId: conversation.id,
              status: { in: ['OPEN', 'WAITING_EXPERT'] },
            },
            orderBy: { createdAt: 'desc' },
            select: { status: true },
          })
        : null)?.status ?? null,
      ...(executionDetails && { workflowExecution: executionDetails }),
    });
    
  } catch (error: any) {
    // Log a more detailed error message
    console.error("--- ERRORE DETTAGLIATO NELL'API CHAT ---");
    console.error("Timestamp:", new Date().toISOString());
    if (error instanceof OpenAI.APIError) {
      console.error("Errore OpenAI:", error.message);
      console.error("Status Code:", error.status);
      console.error("Tipo Errore:", error.type);
    } else {
      console.error("Errore Generico:", error.message);
    }
    console.error("Stack Trace:", error.stack);
    console.error("--- FINE ERRORE DETTAGLIATO ---");
    
    // Return a more informative error in the response (for development)
    return NextResponse.json(
      { 
        error: "Si è verificato un errore durante l'elaborazione della richiesta.",
        details: error.message || "Nessun dettaglio aggiuntivo disponibile."
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const userId = session.user.id as string;

    const conversationId = req.nextUrl.searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Il parametro conversationId è richiesto" },
        { status: 400 }
      );
    }

    // Verify the conversation exists and belongs to the user
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: userId,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversazione non trovata o non autorizzata" },
        { status: 404 }
      );
    }

    let workflowToUse: any = null;

    if ((conversation as any).workflowId) {
      workflowToUse = await prisma.workflow.findUnique({
        where: { id: (conversation as any).workflowId },
      });

      if (workflowToUse?.name?.startsWith('system_')) {
        workflowToUse = null;
      }
    }

    if (!workflowToUse) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { workflow: true },
      });

      workflowToUse = user?.workflow;

      if (workflowToUse?.name?.startsWith('system_')) {
        workflowToUse = null;
      }

      if (!workflowToUse) {
        workflowToUse = await prisma.workflow.findFirst({
          where: { isDefault: true, name: { not: { startsWith: 'system_' } } },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    const allowExpertEscalation = !!(workflowToUse as any)?.allowExpertEscalation;

    const pendingExpertCase = (prisma as any).case?.findFirst
      ? await (prisma as any).case.findFirst({
          where: {
            userId,
            conversationId,
            status: { in: ['OPEN', 'WAITING_EXPERT'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { status: true },
        })
      : null;

    const pendingExpertCaseStatus = pendingExpertCase?.status ?? null;

    // Fetch messages for the validated conversation
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({
      messages,
      allowExpertEscalation,
      pendingExpertCaseStatus: pendingExpertCase?.status ?? null,
    });

  } catch (error: any) {
    console.error("--- ERRORE DETTAGLIATO NEL GET /api/chat ---");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Errore:", error.message);
    console.error("Stack Trace:", error.stack);
    console.error("--- FINE ERRORE DETTAGLIATO ---");
    
    return NextResponse.json(
      { 
        error: "Si è verificato un errore durante il recupero dei messaggi.",
        details: error.message || "Nessun dettaglio aggiuntivo disponibile."
      },
      { status: 500 }
    );
  }
}
