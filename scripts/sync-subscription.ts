import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';

async function syncSubscription(email: string) {
  try {
    console.log(`🔍 Searching for user: ${email}`);
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true }
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      return;
    }

    console.log(`✅ User found: ${user.id}`);
    console.log(`📊 Current subscription:`, user.subscription);

    // Cerca abbonamenti Stripe per email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    if (customers.data.length === 0) {
      console.log(`❌ No Stripe customer found for ${email}`);
      return;
    }

    const customer = customers.data[0];
    console.log(`✅ Stripe customer found: ${customer.id}`);

    // Recupera abbonamenti attivi
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      console.log(`❌ No active subscriptions found`);
      return;
    }

    const subscription = subscriptions.data[0];
    console.log(`✅ Active subscription found: ${subscription.id}`);
    console.log(`📊 Subscription details:`, {
      id: subscription.id,
      status: subscription.status,
      priceId: subscription.items.data[0]?.price.id,
      productId: subscription.items.data[0]?.price.product
    });

    // Sincronizza nel database
    const priceId = subscription.items.data[0]?.price.id;
    const productId = subscription.items.data[0]?.price.product as string;

    if (!priceId || !productId) {
      console.error(`❌ Missing price or product ID`);
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Aggiorna user con stripeCustomerId
      await tx.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id }
      });

      // Crea/aggiorna subscription
      await tx.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          stripeProductId: productId,
          status: subscription.status,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        },
        update: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          stripeProductId: productId,
          status: subscription.status,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
      });
    });

    console.log(`✅ Subscription synced successfully!`);
    
    // Verifica finale
    const updatedUser = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true }
    });
    console.log(`📊 Updated user subscription:`, updatedUser?.subscription);

  } catch (error) {
    console.error('❌ Error syncing subscription:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui per l'utente di test
syncSubscription('utentepro2026@test.com');
