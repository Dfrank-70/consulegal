import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY_TEST) {
  throw new Error('STRIPE_SECRET_KEY_TEST is not set in .env');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_TEST, {
  apiVersion: "2024-06-20" as any, // Specifica sempre una versione API
  typescript: true,
});
