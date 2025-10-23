-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "rag_nodes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_documents" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "startChar" INTEGER NOT NULL,
    "endChar" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_embeddings" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "embedding" vector(3072) NOT NULL,
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rag_documents_nodeId_idx" ON "rag_documents"("nodeId");

-- CreateIndex
CREATE INDEX "rag_chunks_documentId_idx" ON "rag_chunks"("documentId");

-- CreateIndex
CREATE INDEX "rag_chunks_content_idx" ON "rag_chunks" USING GIN ("content" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "rag_embeddings_chunkId_key" ON "rag_embeddings"("chunkId");

-- AddForeignKey
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "rag_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "rag_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_embeddings" ADD CONSTRAINT "rag_embeddings_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "rag_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
