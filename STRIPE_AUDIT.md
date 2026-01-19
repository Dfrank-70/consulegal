# Stripe Subscription & Webhook - Audit Report

**Data Audit:** 19 Gennaio 2026  
**Versione Progetto:** 0.1.0  
**Stripe Mode:** Test (STRIPE_SECRET_KEY_TEST)

---

## 1. File e Route Coinvolte

### File Backend (API Routes)

| File | Route | Metodo | Scopo |
|------|-------|--------|-------|
| `app/api/stripe/checkout-session/route.ts` | `/api/stripe/checkout-session` | POST | Creazione sessione Stripe Checkout |
| `app/api/stripe/webhook/route.ts` | `/api/stripe/webhook` | POST | Ricezione eventi webhook Stripe |
| `app/api/subscription/sync/route.ts` | `/api/subscription/sync` | POST | Sincronizzazione manuale subscription (workaround webhook) |
| `app/api/subscription/route.ts` | `/api/subscription` | GET | Recupero dati subscription utente corrente |
| `app/api/user/subscription-status/route.ts` | `/api/user/subscription-status` | GET | Check hasActiveSubscription (boolean) |
| `app/dashboard/profile/actions.ts` | Server Action | - | Creazione Stripe Customer Portal session |

### File Frontend (Client Components)

| File | Scopo |
|------|-------|
| `app/dashboard/client-layout.tsx` | Auto-sync subscription su ritorno da checkout (useEffect) |
| `app/dashboard/page.tsx` | Visualizzazione piano attivo (server component) |
| `app/dashboard/profile/page.tsx` | Link a Stripe billing portal |
| `app/pricing/page.tsx` | UI selezione piani, trigger checkout |

### File Configurazione

| File | Scopo |
|------|-------|
| `lib/stripe.ts` | Istanza Stripe client (singleton) |
| `config/subscriptions.ts` | Mapping priceId → nome/descrizione piani |
| `prisma/schema.prisma` | Modelli User, Subscription, Plan (DB schema) |

---

## 2. Flusso End-to-End: Checkout → Success → Sync → Update DB

### Scenario A: Flusso Ideale (Webhook Funzionante)

```
1. UTENTE SELEZIONA PIANO
   ↓
   Frontend: POST /api/stripe/checkout-session { priceId }
   ↓
2. CREAZIONE CHECKOUT SESSION
   ├─ Verifica User autenticato (NextAuth session)
   ├─ Recupera/crea Stripe Customer
   │  ├─ Se user.stripeCustomerId esiste → stripe.customers.retrieve()
   │  ├─ Se customer deleted/invalido → stripe.customers.create()
   │  └─ Salva stripeCustomerId in DB (prisma.user.update)
   ├─ Crea Stripe Checkout Session
   │  └─ client_reference_id = user.id (CRITICO per webhook)
   └─ Return: { sessionId, url }
   ↓
3. REDIRECT A STRIPE CHECKOUT
   window.location.href = stripeSession.url
   ↓
4. UTENTE COMPLETA PAGAMENTO
   ↓
5. STRIPE INVIA WEBHOOK
   Event: checkout.session.completed
   ↓
6. WEBHOOK HANDLER (/api/stripe/webhook)
   ├─ Verifica firma webhook (stripe.webhooks.constructEvent)
   ├─ Recupera subscription da Stripe (stripe.subscriptions.retrieve)
   ├─ Chiama manageSubscription(subscription, session.client_reference_id)
   │  └─ Prisma transaction:
   │     ├─ user.update({ stripeCustomerId })
   │     └─ subscription.upsert({ userId, ...subscriptionData })
   └─ Return 200 OK
   ↓
7. STRIPE REDIRECT UTENTE
   → /dashboard?new-subscription=true (success_url)
   ↓
8. AUTO-SYNC CLIENT-SIDE (client-layout.tsx)
   ├─ useEffect rileva ?new-subscription=true
   ├─ fetch POST /api/subscription/sync (safety net)
   ├─ window.location.href = /dashboard (rimuove param)
   └─ Piano attivo visualizzato
```

### Scenario B: Flusso Reale Attuale (Webhook Non Affidabile)

