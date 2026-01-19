import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { stripe, getWebhookSecret } from '@/lib/stripe';

/**
 * Manages subscription data in the database in a transactional manner.
 * @param subscription - The Stripe Subscription object.
 * @param userId - The internal user ID from our database.
 */
async function manageSubscription(subscription: Stripe.Subscription, userId: string) {
  console.log(`🔄 Managing subscription for user ${userId}`);
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const productId = subscription.items.data[0]?.price.product as string;

  console.log(`📊 Subscription details: customerId=${customerId}, priceId=${priceId}, productId=${productId}`);

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
    console.log(`🔄 Starting database transaction for user ${userId}`);
    // Use a transaction to ensure atomicity: update user and upsert subscription together.
    await prisma.$transaction(async (tx) => {
      // 1. Update the user with their Stripe Customer ID for future reference.
      console.log(`🔄 Updating user ${userId} with stripeCustomerId ${customerId}`);
      await tx.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
      console.log(`✅ User ${userId} updated with stripeCustomerId`);

      // 2. Create or update the subscription record using the internal userId as the key.
      console.log(`🔄 Upserting subscription for user ${userId}`);
      await tx.subscription.upsert({
        where: { userId: userId },
        create: subscriptionData,
        update: subscriptionData,
      });
      console.log(`✅ Subscription upserted for user ${userId}`);
    });
    console.log(`✅ Transaction completed: Subscription ${subscription.id} successfully managed for user ${userId}.`);
  } catch (error) {
    console.error(`❌ Transaction failed for subscription ${subscription.id}:`, error);
  }
}

export async function POST(req: NextRequest) {
  console.log('🔔 Webhook received');
  const body = await req.text();
  const signature = req.headers.get('Stripe-Signature');
  
  // Validazione signature header
  if (!signature) {
    console.error('❌ Missing Stripe-Signature header');
    return new NextResponse('Missing Stripe-Signature', { status: 400 });
  }
  
  let webhookSecret: string;
  try {
    webhookSecret = getWebhookSecret();
  } catch (error: any) {
    console.error('❌ Webhook secret not configured:', error.message);
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(`✅ Webhook event verified: ${event.type} (${event.id})`);
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // IDEMPOTENCY: Create event record FIRST (concurrency-safe)
  try {
    await prisma.stripeEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        processed: false, // Mark as in-progress
      }
    });
    console.log(`✅ Event ${event.id} registered for processing`);
  } catch (error: any) {
    // Unique constraint violation (P2002) = event already exists
    if (error.code === 'P2002') {
      // Check if event was fully processed or still in progress
      const existingEvent = await prisma.stripeEvent.findUnique({
        where: { eventId: event.id }
      });
      
      if (existingEvent?.processed) {
        console.log(`⏭️  Event ${event.id} already processed, skipping`);
        return new NextResponse(null, { status: 200 });
      } else {
        // Event processing in progress or failed - let Stripe retry
        console.log(`⏳ Event ${event.id} processing in progress or failed, returning 500 for retry`);
        return new NextResponse('Event processing in progress', { status: 500 });
      }
    }
    // Other DB errors - return 500 to trigger Stripe retry
    console.error(`❌ DB error creating event record: ${error.message}`);
    return new NextResponse('Database error', { status: 500 });
  }

  console.log('✅ Stripe Webhook Received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('🛒 Checkout session completed event received');
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`📋 Session details: mode=${session.mode}, subscription=${session.subscription}, client_reference_id=${session.client_reference_id}`);
        
        if (session.mode === 'subscription' && session.subscription && session.client_reference_id) {
          console.log(`🔍 Processing subscription for user ${session.client_reference_id}`);
          const subscriptionId = session.subscription as string;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          console.log(`📊 Retrieved subscription details: ${subscription.id}, status: ${subscription.status}`);
          // The key fix: use client_reference_id as our internal userId.
          await manageSubscription(subscription, session.client_reference_id);
        } else {
          console.warn('❌ checkout.session.completed was received but is missing required data.');
          console.log('Missing data details:', { 
            mode: session.mode, 
            subscription: session.subscription,
            client_reference_id: session.client_reference_id 
          });
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

      case 'invoice.payment_succeeded':
      case 'invoice_payment.paid': {
        console.log('💳 Invoice payment succeeded event received');
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        if ((invoice as any).subscription) {
          console.log(`🔍 Processing payment for subscription ${(invoice as any).subscription}`);
          const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);
          
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId },
            select: { id: true },
          });

          if (user) {
            console.log(`✅ Payment confirmed for user ${user.id}, updating subscription`);
            await manageSubscription(subscription, user.id);
          } else {
            console.error(`❌ User not found for customer ID: ${customerId}. Cannot process payment confirmation.`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        console.log('❌ Invoice payment failed event received');
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        });

        if (user) {
          // Retrieve subscription to get actual status from Stripe
          if ((invoice as any).subscription) {
            const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);
            console.log(`⚠️  Payment failed for user ${user.id}, updating subscription status to ${subscription.status}`);
            await manageSubscription(subscription, user.id);
          } else {
            // No subscription linked, just update to past_due
            console.log(`⚠️  Payment failed for user ${user.id}, no subscription linked`);
            await prisma.subscription.updateMany({
              where: { userId: user.id },
              data: { status: 'past_due' }
            });
          }
        } else {
          console.error(`❌ User not found for customer ID: ${customerId}. Cannot process payment failure.`);
        }
        break;
      }

      default:
        console.log(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }

    // Mark event as fully processed
    try {
      await prisma.stripeEvent.update({
        where: { eventId: event.id },
        data: { processed: true }
      });
      console.log(`✅ Event ${event.id} processed and marked complete`);
    } catch (error: any) {
      console.error(`⚠️  Error updating event status: ${error.message}`);
      // Don't fail webhook - processing was successful
    }
  } catch (error: any) {
    console.error('❌ Error processing webhook event:', error);
    // Event record exists with processed=false, Stripe will retry
    return new NextResponse('Webhook handler failed', { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
