# Subscription Policy - MVP

**Data:** 19 Gennaio 2026  
**Versione:** MVP 1.0

---

## Overview

Il sistema implementa un **entitlement guard** basato su subscription Stripe per controllare l'accesso ai servizi costosi (LLM, RAG query).

**Principio:** Solo utenti con subscription attiva possono utilizzare feature che generano costi API.

---

## Stati Subscription Permessi

### ✅ Accesso Garantito

| Stato Stripe | Descrizione | Accesso |
|--------------|-------------|---------|
| `active` | Subscription pagata e attiva | ✅ Completo |
| `trialing` | Periodo trial attivo | ✅ Completo |

### ❌ Accesso Bloccato

| Stato Stripe | Descrizione | Accesso | Note |
|--------------|-------------|---------|------|
| `past_due` | Pagamento fallito | ❌ Bloccato | Stripe riprova automaticamente |
| `canceled` | Subscription cancellata | ❌ Bloccato | Utente può riattivare |
| `unpaid` | Fattura non pagata | ❌ Bloccato | Richiede pagamento manuale |
| `incomplete` | Setup subscription incompleto | ❌ Bloccato | Richiede completamento checkout |
| `incomplete_expired` | Setup scaduto | ❌ Bloccato | Richiede nuovo checkout |
| `paused` | Subscription in pausa | ❌ Bloccato | Feature Stripe avanzata |
| `null` / assente | Nessuna subscription trovata | ❌ Bloccato | Utente deve sottoscrivere piano |

---

## Endpoint Protetti

### 1. `POST /api/chat`

**Costo:** Alto (OpenAI LLM, workflow execution, RAG retrieval)

**Protezione:**
```typescript
// Check entitlement PRIMA di processare
const entitlement = checkSubscriptionEntitlement(user.subscription);

if (!entitlement.entitled) {
  return NextResponse.json(
    { 
      error: 'subscription_inactive', 
      reason: entitlement.reason,
      action: 'subscribe'
    },
    { status: 402 } // Payment Required
  );
}
```

**Response Bloccato:**
```json
{
  "error": "subscription_inactive",
  "reason": "no_subscription",
  "action": "subscribe"
}
```

**Status Code:** `402 Payment Required`

---

### 2. `POST /api/rag/query`

**Costo:** Medio (OpenAI embeddings, vector search)

**Protezione:** Identica a `/api/chat`

**Note:** Endpoint usato internamente da workflow RAG nodes, quindi già protetto indirettamente.

---

## Implementazione Tecnica

### File Coinvolti

1. **`lib/entitlement.ts`** (NUOVO)
   - `computeEntitlement()` - Logica core
   - `checkSubscriptionEntitlement()` - Helper per Prisma objects

2. **`app/api/chat/route.ts`** (MODIFICATO)
   - Aggiunto check entitlement dopo autenticazione
   - Return 402 se non entitled

3. **`app/api/rag/query/route.ts`** (MODIFICATO)
   - Aggiunto autenticazione (prima mancante)
   - Aggiunto check entitlement

---

## Logica Entitlement

```typescript
function computeEntitlement(
  subscriptionStatus: string | null,
  currentPeriodEnd: Date | null,
  trialEnd: Date | null
): EntitlementResult {
  // Nessuna subscription
  if (!subscriptionStatus) {
    return { entitled: false, reason: 'no_subscription' };
  }

  // Stati permessi
  const allowedStatuses = ['active', 'trialing'];
  if (allowedStatuses.includes(subscriptionStatus)) {
    return { entitled: true, reason: 'subscription_active' };
  }

  // Stati bloccati
  return { entitled: false, reason: `subscription_${subscriptionStatus}` };
}
```

**Parametri:**
- `subscriptionStatus` - Da `subscription.status` (Stripe status sync)
- `currentPeriodEnd` - Attualmente non usato (futuro: grace period)
- `trialEnd` - Attualmente non usato (futuro: trial expiration warning)

---

## Response API quando Bloccato

### Formato Standard

```json
{
  "error": "subscription_inactive",
  "reason": "<reason_code>",
  "action": "subscribe"
}
```

### Reason Codes

| Code | Significato | Azione Utente |
|------|-------------|---------------|
| `no_subscription` | Nessuna subscription trovata | Vai a /pricing e acquista piano |
| `subscription_past_due` | Pagamento fallito | Aggiorna metodo pagamento in billing portal |
| `subscription_canceled` | Subscription cancellata | Riattiva piano o acquista nuovo |
| `subscription_unpaid` | Fattura non pagata | Paga fattura pendente |
| `subscription_incomplete` | Setup incompleto | Completa checkout Stripe |

