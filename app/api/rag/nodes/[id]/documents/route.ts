import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: nodeId } = await ctx.params;

    const node = await prisma.ragNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return NextResponse.json({ error: 'RAG node not found' }, { status: 404 });
    }

    const documents = await prisma.ragDocument.findMany({
      where: { nodeId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return NextResponse.json({ documents }, { status: 200 });
  } catch (error) {
    console.error('[RAG DOCUMENTS] GET error:', error);
    return NextResponse.json(
      { error: `Failed to fetch documents: ${error}` },
      { status: 500 }
    );
  }
}