```
1-4. [Identico a Scenario A]
   ↓
5. STRIPE INVIA WEBHOOK
   ❌ PROBLEMA: Webhook fallisce (Stripe CLI disconnesso, secret invalido, ecc.)
   ↓
6. STRIPE REDIRECT UTENTE
   → /dashboard?new-subscription=true
   ↓
7. AUTO-SYNC CLIENT-SIDE (WORKAROUND)
   ├─ useEffect rileva ?new-subscription=true
   ├─ POST /api/subscription/sync
   │  ├─ stripe.customers.list({ email })
   │  ├─ stripe.subscriptions.list({ customer, status: 'active' })
   │  └─ Prisma transaction (identica a webhook)
   ├─ window.location.href = /dashboard
   └─ Piano attivo visualizzato
```

**Key Difference:** Nel Scenario B, la sincronizzazione è **client-triggered** invece di server-triggered (webhook).

---

## 3. Eventi Stripe Gestiti

### Eventi Implementati nel Webhook Handler

| Evento Stripe | Handler | Logica | File |
|---------------|---------|--------|------|
| `checkout.session.completed` | ✅ ATTIVO | Retrieve subscription → manageSubscription(userId da client_reference_id) | `webhook/route.ts:93-114` |
| `customer.subscription.updated` | ✅ ATTIVO | Trova user per stripeCustomerId → manageSubscription() | `webhook/route.ts:116-132` |
| `customer.subscription.deleted` | ✅ ATTIVO | Trova user per stripeCustomerId → manageSubscription() (status='canceled') | `webhook/route.ts:116-132` |
| `invoice.payment_succeeded` | ✅ ATTIVO | Trova user → retrieve subscription → manageSubscription() | `webhook/route.ts:134-158` |
| `invoice_payment.paid` | ✅ ATTIVO | Identico a `invoice.payment_succeeded` | `webhook/route.ts:134-158` |

### Eventi NON Gestiti (ma Rilevanti)

| Evento Stripe | Impatto Business | Priorità |
|---------------|------------------|----------|
| `customer.subscription.trial_will_end` | Notifica utente trial in scadenza | P2 - UX |
| `invoice.payment_failed` | Blocca servizio, notifica fallimento pagamento | **P0 - CRITICO** |
| `customer.subscription.paused` | Gestione pause subscription | P3 - Edge case |
| `customer.deleted` | Cleanup DB, invalidare subscription | P2 - Data integrity |
| `payment_method.detached` | Notifica problema metodo pagamento | P1 - Retention |

---

## 4. Sicurezza, Idempotenza, Update DB

### (a) Verifica Firma Webhook

**✅ IMPLEMENTATA CORRETTAMENTE**

```typescript
// webhook/route.ts:69-87
const signature = req.headers.get('Stripe-Signature') as string;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST || 
                      process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  return new NextResponse('Webhook secret not configured', { status: 500 });
}

try {
  event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
} catch (err: any) {
  return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
}
```

**Punti di Forza:**
- Usa `stripe.webhooks.constructEvent()` (verifica HMAC signature)
- Fallisce fast con 400 se signature invalida
- Controlla presenza webhook secret in env

**Punti di Debolezza:**
- Fallback `STRIPE_WEBHOOK_SECRET` (live) non documentato, può causare confusion test/live
- Nessun logging strutturato degli errori di signature

---

### (b) Idempotenza / Deduplication

**❌ NON IMPLEMENTATA**

**Problema:** Stripe può inviare lo stesso evento webhook **più volte** (retry automatico dopo failure). Senza idempotenza, si rischia:
- Chiamate multiple a `manageSubscription()`
- Race condition su `subscription.upsert()`
- Log duplicati

**Evidenze nel Codice:**
```typescript
// webhook/route.ts - NESSUN CHECK event.id
switch (event.type) {
  case 'checkout.session.completed': {
    await manageSubscription(...); // Eseguito ogni volta
  }
}
```

**Best Practice Stripe:** Salvare `event.id` in DB e skippare se già processato.

**Mitigazione Parziale Attuale:**
- `subscription.upsert()` previene duplicati subscription per user
- MA: se webhook arriva mentre `/api/subscription/sync` è in corso → race condition possibile

---

### (c) Aggiornamento Stato Subscription nel DB

**✅ IMPLEMENTATO CON TRANSACTION**

**Funzione Core:** `manageSubscription()` (webhook/route.ts:11-64)

