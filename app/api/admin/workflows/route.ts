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

    return NextResponse.json(workflows);
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
            data: node.data
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
