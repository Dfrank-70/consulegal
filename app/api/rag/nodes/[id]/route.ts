import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const node = await prisma.ragNode.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    return NextResponse.json(node);
  } catch (error) {
    console.error('[API] Error fetching RAG node:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const updatedNode = await prisma.ragNode.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(updatedNode);
  } catch (error) {
    console.error('[API] Error updating RAG node:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const node = await prisma.ragNode.findUnique({
      where: { id },
    });

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.ragEmbedding.deleteMany({
        where: {
          chunk: {
            document: {
              nodeId: id,
            },
          },
        },
      });

      await tx.ragChunk.deleteMany({
        where: {
          document: {
            nodeId: id,
          },
        },
      });

      await tx.ragDocument.deleteMany({
        where: {
          nodeId: id,
        },
      });

      await tx.ragNode.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true, message: 'Node deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting RAG node:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
