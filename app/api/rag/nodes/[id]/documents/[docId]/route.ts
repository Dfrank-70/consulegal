import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: nodeId, docId } = await ctx.params;

    const doc = await prisma.ragDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.nodeId !== nodeId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await prisma.ragDocument.delete({
      where: { id: docId },
    });

    try {
      const docDir = path.dirname(doc.storagePath);
      await fs.rm(docDir, { recursive: true, force: true });
    } catch (fileErr) {
      console.error('[RAG DOCUMENTS] Failed to delete storage path:', fileErr);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[RAG DOCUMENTS] DELETE error:', error);
    return NextResponse.json(
      { error: `Failed to delete document: ${error}` },
      { status: 500 }
    );
  }
}