```typescript
async function manageSubscription(subscription: Stripe.Subscription, userId: string) {
  const subscriptionData = {
    userId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id,
    stripeProductId: subscription.items.data[0]?.price.product,
    status: subscription.status, // 'active', 'canceled', 'past_due', ...
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  await prisma.$transaction(async (tx) => {
    // 1. Update User con stripeCustomerId
    await tx.user.update({
      where: { id: userId },
      data: { stripeCustomerId: subscription.customer as string },
    });

    // 2. Upsert Subscription (create or update)
    await tx.subscription.upsert({
      where: { userId },
      create: subscriptionData,
      update: subscriptionData,
    });
  });
}
```

**Punti di Forza:**
- **Atomicità:** Transaction garantisce update user + subscription insieme o rollback completo
- **Upsert pattern:** Gestisce creazione e aggiornamento con singola query
- **Gestione errori:** Try/catch logga fallimenti transaction

**Punti di Debolezza:**
- **Campi mancanti:** Non salva `trialStart`, `trialEnd`, `canceledAt`, `endedAt` (presenti in schema ma non popolati)
- **Nessuna validazione `status`:** Accetta qualsiasi valore Stripe senza enum check
- **Nessuna notifica:** Utente non riceve email/notifica su cambio stato subscription
- **Log verboso:** 6 console.log per transaction

**Edge Case Critico:**
Se `client_reference_id` manca in checkout session → webhook fallisce silenziosamente (solo warning logged).

---

## 5. Gap per Andare Live (Production)

### 🔴 Blockers Critici (P0)

| Gap | Impatto | Azione Richiesta |
|-----|---------|------------------|
| **1. Webhook Live URL non configurato** | Subscription non sincronizzate in prod | Configurare endpoint Stripe Dashboard |
| **2. STRIPE_SECRET_KEY_TEST hardcoded** | Usa test secret in produzione | Aggiungere `STRIPE_SECRET_KEY` env var |
| **3. Nessuna gestione `invoice.payment_failed`** | Utenti con payment failed continuano a usare servizio | Aggiungere case nel webhook handler |
| **4. Nessuna idempotenza webhook** | Eventi duplicati → race conditions | Implementare StripeEvent deduplication |
| **5. NEXT_PUBLIC_APP_URL non configurato** | Billing portal redirect fallisce | Aggiungere env var production |

### 🟠 Problemi Maggiori (P1)

| Gap | Impatto |
|-----|---------|
| **6. Nessun rate limiting webhook** | Abuse/DoS possibile |
| **7. Campi subscription non popolati** | `trialStart`, `canceledAt` sempre null |
| **8. Nessun logging strutturato** | Debugging production impossibile |
| **9. Hard refresh richiesto post-sync** | UX poor (window.location.href) |
| **10. Nessun test webhook** | Deploy blind senza validazione |

### 🟡 Miglioramenti (P2)

- Nessuna notifica email utente
- Multi-subscription non supportata
- Token limit non enforced
- Nessun retry logic webhook failure
- Stripe API version hardcoded `2024-06-20`

---

## 6. Piano Modifiche Minime (Production-Ready)

### ✅ Modifica 1: Implementare Idempotenza Webhook

**File da modificare:**
1. `prisma/schema.prisma` - Aggiungere modello `StripeEvent`
2. `app/api/stripe/webhook/route.ts` - Aggiungere deduplication logic

**Codice da aggiungere:**

```prisma
// schema.prisma
model StripeEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique // Stripe event.id
  eventType   String
  processed   Boolean  @default(true)
  receivedAt  DateTime @default(now())
  
  @@index([eventType, receivedAt])
}
```

```typescript
// webhook/route.ts - DOPO verifica signature
const existingEvent = await prisma.stripeEvent.findUnique({
  where: { eventId: event.id }
});
if (existingEvent) {
  console.log(`Event ${event.id} already processed`);
  return new NextResponse(null, { status: 200 });
}

// ... processamento evento ...

// PRIMA di return 200
await prisma.stripeEvent.create({
  data: { eventId: event.id, eventType: event.type }
});
```

---

### ✅ Modifica 2: Gestire `invoice.payment_failed`

**File da modificare:**
1. `app/api/stripe/webhook/route.ts`

