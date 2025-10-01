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


    // Trasforma i dati per il frontend (formato React Flow)
    const responseData = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isDefault: workflow.isDefault,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      // React Flow nodes
      nodes: workflow.nodes.map((n) => ({
        id: n.nodeId,
        type: n.type,
        position: n.position as any,
        data: n.data as any,
      })),
      // React Flow edges
      edges: workflow.edges.map((e) => ({
        id: e.edgeId,
        source: e.sourceId,
        target: e.targetId,
        data: (e.data as any) || {},
      })),
      // opzionale: utenti collegati, se serve in UI
      users: (workflow as any).users ?? [],
    };


    return NextResponse.json(responseData);
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

    const updatedWorkflow = await prisma.$transaction(async (tx) => {
      // Step 1: Update workflow main data
      await tx.workflow.update({
        where: { id },
        data: { name, description, isDefault },
      });

      // Step 2: Delete old nodes and edges
      await tx.workflowNode.deleteMany({ where: { workflowId: id } });
      await tx.workflowEdge.deleteMany({ where: { workflowId: id } });

      // Step 3: Create new nodes
      if (nodes && nodes.length > 0) {
        await tx.workflowNode.createMany({
          data: nodes.map((node: any) => ({
            workflowId: id,
            nodeId: node.id,
            type: node.type,
            position: node.position,
            data: node.data || {},
          })),
        });
      }

      // Step 4: Create new edges
      if (edges && edges.length > 0) {
        const edgesData = edges.map((edge: { id: string; source: string; target: string; data?: any }) => ({
          workflowId: id,
          edgeId: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          data: edge.data || {},
        }));


        await tx.workflowEdge.createMany({
          data: edgesData,
        });
      }

      // Step 5: Return the updated workflow
      return tx.workflow.findUnique({
        where: { id },
        include: { nodes: true, edges: true },
      });
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
