// POST /api/rag/query - Retrieve relevant contexts

import { NextRequest, NextResponse } from 'next/server';
import { hybridRetrieval } from '@/lib/rag/retrieval';
import { QueryRequest, QueryResponse } from '@/lib/rag/types';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: QueryRequest = await request.json();
    const { nodeId, query, topK = 20, returnK = 5, hybridAlpha = 0.5 } = body;

    if (!nodeId || !query) {
      return NextResponse.json(
        { error: 'nodeId and query are required' },
        { status: 400 }
      );
    }

    // Verify node exists
    const node = await prisma.ragNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return NextResponse.json(
        { error: 'RAG node not found' },
        { status: 404 }
      );
    }

    // Perform retrieval
    const contexts = await hybridRetrieval(nodeId, query, {
      topK,
      returnK,
      alpha: hybridAlpha,
    });

    const retrievalTimeMs = Date.now() - startTime;

    const response: QueryResponse = {
      contexts: contexts.map((ctx) => ({
        chunkId: ctx.chunkId,
        documentId: ctx.documentId,
        filename: ctx.filename,
        content: ctx.content,
        score: ctx.score,
        metadata: ctx.metadata,
      })),
      retrievalTimeMs,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error querying RAG:', error);
    return NextResponse.json(
      { error: `Failed to query RAG: ${error}` },
      { status: 500 }
    );
  }
}
