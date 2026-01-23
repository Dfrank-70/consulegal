import Stripe from 'stripe';

// Seleziona chiave Stripe in base all'ambiente
const isProduction = process.env.NODE_ENV === 'production';
const stripeSecretKey = isProduction 
  ? process.env.STRIPE_SECRET_KEY 
  : process.env.STRIPE_SECRET_KEY_TEST;

const missingKeyName = isProduction ? 'STRIPE_SECRET_KEY' : 'STRIPE_SECRET_KEY_TEST';
const missingKeyMessage = `${missingKeyName} is not set in environment variables (NODE_ENV=${process.env.NODE_ENV})`;

const stripeInstance = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20" as any,
      typescript: true,
    })
  : null;

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!stripeInstance) {
      throw new Error(missingKeyMessage);
    }
    const value = (stripeInstance as any)[prop];
    return typeof value === 'function' ? value.bind(stripeInstance) : value;
  },
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
