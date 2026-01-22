import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildDefaultSummarySchemaMeta(messageCount: number) {
  return {
    generated_at: new Date().toISOString(),
    instruction_version: 'v1',
    input_message_count: messageCount,
  };
}

function buildInputFromConversationMessages(messages: Array<{ role: string; content: string; createdAt: Date; attachments?: any; meta?: any }>): string {
  const lines: string[] = [];
  lines.push('CHAT (ordine cronologico):');
  for (const m of messages) {
    const authorType = (m.meta as any)?.authorType;
    const roleLabel = authorType === 'expert' ? 'EXPERT' : m.role;

    lines.push(`\n--- ${roleLabel} @ ${new Date(m.createdAt).toISOString()} ---`);
    lines.push(m.content || '');

    const atts = m.attachments;
    if (atts) {
      lines.push('\n[ATTACHMENTS METADATA]');
      lines.push(JSON.stringify(atts, null, 2));
    }
  }
  return lines.join('\n');
}

async function getActiveConfig() {
  const existing = await prisma.expertAssistantConfig.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return existing;
}

async function getProviderApiKey(provider: string): Promise<{ providerName: 'OpenAI' | 'Claude'; apiKey: string } | null> {
  const normalized = provider.toLowerCase();
  const desiredName = normalized === 'claude' ? 'Claude' : 'OpenAI';

  const p = await prisma.lLMProvider.findFirst({
    where: { name: desiredName },
    select: { apiKey: true, isActive: true },
  });

  if (p?.isActive && p.apiKey) {
    return { providerName: desiredName as any, apiKey: p.apiKey };
  }

  if (desiredName === 'OpenAI' && process.env.OPENAI_API_KEY) {
    return { providerName: 'OpenAI', apiKey: process.env.OPENAI_API_KEY };
  }

  if (desiredName === 'Claude' && process.env.ANTHROPIC_API_KEY) {
    return { providerName: 'Claude', apiKey: process.env.ANTHROPIC_API_KEY };
  }

  return null;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: requestId } = await ctx.params;
  let logUserId = 'unknown';

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    if (!['EXPERT', 'ADMIN'].includes(session.user.role as any)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    logUserId = session.user.id;
    console.log(`[EXPERT_SUMMARY][REQUEST] requestId=${requestId} userId=${session.user.id}`);

    const found = await (prisma as any).case.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        userId: true,
        assignedToId: true,
        conversationId: true,
        conversation: {
          select: {
            id: true,
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                role: true,
                content: true,
                createdAt: true,
                attachments: true,
                meta: true,
              },
            },
          },
        },
      },
    });

    if (!found) {
      return NextResponse.json({ error: 'Case non trovato' }, { status: 404 });
    }

    if (session.user.role === 'EXPERT' && found.assignedToId !== session.user.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const config = await getActiveConfig();
    if (!config?.customInstruction) {
      return NextResponse.json({ error: 'ExpertAssistantConfig non configurato' }, { status: 500 });
    }

    const apiKeyInfo = await getProviderApiKey(config.provider);
    if (!apiKeyInfo) {
      return NextResponse.json({ error: 'Provider non configurato o API key mancante' }, { status: 500 });
    }

    const conversationMessages = (found.conversation?.messages || []) as Array<any>;
    const input = buildInputFromConversationMessages(conversationMessages);

    const outputSchemaInstruction = `\n\nDevi restituire SOLO un JSON valido con questa struttura (nessun markdown, nessun testo extra):\n{\n  \"summary\": \"...\",\n  \"key_points\": [\"...\"],\n  \"open_questions\": [\"...\"],\n  \"assumptions\": [\"...\"],\n  \"risk_flags\": [{ \"level\": \"low|medium|high\", \"text\": \"...\" }],\n  \"draft_opinion\": \"...\",\n  \"notes_for_expert\": [\"...\"],\n  \"meta\": {\n    \"generated_at\": \"ISO-8601\",\n    \"instruction_version\": \"v1\",\n    \"input_message_count\": 0\n  }\n}`;

    const systemPrompt = config.customInstruction + outputSchemaInstruction;

    let rawText = '';

    if (apiKeyInfo.providerName === 'OpenAI') {
      const openai = new OpenAI({ apiKey: apiKeyInfo.apiKey });
      const completion = await openai.chat.completions.create({
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
        temperature: 0.2,
        max_tokens: config.maxOutputTokens || 800,
      });
      rawText = completion.choices?.[0]?.message?.content || '';
    } else {
      const anthropic = new Anthropic({ apiKey: apiKeyInfo.apiKey });
      const response = await anthropic.messages.create({
        model: config.model || 'claude-3-haiku-20240307',
        max_tokens: config.maxOutputTokens || 800,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content: input }],
      });
      rawText = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }

    const parsed = safeJsonParse(rawText);

    const expertSummary = parsed || {
      raw_output: rawText,
      parse_error: 'Output non è JSON valido',
      meta: buildDefaultSummarySchemaMeta(conversationMessages.length),
    };

    if (expertSummary?.meta && typeof expertSummary.meta === 'object') {
      expertSummary.meta.generated_at = expertSummary.meta.generated_at || new Date().toISOString();
      expertSummary.meta.instruction_version = expertSummary.meta.instruction_version || 'v1';
      expertSummary.meta.input_message_count = expertSummary.meta.input_message_count ?? conversationMessages.length;
    } else {
      expertSummary.meta = buildDefaultSummarySchemaMeta(conversationMessages.length);
    }

    const updated = await (prisma as any).case.update({
      where: { id: requestId },
      data: {
        expertSummary,
        expertSummaryProvider: config.provider,
        expertSummaryModel: config.model,
        expertSummaryCreatedAt: new Date(),
      },
      select: {
        id: true,
        expertSummary: true,
        expertSummaryProvider: true,
        expertSummaryModel: true,
        expertSummaryCreatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(`[EXPERT_SUMMARY][ERROR] requestId=${requestId} userId=${logUserId} msg=${error?.message}`);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