### HTTP Status Codes

| Status | Uso | Retry |
|--------|-----|-------|
| `401 Unauthorized` | Utente non autenticato | No - Login richiesto |
| `402 Payment Required` | Subscription inactive | No - Pagamento richiesto |
| `403 Forbidden` | Account bloccato (admin) | No - Contatta admin |
| `404 Not Found` | User non trovato in DB | No - Errore sistema |

---

## Logging

### Entitlement Denied

```typescript
console.log(`🚫 Access denied for user ${userId}: ${entitlement.reason}`);
```

**Output Esempio:**
```
🚫 Access denied for user cm123abc: no_subscription
🚫 Access denied for user cm456def: subscription_past_due
🚫 RAG query denied for user cm789ghi: subscription_canceled
```

**Dati Loggati:**
- ✅ User ID (anonimizzato)
- ✅ Reason code
- ❌ Nessun dato sensibile (email, payment info, etc.)

---

## Testing

### Setup Test Database

```sql
-- Utente senza subscription
UPDATE users SET id = 'test_user_no_sub' WHERE email = 'test1@example.com';
DELETE FROM subscriptions WHERE userId = 'test_user_no_sub';

-- Utente con subscription attiva
UPDATE subscriptions 
SET status = 'active', currentPeriodEnd = NOW() + INTERVAL '30 days'
WHERE userId = 'test_user_active';

-- Utente con subscription past_due
UPDATE subscriptions 
SET status = 'past_due'
WHERE userId = 'test_user_past_due';

-- Utente con subscription canceled
UPDATE subscriptions 
SET status = 'canceled'
WHERE userId = 'test_user_canceled';

-- Utente in trial
UPDATE subscriptions 
SET status = 'trialing', trialEnd = NOW() + INTERVAL '7 days'
WHERE userId = 'test_user_trial';
```

---

### Test 1: No Subscription (Blocco)

**Setup:**
```sql
-- Nessuna subscription per utente
DELETE FROM subscriptions WHERE userId = 'cm123abc';
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Cookie: next-auth.session-token=..." \
  -F "message=Test"
```

**Expected Response:**
```json
HTTP/1.1 402 Payment Required
{
  "error": "subscription_inactive",
  "reason": "no_subscription",
  "action": "subscribe"
}
```

**Verification:**
```
Server logs: 🚫 Access denied for user cm123abc: no_subscription
```

---

### Test 2: Active Subscription (Accesso OK)

**Setup:**
```sql
UPDATE subscriptions 
SET status = 'active', currentPeriodEnd = NOW() + INTERVAL '30 days'
WHERE userId = 'cm123abc';
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Cookie: ..." \
  -F "message=Test"
```

**Expected Response:**
```json
HTTP/1.1 200 OK
{
  "conversationId": "...",
  "messageId": "...",
  "response": "..."
}
```

---

### Test 3: Past Due (Blocco)

**Setup:**
```sql
UPDATE subscriptions 
SET status = 'past_due'
WHERE userId = 'cm123abc';
```

**Request:** Identico a Test 1

**Expected Response:**
```json
HTTP/1.1 402 Payment Required
{
  "error": "subscription_inactive",
  "reason": "subscription_past_due",
  "action": "subscribe"
}
```

---

### Test 4: Trial (Accesso OK)

**Setup:**
```sql
UPDATE subscriptions 
SET status = 'trialing', trialEnd = NOW() + INTERVAL '7 days'
WHERE userId = 'cm123abc';
```

**Request:** Identico a Test 1

**Expected Response:** `200 OK` (accesso garantito)

---

### Test 5: RAG Query Endpoint

**Request:**
```bash
curl -X POST http://localhost:3000/api/rag/query \
  -H "Cookie: ..." \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "cmxxx",
    "query": "test query",
    "topK": 5
  }'
```

**Expected Response:** Identica a `/api/chat` (402 se no subscription, 200 se active)

---

## Future Enhancements

### 1. Grace Period (Non Implementato MVP)

**Scenario:** Pagamento fallisce ma utente può continuare a usare servizio per N giorni.

