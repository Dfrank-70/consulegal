import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result: any = {
      workflowsScanned: 0,
      invalidDeleted: 0,
      duplicatesDeleted: 0,
    };

    const workflows = await prisma.workflow.findMany({
      select: { id: true },
    });

    for (const wf of workflows) {
      result.workflowsScanned++;

      // Nodes map for quick lookup
      const nodes = await prisma.workflowNode.findMany({
        where: { workflowId: wf.id },
        select: { nodeId: true },
      });
      const nodeIds = new Set(nodes.map((n) => n.nodeId));

      // Carica tutti gli edge e calcola gli invalidi in memoria
      const edges = await prisma.workflowEdge.findMany({
        where: { workflowId: wf.id },
        select: { id: true, sourceId: true, targetId: true, edgeId: true },
        orderBy: { id: 'asc' },
      });

      // 1) Edge invalidi: source/target mancanti/vuoti o riferimenti a nodi inesistenti
      const invalidIds = edges
        .filter((e) => !e.sourceId || !e.targetId || !nodeIds.has(e.sourceId) || !nodeIds.has(e.targetId))
        .map((e) => e.id);
      if (invalidIds.length) {
        const del = await prisma.workflowEdge.deleteMany({ where: { id: { in: invalidIds } } });
        result.invalidDeleted += del.count;
      }

      // 2) Rimuovi duplicati per edgeId mantenendo il primo
      const byEdgeId: Record<string, string[]> = {};
      for (const e of edges) {
        if (!e.edgeId) continue;
        if (!byEdgeId[e.edgeId]) byEdgeId[e.edgeId] = [];
        byEdgeId[e.edgeId].push(e.id);
      }
      const dupIds: string[] = [];
      for (const edgeId in byEdgeId) {
        const ids = byEdgeId[edgeId];
        if (ids.length > 1) {
          // keep first, delete rest
          dupIds.push(...ids.slice(1));
        }
      }
      if (dupIds.length) {
        const delDup = await prisma.workflowEdge.deleteMany({ where: { id: { in: dupIds } } });
        result.duplicatesDeleted += delDup.count;
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('Cleanup edges failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
