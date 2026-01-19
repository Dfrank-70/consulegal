---
**Documento:** Go-Live Checklist - ConsuLegal MVP
**Data:** 19 Gennaio 2026
**Contesto:** Checklist deployment cloud (production e test mode)
---

# Go-Live Checklist - ConsuLegal MVP

## Pre-Deployment

### Environment Variables
- [ ] `NEXT_PUBLIC_APP_URL` impostato su URL pubblico
- [ ] `DATABASE_URL` configurato con production database
- [ ] `NEXTAUTH_SECRET` generato (crypto-random, 32+ chars)
- [ ] `STRIPE_SECRET_KEY` e `STRIPE_SECRET_KEY_TEST` configurati
- [ ] `OPENAI_API_KEY` configurato
- [ ] `CHAT_RPM`, `MAX_INPUT_TOKENS`, `MAX_FILE_BYTES` verificati

### Database
- [ ] Migration Prisma eseguite (`npx prisma migrate deploy`)
- [ ] Seeding piani subscription completato
- [ ] Indici pgvector e pg_trgm creati
- [ ] Backup policy configurata

---

## Stripe Webhooks (Test Mode in Cloud)

### ⚠️ Problema: Localhost Non Riceve Webhooks

**Contesto:**
In ambiente development locale, i webhook Stripe **NON funzionano** senza Stripe CLI forwarding.
Questo impedisce la sincronizzazione automatica di:
- Cancellazioni abbonamento (`customer.subscription.deleted`)
- Aggiornamenti stato (`customer.subscription.updated`)
- Pagamenti falliti (`invoice.payment_failed`)

**Impatto:**
I seguenti test E2E **NON possono essere completati** in localhost:
- Test 4: Payment failure → accesso bloccato
- Test 5: Cancellazione abbonamento → accesso revocato

**Evidenza:**
Vedi `TEST_CANCELLATION_PORTAL.md` - cancellazione confermata su Stripe ma DB non sincronizzato.

---

### ✅ Azione Richiesta: Configurare Webhook in Cloud (Test Mode)

**QUANDO:** Dopo primo deploy su URL pubblico (anche in Stripe test mode)

**STEP:**

1. **Accedere Stripe Dashboard (Test Mode)**
   - https://dashboard.stripe.com/test/webhooks

2. **Aggiungere Endpoint**
   - Click "Add endpoint"
   - URL: `https://your-app.vercel.app/api/stripe/webhook`
   - Eventi da selezionare:
     - ✅ `checkout.session.completed`
     - ✅ `customer.subscription.created`
     - ✅ `customer.subscription.updated`
     - ✅ `customer.subscription.deleted`
     - ✅ `invoice.payment_succeeded`
     - ✅ `invoice.paid`
     - ✅ `invoice.payment_failed`

3. **Copiare Webhook Secret**
   - Stripe mostra `whsec_...` dopo creazione endpoint
   - Aggiungere a environment variables: `STRIPE_WEBHOOK_SECRET` (test mode)

4. **Verificare Signature Verification**
   ```typescript
   // app/api/stripe/webhook/route.ts
   const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
   // ✅ Già implementato
   ```

5. **Test Webhook Delivery**
   - Click "Send test webhook" in Stripe dashboard
   - Verificare log server: "✅ Event {id} registered for processing"

---

### 🧪 Test E2E da Ripetere in Cloud

**DOPO configurazione webhook, ripetere:**

#### Test 5: Cancellazione Abbonamento
**Steps:**
1. Login con utente subscription active
2. `/dashboard/profile` → "Gestisci Abbonamento su Stripe"
3. Stripe Customer Portal → "Annulla abbonamento"
4. Confermare cancellazione
5. Return to app → **refresh dashboard**
6. Verificare stato subscription aggiornato
7. Tentare chat POST `/api/chat`

**Criterio Successo:**
- ✅ DB status: `canceled` (non più `active`)
- ✅ Chat response: **402 Payment Required**
- ✅ JSON error: `{error: 'subscription_inactive', reason: 'subscription_canceled'}`
- ⚠️ **Accesso consentito fino a fine periodo** (policy attuale: `currentPeriodEnd`)

