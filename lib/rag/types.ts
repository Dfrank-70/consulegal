// RAG System Types and DTOs

export interface RAGNode {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RAGDocument {
  id: string;
  nodeId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface RAGChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface RAGEmbedding {
  id: string;
  chunkId: string;
  embedding: number[];
  model: string;
  dimension: number;
  createdAt: Date;
}

// DTOs for API requests/responses

export interface CreateNodeRequest {
  name: string;
  description?: string;
}

export interface CreateNodeResponse {
  node: RAGNode;
}

export interface UploadDocumentResponse {
  document: RAGDocument;
  chunksCreated: number;
  embeddingsCreated: number;
  processingTimeMs: number;
}

export interface QueryRequest {
  nodeId: string;
  query: string;
  topK?: number;
  returnK?: number;
  hybridAlpha?: number; // 0 = full text, 1 = full vector, 0.5 = balanced
}

export interface RetrievedContext {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface QueryResponse {
  contexts: RetrievedContext[];
  retrievalTimeMs: number;
}

export interface AnswerRequest {
  nodeId: string;
  query: string;
  topK?: number;
  returnK?: number;
  temperature?: number;
  model?: string;
}

export interface Citation {
  documentId: string;
  filename: string;
  page?: number;
  chunkId: string;
  excerpt: string;
}

export interface AnswerResponse {
  answer: string;
  citations: Citation[];
  rawContexts: RetrievedContext[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
  telemetry: {
    tTotalMs: number;
    tRetrievalMs: number;
    tLlmMs: number;
    tEmbeddingMs?: number;
  };
}

// Chunking configuration

export type ChunkPreset = 'legal' | 'faq' | 'table' | 'email' | 'default';

export interface ChunkConfig {
  chunkSize: number;
  overlap: number;
}

export const CHUNK_PRESETS: Record<ChunkPreset, ChunkConfig> = {
  default: { chunkSize: 900, overlap: 120 },
  legal: { chunkSize: 1200, overlap: 200 },
  faq: { chunkSize: 600, overlap: 80 },
  table: { chunkSize: 1500, overlap: 100 },
  email: { chunkSize: 800, overlap: 100 },
};

// Storage adapter types

export interface StorageAdapter {
  put(path: string, data: Buffer): Promise<string>;
  get(path: string): Promise<Buffer>;
  presign?(path: string, expiresIn?: number): Promise<string>;
}

// Embeddings adapter types

export interface EmbeddingsAdapter {
  embed(texts: string[]): Promise<number[][]>;
  getModel(): string;
  getDimension(): number;
}

// Retrieval types

export interface HybridRetrievalConfig {
  topK: number;
  returnK: number;
  alpha: number; // 0-1, weight for vector vs text search
}

export interface RetrievalResult {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}
