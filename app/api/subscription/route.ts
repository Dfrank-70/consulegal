import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    let planName = 'N/A';
    if (subscription.stripePriceId) {
        const plan = await prisma.plan.findUnique({
            where: {
                stripePriceId: subscription.stripePriceId,
            }
        });
        if (plan) {
            planName = plan.name;
        }
    }

    const result = {
        ...subscription,
        planName: planName,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
