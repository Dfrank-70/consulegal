import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// PUT - Assegna un workflow a un utente
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workflowId } = body;

    // Verifica che l'utente esista
    const user = await prisma.user.findUnique({
      where: { id: params.userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verifica che il workflow esista (se specificato)
    if (workflowId) {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId }
      });

      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
    }

    // Aggiorna l'utente con il nuovo workflow
    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: { workflowId: workflowId || null },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            description: true,
            isDefault: true,
          },
        },
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error assigning workflow to user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