**Policy Entitlement (da `lib/entitlement.ts`):**
```typescript
// Subscription canceled MA ancora valida fino a currentPeriodEnd
if (status === 'canceled' && new Date() < currentPeriodEnd) {
  return { entitled: true, reason: 'grace_period' };
}

// Dopo currentPeriodEnd → blocked
return { entitled: false, reason: 'subscription_canceled' };
```

#### Test 4: Payment Failed
**Steps:**
1. Usare carta test Stripe: `4000 0000 0000 9995` (insufficient funds)
2. Subscription in `past_due` dopo failed payment
3. Webhook `invoice.payment_failed` ricevuto
4. Verificare DB status aggiornato
5. Tentare chat POST `/api/chat`

**Criterio Successo:**
- ✅ DB status: `past_due`
- ✅ Chat response: **402 Payment Required**
- ✅ JSON error: `{error: 'subscription_inactive', reason: 'subscription_past_due'}`

**Carta Test per altri scenari:**
- Generic decline: `4000 0000 0000 0002`
- Expired card: `4000 0000 0000 0069`

Vedi: `STRIPE_TEST_CARDS.md`

---

### 📊 Monitoraggio Post-Deploy

**Stripe Dashboard → Developers → Webhooks:**
- [ ] Verificare "Success rate" > 95%
- [ ] Controllare "Failed" events e retry automatici
- [ ] Log eventi processati: console output "✅ Event ... processed"

**Database:**
- [ ] Tabella `StripeEvent`: eventi registrati con `processed: true`
- [ ] Tabella `Subscription`: status allineati con Stripe API

**Entitlement Guard:**
- [ ] `/api/chat` blocca status non-entitled (402)
- [ ] Log console: "🚫 Subscription inactive for user..."

---

### 🔧 Troubleshooting

**Se webhook non arriva:**
1. Verificare URL endpoint pubblico (no localhost)
2. Controllare signature secret in env variables
3. Stripe Dashboard → Event log → delivery attempts
4. Verificare firewall/CORS settings

**Se DB non si aggiorna:**
1. Controllare log server per errori Prisma
2. Verificare `StripeEvent.processed = true` dopo processing
3. Test manual sync: POST `/api/subscription/sync`

**Workaround temporaneo (solo dev):**
- Endpoint `/api/subscription/sync` bypassa webhook
- Chiamato automaticamente su `?new-subscription=true` redirect
- Vedi: `PROBLEMI_NOTI.md`

---

## Production Deployment (Stripe Live Mode)

### Webhook Configuration (LIVE)
- [ ] Ripetere setup webhook in **Live Mode** Stripe Dashboard
- [ ] URL: `https://your-app.com/api/stripe/webhook`
- [ ] Stessi eventi selezionati
- [ ] **Nuovo** webhook secret: `STRIPE_WEBHOOK_SECRET` (live)
- [ ] Environment variable separata per live vs test

### Security
- [ ] Verificare signature verification attiva
- [ ] Rate limiting configurato
- [ ] HTTPS obbligatorio (Stripe requirement)
- [ ] Environment secrets non in git (.env.local gitignored)

### Testing Live Mode
- [ ] Test checkout con carta reale (self-test, $1 subscription)
- [ ] Verificare webhook delivery in live mode
- [ ] Test cancellation flow end-to-end
- [ ] Verificare fatture generate correttamente

---

## Post Go-Live

### Monitoring
- [ ] Sentry/error tracking configurato
- [ ] Stripe webhook monitoring dashboard
- [ ] Database backup automatico attivo
- [ ] Log aggregation (Vercel logs, Datadog, etc.)

### Documentation
- [ ] README aggiornato con setup instructions
- [ ] API docs (se pubbliche)
- [ ] User guide per Stripe Customer Portal

### Rollback Plan
- [ ] Database snapshot pre-deploy
- [ ] Vercel deployment rollback strategy
- [ ] Stripe webhook disable procedure (se necessario)

---

## Riferimenti

- `TEST_CANCELLATION_PORTAL.md` - Test E2E cancellation (PARTIAL PASS in localhost)
- `MVP_E2E_TEST_REPORT.md` - Test coverage completo (8/8 logic verified)
- `docs/SUBSCRIPTION_POLICY.md` - Entitlement rules
- `docs/RATE_LIMITING.md` - API guardrails
- `STRIPE_TEST_CARDS.md` - Carte test per scenari failure
- `PROBLEMI_NOTI.md` - Workaround subscription sync