**Codice da aggiungere:**

```typescript
case 'invoice.payment_failed': {
  console.log('❌ Invoice payment failed event received');
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;
  
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, email: true },
  });

  if (user) {
    // Opzione A: Bloccare accesso (set status = 'past_due')
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { status: 'past_due' }
    });
    
    // TODO: Inviare email notifica fallimento pagamento
    console.log(`⚠️ Payment failed for user ${user.id}`);
  }
  break;
}
```

---

### ✅ Modifica 3: Configurare Environment Variables Production

**File da modificare:**
1. `.env.production` (creare se non esiste)
2. `lib/stripe.ts`

**Environment Variables da aggiungere:**

```bash
# .env.production
STRIPE_SECRET_KEY=sk_live_xxxxx  # Live secret key
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # Live webhook secret
NEXT_PUBLIC_APP_URL=https://tuodominio.com
```

**Codice da modificare (lib/stripe.ts):**

```typescript
const stripeKey = process.env.NODE_ENV === 'production'
  ? process.env.STRIPE_SECRET_KEY
  : process.env.STRIPE_SECRET_KEY_TEST;

if (!stripeKey) {
  throw new Error('Stripe secret key not configured');
}

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-06-20" as any,
  typescript: true,
});
```

---

### ✅ Modifica 4: Popolare Campi Subscription Mancanti

**File da modificare:**
1. `app/api/stripe/webhook/route.ts` (funzione `manageSubscription`)

**Codice da modificare:**

```typescript
const subscriptionData = {
  userId,
  stripeSubscriptionId: subscription.id,
  stripePriceId: priceId,
  stripeProductId: productId,
  status: subscription.status,
  currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
  currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
  cancelAtPeriodEnd: subscription.cancel_at_period_end,
  
  // AGGIUNGERE:
  trialStart: subscription.trial_start 
    ? new Date(subscription.trial_start * 1000) 
    : null,
  trialEnd: subscription.trial_end 
    ? new Date(subscription.trial_end * 1000) 
    : null,
  canceledAt: subscription.canceled_at 
    ? new Date(subscription.canceled_at * 1000) 
    : null,
  endedAt: subscription.ended_at 
    ? new Date(subscription.ended_at * 1000) 
    : null,
};
```

---

### ✅ Modifica 5: Migliorare UX Post-Sync (Eliminare Hard Refresh)

**File da modificare:**
1. `app/dashboard/client-layout.tsx`

**Codice da modificare:**

```typescript
// RIMUOVERE: window.location.href = url.toString();

// SOSTITUIRE CON:
router.push('/dashboard'); // Soft navigation
router.refresh(); // Server component re-fetch
```

**Benefici:**
- Nessun page reload completo
- Mantiene scroll position
- Migliore UX

---

## Riepilogo Piano Modifiche

| Modifica | File | Priorità | Effort |
|----------|------|----------|--------|
| 1. Idempotenza webhook | `schema.prisma`, `webhook/route.ts` | P0 | 2h |
| 2. Gestire payment_failed | `webhook/route.ts` | P0 | 1h |
| 3. Env vars production | `.env.production`, `lib/stripe.ts` | P0 | 30min |
| 4. Popolare campi subscription | `webhook/route.ts` | P1 | 30min |
| 5. UX post-sync | `client-layout.tsx` | P1 | 15min |

**Totale Effort:** ~4.5 ore  
**Blockers Risolti:** 4/5 (manca solo configurazione Stripe Dashboard)

---

## Checklist Pre-Deploy Production

- [ ] Webhook endpoint configurato in Stripe Dashboard
- [ ] `STRIPE_SECRET_KEY` (live) in env vars
- [ ] `STRIPE_WEBHOOK_SECRET` (live) testato con Stripe CLI
- [ ] Test manuale checkout production
- [ ] Test webhook con Stripe CLI (`stripe trigger checkout.session.completed`)
- [ ] Verificare idempotenza (inviare stesso evento 2 volte)
- [ ] Test payment_failed scenario
- [ ] Configurare monitoring (Sentry webhook errors)
- [ ] Documentare processo rollback subscription
- [ ] Test billing portal link

---

**Report compilato:** 2026-01-19  
**Prossimo step:** Implementare Modifiche 1-3 (P0) prima di deploy production
