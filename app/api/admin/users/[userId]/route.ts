import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// PUT - Aggiorna un utente
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
    const { isBlocked, role, customInstructions } = body;

    // Verifica che l'utente esista
    const user = await prisma.user.findUnique({
      where: { id: params.userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Aggiorna l'utente
    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: {
        ...(isBlocked !== undefined && { isBlocked }),
        ...(role && { role }),
        ...(customInstructions !== undefined && { customInstructions }),
      },
      include: {
        subscription: {
          select: {
            id: true,
            status: true,
            tokenLimit: true,
            createdAt: true,
          },
        },
        workflow: {
          select: {
            id: true,
            name: true,
            description: true,
            isDefault: true,
          },
        },
        _count: {
          select: { conversations: true },
        },
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
