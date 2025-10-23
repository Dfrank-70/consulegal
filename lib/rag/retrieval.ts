// Hybrid Retrieval: pg_trgm (text search) + pgvector (semantic search)

import prisma from '@/lib/prisma';
import { getEmbeddingsAdapter } from './embeddings';
import { HybridRetrievalConfig, RetrievalResult } from './types';

/**
 * Perform hybrid retrieval combining text search and vector similarity
 */
export async function hybridRetrieval(
  nodeId: string,
  query: string,
  config: Partial<HybridRetrievalConfig> = {}
): Promise<RetrievalResult[]> {
  const {
    topK = 20,
    returnK = 5,
    alpha = 0.5, // 0 = full text, 1 = full vector, 0.5 = balanced
  } = config;

  const startTime = Date.now();

  // Generate query embedding
  const embeddingsAdapter = getEmbeddingsAdapter();
  const queryEmbedding = await embeddingsAdapter.embedSingle(query);
  const embeddingTime = Date.now() - startTime;

  // Convert embedding to Postgres vector format
  const vectorString = `[${queryEmbedding.join(',')}]`;

  // Perform hybrid search using raw SQL
  const results = await prisma.$queryRawUnsafe<any[]>(`
    WITH text_search AS (
      SELECT 
        c.id as chunk_id,
        c."documentId" as document_id,
        c.content,
        c.metadata,
        d.filename,
        SIMILARITY(c.content, $1) as text_score
      FROM rag_chunks c
      INNER JOIN rag_documents d ON c."documentId" = d.id
      WHERE d."nodeId" = $2
        AND c.content % $1
      ORDER BY text_score DESC
      LIMIT $3
    ),
    vector_search AS (
      SELECT 
        c.id as chunk_id,
        c."documentId" as document_id,
        c.content,
        c.metadata,
        d.filename,
        1 - (e.embedding <=> $4::vector) as vector_score
      FROM rag_embeddings e
      INNER JOIN rag_chunks c ON e."chunkId" = c.id
      INNER JOIN rag_documents d ON c."documentId" = d.id
      WHERE d."nodeId" = $2
      ORDER BY e.embedding <=> $4::vector
      LIMIT $3
    ),
    combined AS (
      SELECT 
        chunk_id,
        document_id,
        content,
        metadata,
        filename,
        text_score,
        0 as vector_score
      FROM text_search
      UNION ALL
      SELECT 
        chunk_id,
        document_id,
        content,
        metadata,
        filename,
        0 as text_score,
        vector_score
      FROM vector_search
    )
    SELECT 
      chunk_id,
      document_id,
      content,
      metadata,
      filename,
      MAX(text_score) as text_score,
      MAX(vector_score) as vector_score,
      (($5 * MAX(text_score)) + ($6 * MAX(vector_score))) as hybrid_score
    FROM combined
    GROUP BY chunk_id, document_id, content, metadata, filename
    ORDER BY hybrid_score DESC
    LIMIT $7
  `, query, nodeId, topK, vectorString, 1 - alpha, alpha, returnK);

  const retrievalResults: RetrievalResult[] = results.map((row: any) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    filename: row.filename,
    content: row.content,
    score: parseFloat(row.hybrid_score),
    metadata: row.metadata,
  }));

  console.log(JSON.stringify({
    event: 'hybrid_retrieval',
    nodeId,
    query: query.substring(0, 100),
    topK,
    returnK,
    alpha,
    resultsCount: retrievalResults.length,
    embeddingTimeMs: embeddingTime,
    totalTimeMs: Date.now() - startTime,
  }));

  return retrievalResults;
}

/**
 * Perform pure vector search (for comparison/testing)
 */
export async function vectorSearch(
  nodeId: string,
  query: string,
  limit: number = 5
): Promise<RetrievalResult[]> {
  const embeddingsAdapter = getEmbeddingsAdapter();
  const queryEmbedding = await embeddingsAdapter.embedSingle(query);
  const vectorString = `[${queryEmbedding.join(',')}]`;

  const results = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      c.id as chunk_id,
      c."documentId" as document_id,
      c.content,
      c.metadata,
      d.filename,
      1 - (e.embedding <=> $1::vector) as score
    FROM rag_embeddings e
    INNER JOIN rag_chunks c ON e."chunkId" = c.id
    INNER JOIN rag_documents d ON c."documentId" = d.id
    WHERE d."nodeId" = $2
    ORDER BY e.embedding <=> $1::vector
    LIMIT $3
  `, vectorString, nodeId, limit);

  return results.map((row: any) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    filename: row.filename,
    content: row.content,
    score: parseFloat(row.score),
    metadata: row.metadata,
  }));
}

/**
 * Perform pure text search (for comparison/testing)
 */
export async function textSearch(
  nodeId: string,
  query: string,
  limit: number = 5
): Promise<RetrievalResult[]> {
  const results = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      c.id as chunk_id,
      c."documentId" as document_id,
      c.content,
      c.metadata,
      d.filename,
      SIMILARITY(c.content, $1) as score
    FROM rag_chunks c
    INNER JOIN rag_documents d ON c."documentId" = d.id
    WHERE d."nodeId" = $2
      AND c.content % $1
    ORDER BY score DESC
    LIMIT $3
  `, query, nodeId, limit);

  return results.map((row: any) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    filename: row.filename,
    content: row.content,
    score: parseFloat(row.score),
    metadata: row.metadata,
  }));
}
