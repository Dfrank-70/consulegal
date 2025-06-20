'use server';

import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { redirect } from 'next/navigation';

// This needs to be an absolute URL
const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/profile`;

export async function createStripePortal() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    throw new Error('User not authenticated');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });

  if (!dbUser?.stripeCustomerId) {
    throw new Error('Stripe Customer ID not found for user.');
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: returnUrl,
  });

  redirect(portalSession.url);
}
