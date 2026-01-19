# TODO - ConsuLegal MVP

**Data creazione:** 19 Gennaio 2026  
**Priorità ordinata per deployment**

---

## 🔴 CRITICAL - Pre-Production Deployment

### 1. Stripe Webhooks Configuration (Cloud Test Mode)

**Status:** ⚠️ BLOCKED fino a deploy su URL pubblico

**Problema:**
Test E2E per cancellazione abbonamento e payment failure NON completabili in localhost (webhook delivery richiede URL pubblico).

**Azione Richiesta:**
Dopo primo deploy su Vercel/cloud (anche in test mode):
1. Configurare webhook endpoint in Stripe Dashboard (test mode)
2. Aggiungere `STRIPE_WEBHOOK_SECRET` a environment variables
3. Ripetere test E2E: cancellation + payment_failed
4. Verificare sincronizzazione DB e entitlement guard funzionanti

**Dettagli completi:**
→ `docs/GO_LIVE_CHECKLIST.md` - sezione "Stripe Webhooks (Test Mode in Cloud)"

**Test da ripetere:**
- Test 4: Payment failure → 402 block
- Test 5: Subscription cancellation → 402 block (dopo currentPeriodEnd)

**Evidenza issue:**
→ `TEST_CANCELLATION_PORTAL.md` (PARTIAL PASS: cancellation OK su Stripe, DB non sincronizzato)

**Webhook events richiesti:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

---

## 🟡 HIGH PRIORITY - Performance & Stability

### 2. RAG Upload OOM Fix

**Status:** 🔧 Fix implementato, da testare con file >10KB

**Problema:**
Upload documenti PDF >1KB causa OOM durante embedding generation.

**Fix Implementato:**
- Infinite loop fix in `lib/rag/chunker.ts`
- Verificato: 500B, 1KB, 2KB, 3KB, 6KB upload OK

**TODO:**
- [ ] Test file 10KB, 50KB, 100KB
- [ ] Batch processing embeddings (gruppi 5 chunks)
- [ ] Limit max file size a 2MB

**Riferimento:**
→ Memory system: "Root cause RAG upload OOM"

---

## 🟢 MEDIUM PRIORITY - Features & Enhancements

### 3. Grace Period Post-Cancellation

**Status:** 📝 Documentato, non implementato

**Current Behavior:**
Subscription `canceled` → accesso bloccato immediatamente.

**Desired:**
Accesso fino a `currentPeriodEnd` (già pagato).

**Implementation:**
```typescript
// lib/entitlement.ts
if (status === 'canceled' && now < currentPeriodEnd) {
  return { entitled: true, reason: 'grace_period' };
}
```

**Riferimento:**
→ `docs/SUBSCRIPTION_POLICY.md` - sezione "Future Enhancements"

---

### 4. Metered Billing (Post-MVP)

**Status:** 💡 Idea per futuro

**Scenario:**
Addebito basato su token consumati invece di flat fee mensile.

**Richiede:**
- Stripe metered billing setup
- Usage reporting API
- Token tracking per utente/mese

---

## 🔵 LOW PRIORITY - UI/UX Polish

### 5. Subscription Status Dashboard Widget

**Status:** 📋 To be designed

**Feature:**
Widget in dashboard che mostra:
- Piano attivo
- Scadenza/rinnovo
- Token usage corrente (se implementato metering)
- Link rapido a Stripe Customer Portal

---

### 6. Email Notifications

**Status:** 🚫 Non implementato

**Trigger:**
- Trial scade in 3 giorni
- Payment failed
- Subscription cancellata

---

## ✅ COMPLETED

### ✓ Economic Guardrails Implementation
- [x] Rate limiting (`CHAT_RPM`)
- [x] Token limit (`MAX_INPUT_TOKENS`)
- [x] File upload limit (`MAX_FILE_BYTES`)
- [x] Entitlement guard (subscription-based)

**Data:** 19 Gennaio 2026  
**Test Coverage:** 8/8 (100%) - 5 E2E + 3 code verified

**Report:** `MVP_E2E_TEST_REPORT.md`

---

### ✓ Stripe Webhook Implementation (Localhost)
- [x] Idempotency (concurrency-safe)
- [x] Event handlers (6 eventi)
- [x] Signature verification
- [x] Transaction safety

**Data:** 19 Gennaio 2026  
**Status:** ✅ Code ready, ⚠️ deployment configuration pending

---

## Riferimenti Documentazione

- `docs/GO_LIVE_CHECKLIST.md` - Deployment checklist completa
- `docs/SUBSCRIPTION_POLICY.md` - Entitlement rules + E2E testing notes
- `docs/RATE_LIMITING.md` - API guardrails
- `MVP_E2E_TEST_REPORT.md` - Test coverage 8/8
- `TEST_CANCELLATION_PORTAL.md` - Cancellation E2E (PARTIAL PASS)
- `STRIPE_TEST_CARDS.md` - Test cards reference
- `PROBLEMI_NOTI.md` - Known issues + workarounds

---

**Last Updated:** 19 Gennaio 2026, 22:00  
**Next Review:** Post first cloud deployment
