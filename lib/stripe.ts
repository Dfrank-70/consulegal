import Stripe from 'stripe';

// Seleziona chiave Stripe in base all'ambiente
const isProduction = process.env.NODE_ENV === 'production';
const stripeSecretKey = isProduction 
  ? process.env.STRIPE_SECRET_KEY 
  : process.env.STRIPE_SECRET_KEY_TEST;

if (!stripeSecretKey) {
  const missingKey = isProduction ? 'STRIPE_SECRET_KEY' : 'STRIPE_SECRET_KEY_TEST';
  throw new Error(`${missingKey} is not set in environment variables (NODE_ENV=${process.env.NODE_ENV})`);
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20" as any,
  typescript: true,
});

// Export helper per webhook secret
export function getWebhookSecret(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const webhookSecret = isProduction
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET_TEST;
  
  if (!webhookSecret) {
    const missingSecret = isProduction ? 'STRIPE_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET_TEST';
    throw new Error(`${missingSecret} is not set in environment variables (NODE_ENV=${process.env.NODE_ENV})`);
  }
  
  return webhookSecret;
}