**Implementazione:**
```typescript
function computeEntitlement(status, currentPeriodEnd, trialEnd) {
  if (status === 'past_due') {
    // Grace period: 7 giorni dalla fine periodo
    const gracePeriodEnd = new Date(currentPeriodEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    
    if (Date.now() < gracePeriodEnd.getTime()) {
      return { entitled: true, reason: 'grace_period' };
    }
  }
  // ...
}
```

---

### 2. Token Usage Soft/Hard Limits (Parzialmente Implementato)

**Current:** Token limit salvato ma non enforced pre-call.

**Future:**
```typescript
// Dopo entitlement check
const tokenUsage = await getMonthlyTokenUsage(userId);
if (tokenUsage >= subscription.tokenLimit) {
  return NextResponse.json(
    { error: 'token_limit_exceeded', limit: subscription.tokenLimit },
    { status: 429 } // Too Many Requests
  );
}
```

---

### 3. Notifiche Proattive (Non Implementato)

**Scenario:** Inviare email quando subscription sta per scadere o pagamento fallisce.

**Trigger:**
- Trial scade in 3 giorni
- Payment failed (da webhook `invoice.payment_failed`)
- Subscription cancellata

---

### 4. Metered Billing (Non Implementato)

**Scenario:** Addebito basato su token consumati invece di flat monthly fee.

**Richiede:**
- Stripe metered billing setup
- Report usage API call dopo ogni chat
- Webhook `invoice.upcoming` per previsioni costo

---

## Troubleshooting

### Problema: Utente ha pagato ma vede "subscription_inactive"

**Causa:** Webhook Stripe non processato o DB non sincronizzato.

**Debug:**
```sql
-- Check subscription DB
SELECT status, currentPeriodEnd FROM subscriptions 
WHERE userId = 'cm123abc';

-- Check Stripe events
SELECT * FROM stripe_events 
WHERE eventType LIKE '%subscription%' 
ORDER BY receivedAt DESC LIMIT 10;
```

**Fix:**
```bash
# Trigger manual sync
curl -X POST http://localhost:3000/api/subscription/sync \
  -H "Cookie: ..."
```

---

### Problema: Webhook processato ma status non aggiornato

**Causa:** Transaction DB fallita o status Stripe inconsistente.

**Debug:**
```bash
# Check Stripe Dashboard
stripe subscriptions retrieve sub_xxxxx

# Compare con DB
SELECT * FROM subscriptions WHERE stripeSubscriptionId = 'sub_xxxxx';
```

**Fix:** Update manuale DB o re-trigger webhook.

---

## E2E Webhook Testing Note

### ⚠️ Limitazioni Testing in Localhost

**Problema:**
I test E2E per cancellazione abbonamento e payment failure **NON possono essere completati** in ambiente development locale senza Stripe CLI forwarding.

**Motivo:**
Stripe webhook delivery richiede URL pubblico. Localhost non riceve eventi come:
- `customer.subscription.deleted` (cancellazione)
- `customer.subscription.updated` (status change)
- `invoice.payment_failed` (pagamento fallito)

**Impatto:**
- Database NON si sincronizza automaticamente
- Entitlement guard NON attivato (status rimane stale)
- Test manuali mostrano PASS su Stripe ma FAIL in app

**Evidenza:**
Vedi `TEST_CANCELLATION_PORTAL.md` - cancellazione confermata su Stripe Customer Portal ma database rimane `status: 'active'`.

### ✅ Soluzione: Test in Cloud Deployment

**Quando deployare in cloud (anche test mode):**
1. Configurare webhook endpoint in Stripe Dashboard (test mode)
2. Ripetere test E2E cancellation e payment failure
3. Verificare sincronizzazione DB e entitlement guard

**Checklist completa:** Vedi `docs/GO_LIVE_CHECKLIST.md` → sezione "Stripe Webhooks (Test Mode in Cloud)"

**Webhook events richiesti:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

### Workaround Development (Temporaneo)

**Opzione 1: Stripe CLI**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Opzione 2: Manual Sync**
Endpoint `/api/subscription/sync` bypassa webhook (già implementato per new subscriptions).

---

## Riferimenti

- **Stripe Subscription Status:** https://stripe.com/docs/api/subscriptions/object#subscription_object-status
- **HTTP Status 402:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402
- **File Implementation:** `lib/entitlement.ts`
- **Go-Live Checklist:** `docs/GO_LIVE_CHECKLIST.md`
- **Test Report:** `TEST_CANCELLATION_PORTAL.md`

---

**Documento aggiornato:** 2026-01-19  
**Owner:** Backend Team  
**Review:** Da schedulare post-MVP launch
