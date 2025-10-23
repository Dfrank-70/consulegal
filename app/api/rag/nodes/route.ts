// POST /api/rag/nodes - Create a new RAG node

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { CreateNodeRequest, CreateNodeResponse } from '@/lib/rag/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreateNodeRequest = await request.json();
    const { name, description } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Node name is required' },
        { status: 400 }
      );
    }

    const node = await prisma.ragNode.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
      },
    });

    console.log(JSON.stringify({
      event: 'rag_node_created',
      nodeId: node.id,
      name: node.name,
    }));

    const response: CreateNodeResponse = {
      node: {
        id: node.id,
        name: node.name,
        description: node.description || undefined,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating RAG node:', error);
    return NextResponse.json(
      { error: 'Failed to create RAG node' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const nodes = await prisma.ragNode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    return NextResponse.json({ nodes }, { status: 200 });
  } catch (error) {
    console.error('Error fetching RAG nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RAG nodes' },
      { status: 500 }
    );
  }
}
