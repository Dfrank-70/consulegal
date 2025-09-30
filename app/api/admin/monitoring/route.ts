import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// GET - Ottieni i log di esecuzione dei workflow
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logs = await prisma.workflowExecutionLog.findMany({
      take: 100, // Limita ai 100 log più recenti
      orderBy: {
        startedAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Arricchisci i log con il nome del workflow
    const workflowIds = [...new Set(logs.map(log => log.workflowId))];
    const workflows = await prisma.workflow.findMany({
      where: {
        id: { in: workflowIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const workflowMap = new Map(workflows.map(w => [w.id, w.name]));

    const enrichedLogs = logs.map(log => ({
      ...log,
      workflowName: workflowMap.get(log.workflowId) || 'Sconosciuto',
    }));

    return NextResponse.json(enrichedLogs);
  } catch (error) {
    console.error('Error fetching workflow execution logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
