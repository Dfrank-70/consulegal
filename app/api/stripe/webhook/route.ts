import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

/**
 * Manages subscription data in the database in a transactional manner.
 * @param subscription - The Stripe Subscription object.
 * @param userId - The internal user ID from our database.
 */
async function manageSubscription(subscription: Stripe.Subscription, userId: string) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const productId = subscription.items.data[0]?.price.product as string;

  if (!priceId || !productId) {
    console.error(`❌ Price ID or Product ID is missing for subscription ${subscription.id}.`);
    return;
  }

  const subscriptionData = {
    userId: userId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeProductId: productId,
    status: subscription.status,
    currentPeriodStart: (subscription as any).current_period_start
      ? new Date((subscription as any).current_period_start * 1000)
      : null,
    currentPeriodEnd: (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  try {
    // Use a transaction to ensure atomicity: update user and upsert subscription together.
    await prisma.$transaction(async (tx) => {
      // 1. Update the user with their Stripe Customer ID for future reference.
      await tx.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });

      // 2. Create or update the subscription record using the internal userId as the key.
      await tx.subscription.upsert({
        where: { userId: userId },
        create: subscriptionData,
        update: subscriptionData,
      });
    });
    console.log(`✅ Subscription ${subscription.id} successfully managed for user ${userId}.`);
  } catch (error) {
    console.error(`❌ Transaction failed for subscription ${subscription.id}:`, error);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('Stripe-Signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST || process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret is not configured. Denying request.');
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('✅ Stripe Webhook Received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription && session.client_reference_id) {
          const subscriptionId = session.subscription as string;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          // The key fix: use client_reference_id as our internal userId.
          await manageSubscription(subscription, session.client_reference_id);
        } else {
          console.warn('checkout.session.completed was received but is missing required data.');
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        // For updates/deletes, find the user via the stored customerId.
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        });

        if (user) {
          await manageSubscription(subscription, user.id);
        } else {
          console.error(`❌ User not found for customer ID: ${customerId}. Cannot process subscription update/delete.`);
        }
        break;
      }

      default:
        console.log(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }
  } catch (error: any) {
    console.error('Error processing webhook event:', error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
