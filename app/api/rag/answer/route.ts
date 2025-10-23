// POST /api/rag/answer - Generate answer with citations

import { NextRequest, NextResponse } from 'next/server';
import { hybridRetrieval } from '@/lib/rag/retrieval';
import { buildSystemPrompt, buildUserPrompt, extractCitations } from '@/lib/rag/prompt';
import prisma from '@/lib/prisma';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Force Node.js runtime and set timeout
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    // Support both old format (nodeId, query) and new format (messages, node_ids, llm, retrieval)
    let nodeIds: string[];
    let query: string;
    let llmConfig: any;
    let retrievalConfig: any;

    if (body.node_ids && body.messages) {
      // New format from admin page
      nodeIds = body.node_ids;
      query = body.messages.find((m: any) => m.role === 'user')?.content || '';
      llmConfig = body.llm || {};
      retrievalConfig = body.retrieval || {};
    } else {
      // Old format for backward compatibility
      nodeIds = [body.nodeId];
      query = body.query;
      llmConfig = {
        provider: body.model?.startsWith('claude') ? 'anthropic' : 'openai',
        model: body.model || 'gpt-4o-mini',
        temperature: body.temperature || 0.1,
        max_tokens: 1000,
      };
      retrievalConfig = {
        hybrid: true,
        top_k: body.topK || 20,
        return_k: body.returnK || 5,
      };
    }

    if (!nodeIds || nodeIds.length === 0 || !query) {
      return NextResponse.json(
        { error: 'node_ids and query are required' },
        { status: 400 }
      );
    }

    // Check OPENAI_API_KEY
    if (llmConfig.provider === 'openai' && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY mancante in configurazione' },
        { status: 500 }
      );
    }

    // Use first node for now (multi-node support can be added later)
    const nodeId = nodeIds[0];

    // Verify node exists
    const node = await prisma.ragNode.findUnique({
      where: { id: nodeId },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!node) {
      return NextResponse.json(
        { error: 'RAG node not found' },
        { status: 404 }
      );
    }

    // Retrieval
    const retrievalStart = Date.now();
    const contexts = await hybridRetrieval(nodeId, query, {
      topK: retrievalConfig.top_k || 20,
      returnK: retrievalConfig.return_k || 5,
      alpha: 0.5,
    });
    const t_retrieval_ms = Date.now() - retrievalStart;

    if (contexts.length === 0) {
      console.log('[RAG ANSWER]', {
        node_ids: nodeIds,
        query: query.substring(0, 100),
        contexts: 0,
        t_total_ms: Date.now() - startTime,
        t_retrieval_ms,
      });

      return NextResponse.json({
        answer: 'Non ho trovato documenti rilevanti per rispondere alla tua domanda. Assicurati di aver caricato i documenti necessari nel nodo RAG.',
        citations: [],
        contexts: [],
        telemetry: {
          t_total_ms: Date.now() - startTime,
          t_retrieval_ms,
          t_llm_ms: 0,
        },
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      }, { status: 200 });
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(query, contexts);

    // Call LLM
    const llmStart = Date.now();
    let answer: string;
    let usage: any;

    if (llmConfig.provider === 'openai') {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: llmConfig.model || 'gpt-4o-mini',
        temperature: llmConfig.temperature || 0.2,
        max_tokens: llmConfig.max_tokens || 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      answer = response.choices[0]?.message?.content || 'Nessuna risposta generata.';
      usage = {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      };
    } else if (llmConfig.provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: llmConfig.model || 'claude-3-5-sonnet-20241022',
        max_tokens: llmConfig.max_tokens || 400,
        temperature: llmConfig.temperature || 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      answer = response.content[0]?.type === 'text' ? response.content[0].text : 'Nessuna risposta generata.';
      usage = {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      };
    } else {
      throw new Error(`Unsupported provider: ${llmConfig.provider}`);
    }

    const t_llm_ms = Date.now() - llmStart;
    const t_total_ms = Date.now() - startTime;

    // Extract citations
    const citations = extractCitations(answer, contexts);

    console.log('[RAG ANSWER]', {
      node_ids: nodeIds,
      query: query.substring(0, 100),
      contexts: contexts.length,
      citations: citations.length,
      t_total_ms,
      t_retrieval_ms,
      t_llm_ms,
    });

    return NextResponse.json({
      answer,
      citations,
      contexts: contexts.map(ctx => ({
        chunk_id: ctx.chunkId,
        document_id: ctx.documentId,
        filename: ctx.filename,
        content: ctx.content,
        score: ctx.score,
      })),
      telemetry: {
        t_total_ms,
        t_retrieval_ms,
        t_llm_ms,
      },
      usage,
    }, { status: 200 });

  } catch (error) {
    console.error('[RAG ANSWER]', 'Error:', error);
    return NextResponse.json(
      { error: `Failed to generate answer: ${error}` },
      { status: 500 }
    );
  }
}
