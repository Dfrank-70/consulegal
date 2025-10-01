import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// GET - Ottieni tutti i workflow
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflows = await prisma.workflow.findMany({
      include: {
        nodes: true,
        edges: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Add server-side computed counts: validEdgeCount + usersAssignedCount
    const withCounts = await Promise.all(
      workflows.map(async (w) => {
        const valid = (w.edges || []).filter((e: any) => (e.sourceId || (e as any).source) && (e.targetId || (e as any).target));
        const uniqueByEdgeId = new Set(valid.map((e: any) => e.edgeId || e.id));
        const validEdgeCount = uniqueByEdgeId.size;

        const usersAssignedCount = await prisma.user.count({
          where: w.isDefault
            ? { OR: [{ workflowId: w.id }, { workflowId: null }] }
            : { workflowId: w.id },
        });

        return { ...w, validEdgeCount, usersAssignedCount } as any;
      })
    );

    return NextResponse.json(withCounts);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Crea un nuovo workflow
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, isDefault, nodes, edges } = body;

    // Se è un workflow di default, rimuovi il flag da tutti gli altri
    if (isDefault) {
      await prisma.workflow.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description,
        isDefault: isDefault || false,
        nodes: {
          create: nodes?.map((node: any) => ({
            nodeId: node.id,
            type: node.type,
            position: node.position,
            data: node.data || {}
          })) || []
        },
        edges: {
          create: edges?.map((edge: any) => ({
            edgeId: edge.id,
            sourceId: edge.source,
            targetId: edge.target,
            data: edge.data || {}
          })) || []
        }
      },
      include: {
        nodes: true,
        edges: true
      }
    });

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
