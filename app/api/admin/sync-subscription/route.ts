import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const { stripe } = await import('@/lib/stripe');

    // Trova l'utente ottobre4@gmail.com
    const user = await prisma.user.findUnique({
      where: { email: 'ottobre4@gmail.com' },
      select: { id: true, stripeCustomerId: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: 'Nessun customerId Stripe per questo utente' }, { status: 400 });
    }

    // Recupera le subscriptions attive da Stripe per questo customer
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ error: 'Nessuna subscription attiva su Stripe' }, { status: 404 });
    }

    const sub = subscriptions.data[0];

    // Aggiorna il DB
    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeSubscriptionId: sub.id,
        stripePriceId: sub.items.data[0].price.id,
        stripeProductId: sub.items.data[0].price.product as string,
        status: sub.status,
        currentPeriodStart: new Date((sub as any).current_period_start * 1000),
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        tokenLimit: 10000, // Default per piano intermedio
      },
      update: {
        stripeSubscriptionId: sub.id,
        stripePriceId: sub.items.data[0].price.id,
        stripeProductId: sub.items.data[0].price.product as string,
        status: sub.status,
        currentPeriodStart: new Date((sub as any).current_period_start * 1000),
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        tokenLimit: 10000,
      }
    });

    return NextResponse.json({ success: true, message: 'Abbonamento sincronizzato' });

  } catch (error: any) {
    console.error('Errore sincronizzazione:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
