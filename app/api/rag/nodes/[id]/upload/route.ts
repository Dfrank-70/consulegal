// POST /api/rag/nodes/[id]/upload - Upload and process document

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDocument } from '@/lib/rag/parser';
import { chunkTextWithPreset } from '@/lib/rag/chunker';
import { getEmbeddingsAdapter } from '@/lib/rag/embeddings';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for PoC
const ROOT = path.join(process.cwd(), 'ragdata');

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id: nodeId } = await ctx.params;

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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    console.log('[RAG UPLOAD]', {
      event: 'upload_start',
      nodeId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate document ID
    const docId = randomUUID();

    // Create storage directory: ./ragdata/<nodeId>/<docId>/
    const docDir = path.join(ROOT, nodeId, docId);
    await fs.mkdir(docDir, { recursive: true });

    // Write file to disk
    const filePath = path.join(docDir, file.name);
    await fs.writeFile(filePath, buffer);

    console.log('[RAG UPLOAD]', {
      event: 'file_written',
      docId,
      path: filePath,
      bytes: file.size,
    });

    // Create document record in DB
    const document = await prisma.ragDocument.create({
      data: {
        id: docId,
        nodeId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath: filePath,
        metadata: {},
      },
    });

    // Optional: Parse, chunk, and embed (with error handling)
    let chunksCreated = 0;
    let embeddingsCreated = 0;
    let processingTimings: any = {};

    try {
      // Step 1: Parse document
      const parseStart = Date.now();
      const parsed = await parseDocument(buffer, file.type, file.name);
            processingTimings.parsing_ms = Date.now() - parseStart;
      console.log(`[RAG INGEST] Document parsed. Streamed: ${parsed.metadata?.streamed}`);

      if (parsed.text) {
        // Step 2: Chunk text
        const chunkStart = Date.now();
        const chunks = await chunkTextWithPreset(parsed.text, 'default', {
          documentId: document.id,
          pages: parsed.metadata?.pages,
        });
        processingTimings.chunk_ms = Date.now() - chunkStart;

        if (chunks.length > 0) {
          // Step 3: Save chunks to database
          const chunkRecords = await Promise.all(
            chunks.map((chunk) =>
              prisma.ragChunk.create({
                data: {
                  documentId: document.id,
                  content: chunk.content,
                  chunkIndex: chunk.chunkIndex,
                  startChar: chunk.startChar,
                  endChar: chunk.endChar,
                  metadata: chunk.metadata,
                },
              })
            )
          );
          chunksCreated = chunkRecords.length;

          // Step 4: Generate embeddings
          const embedStart = Date.now();
          const embeddingsAdapter = getEmbeddingsAdapter();
          const chunkTexts = chunkRecords.map((c) => c.content);
          const embeddings = await embeddingsAdapter.embed(chunkTexts);
          processingTimings.embed_ms = Date.now() - embedStart;

          // Step 5: Save embeddings to database
          const embeddingInserts = chunkRecords.map((chunk, idx) => {
            const vectorString = `[${embeddings[idx].join(',')}]`;
            return prisma.$executeRawUnsafe(
              `INSERT INTO rag_embeddings (id, "chunkId", embedding, model, dimension, "createdAt")
               VALUES ($1, $2, $3::vector, $4, $5, NOW())`,
              `emb_${chunk.id}`,
              chunk.id,
              vectorString,
              embeddingsAdapter.getModel(),
              embeddingsAdapter.getDimension()
            );
          });

          await Promise.all(embeddingInserts);
          embeddingsCreated = embeddings.length;
        }
      }
    } catch (processingError) {
      console.error('[RAG UPLOAD]', 'Processing error (non-fatal):', processingError);
      // Continue - file is saved, processing can be retried
    }

    const totalTime = Date.now() - startTime;

    console.log('[RAG UPLOAD]', {
      event: 'upload_complete',
      nodeId,
      doc_id: docId,
      filename: file.name,
      chunks: chunksCreated,
      embeddings: embeddingsCreated,
      timings: { ...processingTimings, total_ms: totalTime },
    });

    return NextResponse.json({
      ok: true,
      doc_id: docId,
      filename: file.name,
      bytes: file.size,
      storage_path: filePath,
      chunks_created: chunksCreated,
      embeddings_created: embeddingsCreated,
      processing_time_ms: totalTime,
    }, { status: 200 });

  } catch (error) {
    console.error('[RAG UPLOAD]', error);
    return NextResponse.json(
      { ok: false, error: `Upload failed: ${error}` },
      { status: 500 }
    );
  }
}
