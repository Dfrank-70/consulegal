import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// PUT - Aggiorna un utente
export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await ctx.params;

    const body = await request.json();
    const { isBlocked, role, customInstructions, defaultExpertId } = body;

    // Verifica che l'utente esista
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Aggiorna l'utente
    let validatedDefaultExpertId: string | null | undefined = undefined;

    if (defaultExpertId !== undefined) {
      if (defaultExpertId === null || defaultExpertId === '') {
        validatedDefaultExpertId = null;
      } else if (typeof defaultExpertId === 'string') {
        const expert = await (prisma as any).user.findUnique({
          where: { id: defaultExpertId },
          select: { id: true, role: true },
        });

        if (!expert || expert.role !== 'EXPERT') {
          return NextResponse.json({ error: 'Invalid default expert' }, { status: 400 });
        }

        validatedDefaultExpertId = defaultExpertId;
      } else {
        return NextResponse.json({ error: 'Invalid default expert' }, { status: 400 });
      }
    }

    const updatedUser = await (prisma as any).user.update({
      where: { id: userId },
      data: {
        ...(isBlocked !== undefined && { isBlocked }),
        ...(role && { role }),
        ...(customInstructions !== undefined && { customInstructions }),
        ...(validatedDefaultExpertId !== undefined && { defaultExpertId: validatedDefaultExpertId }),
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
        defaultExpert: {
          select: {
            id: true,
            email: true,
            name: true,
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
