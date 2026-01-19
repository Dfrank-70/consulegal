/**
 * Subscription Entitlement Logic
 * 
 * Determina se un utente ha accesso ai servizi basandosi sullo stato subscription.
 */

export interface EntitlementResult {
  entitled: boolean;
  reason: string;
}

/**
 * Computa l'entitlement dell'utente basandosi sullo stato subscription.
 * 
 * @param subscriptionStatus - Status subscription da Stripe ('active', 'trialing', 'past_due', 'canceled', etc.)
 * @param currentPeriodEnd - Data fine periodo corrente (null se non disponibile)
 * @param trialEnd - Data fine trial (null se non in trial o trial finito)
 * @returns EntitlementResult con entitled flag e reason
 * 
 * Policy MVP:
 * - status 'active' o 'trialing' => entitled
 * - altri status => not entitled
 * - no subscription data => not entitled
 */
export function computeEntitlement(
  subscriptionStatus: string | null | undefined,
  currentPeriodEnd: Date | null = null,
  trialEnd: Date | null = null
): EntitlementResult {
  // Nessuna subscription trovata
  if (!subscriptionStatus) {
    return {
      entitled: false,
      reason: 'no_subscription'
    };
  }

  // Stati che garantiscono accesso
  const allowedStatuses = ['active', 'trialing'];
  
  if (allowedStatuses.includes(subscriptionStatus)) {
    return {
      entitled: true,
      reason: 'subscription_active'
    };
  }

  // Stati che bloccano accesso
  // 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
  return {
    entitled: false,
    reason: `subscription_${subscriptionStatus}`
  };
}

/**
 * Helper per verificare entitlement da oggetto subscription completo.
 * 
 * @param subscription - Oggetto Prisma Subscription o null
 * @returns EntitlementResult
 */
export function checkSubscriptionEntitlement(
  subscription: {
    status: string;
    currentPeriodEnd: Date | null;
    trialEnd: Date | null;
  } | null
): EntitlementResult {
  if (!subscription) {
    return {
      entitled: false,
      reason: 'no_subscription'
    };
  }

  return computeEntitlement(
    subscription.status,
    subscription.currentPeriodEnd,
    subscription.trialEnd
  );
}
