import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// GET - Ottieni tutti gli abbonamenti con limiti file
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: {
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

    // Raggruppa per piano (stripeProductId)
    const planGroups = subscriptions.reduce((acc: any, sub) => {
      const planKey = sub.stripeProductId || 'no-plan';
      if (!acc[planKey]) {
        acc[planKey] = {
          stripeProductId: sub.stripeProductId,
          tokenLimit: sub.tokenLimit,
          maxFileBytes: sub.maxFileBytes,
          maxAttachmentChars: sub.maxAttachmentChars,
          count: 0,
          users: []
        };
      }
      acc[planKey].count++;
      acc[planKey].users.push({
        id: sub.userId,
        name: sub.user.name,
        email: sub.user.email,
        status: sub.status
      });
      return acc;
    }, {});

    return NextResponse.json({
      subscriptions,
      planGroups
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Aggiorna limiti per un piano specifico
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { stripeProductId, tokenLimit, maxFileBytes, maxAttachmentChars } = body;

    if (!stripeProductId) {
      return NextResponse.json({ error: 'stripeProductId required' }, { status: 400 });
    }

    // Aggiorna tutti gli abbonamenti con questo stripeProductId
    const updated = await prisma.subscription.updateMany({
      where: { stripeProductId },
      data: {
        ...(tokenLimit !== undefined && { tokenLimit }),
        ...(maxFileBytes !== undefined && { maxFileBytes }),
        ...(maxAttachmentChars !== undefined && { maxAttachmentChars })
      }
    });

    return NextResponse.json({
      success: true,
      updated: updated.count,
      stripeProductId,
      limits: {
        tokenLimit,
        maxFileBytes,
        maxAttachmentChars
      }
    });
  } catch (error) {
    console.error('Error updating subscription limits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
