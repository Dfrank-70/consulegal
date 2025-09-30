import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// GET - Ottieni un workflow specifico
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        nodes: true,
        edges: true,
      },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error(`Error fetching workflow ${id}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Aggiorna un workflow
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, isDefault, nodes, edges } = body;

    await prisma.$transaction([
      prisma.workflowNode.deleteMany({ where: { workflowId: id } }),
      prisma.workflowEdge.deleteMany({ where: { workflowId: id } }),
    ]);

    const updatedWorkflow = await prisma.workflow.update({
      where: { id },
      data: {
        name,
        description,
        isDefault,
        nodes: {
          create: nodes.map((node: any) => ({ // Qui 'nodes' è corretto perché è una relazione del modello Workflow
            nodeId: node.id,
            type: node.type,
            position: node.position,
            data: node.data,
          })),
        },
        edges: {
          create: edges.map((edge: any) => ({ // Qui 'edges' è corretto perché è una relazione del modello Workflow
            edgeId: edge.id,
            sourceId: edge.source,
            targetId: edge.target,
            data: edge.data,
          })),
        },
      },
      include: {
        nodes: true,
        edges: true,
      },
    });

    return NextResponse.json(updatedWorkflow);
  } catch (error) {
    console.error(`Error updating workflow ${id}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Elimina un workflow
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.workflow.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error(`Error deleting workflow ${id}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
