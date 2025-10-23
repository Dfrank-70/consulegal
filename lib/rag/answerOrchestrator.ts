// RAG Answer Orchestrator - End-to-end pipeline

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { hybridRetrieval } from './retrieval';
import { buildSystemPrompt, buildUserPrompt, extractCitations } from './prompt';
import { AnswerResponse, RetrievedContext } from './types';
import { calculateCost } from '@/lib/llm-costs';

export interface AnswerConfig {
  nodeId: string;
  query: string;
  topK?: number;
  returnK?: number;
  temperature?: number;
  model?: string;
  provider?: 'openai' | 'anthropic';
}

/**
 * Main orchestrator function for RAG answer generation
 */
export async function generateAnswer(config: AnswerConfig): Promise<AnswerResponse> {
  const startTime = Date.now();
  const {
    nodeId,
    query,
    topK = 20,
    returnK = 5,
    temperature = 0.1, // Low temperature for factual responses
    model = 'gpt-4o-mini',
    provider = 'openai',
  } = config;

  console.log(JSON.stringify({
    event: 'rag_answer_start',
    nodeId,
    query: query.substring(0, 100),
    model,
    provider,
  }));

  // Step 1: Retrieval
  const retrievalStart = Date.now();
  const contexts = await hybridRetrieval(nodeId, query, { topK, returnK });
  const tRetrievalMs = Date.now() - retrievalStart;

  if (contexts.length === 0) {
    return {
      answer: 'Non ho trovato documenti rilevanti per rispondere alla tua domanda. Assicurati di aver caricato i documenti necessari nel nodo RAG.',
      citations: [],
      rawContexts: [],
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      telemetry: {
        tTotalMs: Date.now() - startTime,
        tRetrievalMs,
        tLlmMs: 0,
      },
    };
  }

  // Step 2: Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(query, contexts);

  // Step 3: Call LLM
  const llmStart = Date.now();
  let answer: string;
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number; cost?: number };

  if (provider === 'openai') {
    const result = await callOpenAI(systemPrompt, userPrompt, model, temperature);
    answer = result.answer;
    usage = result.usage;
  } else if (provider === 'anthropic') {
    const result = await callAnthropic(systemPrompt, userPrompt, model, temperature);
    answer = result.answer;
    usage = result.usage;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const tLlmMs = Date.now() - llmStart;

  // Step 4: Extract citations
  const citations = extractCitations(answer, contexts);

  const tTotalMs = Date.now() - startTime;

  console.log(JSON.stringify({
    event: 'rag_answer_complete',
    nodeId,
    contextsUsed: contexts.length,
    citationsExtracted: citations.length,
    answerLength: answer.length,
    telemetry: {
      tTotalMs,
      tRetrievalMs,
      tLlmMs,
    },
    usage,
  }));

  return {
    answer,
    citations,
    rawContexts: contexts.map(ctx => ({
      chunkId: ctx.chunkId,
      documentId: ctx.documentId,
      filename: ctx.filename,
      content: ctx.content,
      score: ctx.score,
      metadata: ctx.metadata,
    })),
    usage,
    telemetry: {
      tTotalMs,
      tRetrievalMs,
      tLlmMs,
    },
  };
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number
): Promise<{ answer: string; usage: any }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const answer = response.choices[0]?.message?.content || 'Nessuna risposta generata.';
  const usage = {
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
    cost: calculateCost(
      'openai',
      model,
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0
    ),
  };

  return { answer, usage };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number
): Promise<{ answer: string; usage: any }> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: model.startsWith('claude') ? model : 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    temperature,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const answer = response.content[0]?.type === 'text' 
    ? response.content[0].text 
    : 'Nessuna risposta generata.';

  const usage = {
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    cost: calculateCost(
      'anthropic',
      model,
      response.usage.input_tokens,
      response.usage.output_tokens
    ),
  };

  return { answer, usage };
}
