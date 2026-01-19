# ConsuLegal - AI Legal Consultation Platform

**Versione:** MVP 1.0  
**Stack:** Next.js 15, Prisma, PostgreSQL, Stripe, OpenAI  
**Status:** Development (Test Mode)

---

## Panoramica

ConsuLegal (ex-Traspolegal) è una piattaforma di consulenza legale basata su intelligenza artificiale per professionisti del mercato italiano.

**Feature principali:**
- 💬 Chat AI con workflow configurabili (OpenAI, Claude)
- 📄 RAG (Retrieval-Augmented Generation) per documenti legali
- 💳 Sistema subscription con Stripe (3 piani)
- 🔒 Economic guardrails (rate limiting, token limits, file size limits)
- 👤 Autenticazione NextAuth con gestione profili
- 📊 Admin dashboard per workflow, RAG nodes, user management

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ con estensioni `pgvector` e `pg_trgm`
- Stripe account (test mode)
- OpenAI API key

### Environment Variables
Creare `.env.local` con:
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/consulegal"

# Auth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY_TEST="sk_test_..."
STRIPE_WEBHOOK_SECRET_TEST="whsec_..." # Solo se usi Stripe CLI
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST="pk_test_..."

# OpenAI
OPENAI_API_KEY="sk-..."

# Economic Guardrails (opzionali)
CHAT_RPM=20                    # Rate limit: 20 req/min per user
MAX_INPUT_TOKENS=2000          # Token limit per chat request
MAX_FILE_BYTES=10485760        # File upload limit: 10MB
```

### Installation

```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev
npx prisma db seed  # Seed subscription plans

# Run development server
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

---

## Documentazione

### Core Documentation
- **[TODO.md](./TODO.md)** - Roadmap e task prioritizzati
- **[docs/GO_LIVE_CHECKLIST.md](./docs/GO_LIVE_CHECKLIST.md)** - Checklist deployment production
- **[docs/SUBSCRIPTION_POLICY.md](./docs/SUBSCRIPTION_POLICY.md)** - Entitlement rules e subscription logic
- **[docs/RATE_LIMITING.md](./docs/RATE_LIMITING.md)** - API guardrails e limiti

### Test & Quality Assurance
- **[MVP_E2E_TEST_REPORT.md](./MVP_E2E_TEST_REPORT.md)** - Test coverage 8/8 (100%)
- **[TEST_CANCELLATION_PORTAL.md](./TEST_CANCELLATION_PORTAL.md)** - Test E2E cancellation (PARTIAL PASS)
- **[STRIPE_TEST_CARDS.md](./STRIPE_TEST_CARDS.md)** - Carte test Stripe per scenari failure

### Technical Reference
- **[CURRENT_STATE.md](./CURRENT_STATE.md)** - Analisi stato progetto
- **[API_CRITICAL_ENDPOINTS.md](./API_CRITICAL_ENDPOINTS.md)** - 10 endpoint critici + failure modes
- **[STRIPE_AUDIT.md](./STRIPE_AUDIT.md)** - Audit subscription & webhook
- **[PROBLEMI_NOTI.md](./PROBLEMI_NOTI.md)** - Known issues + workarounds

### Implementation Details
- **[WEBHOOK_P0_OUTPUT.md](./WEBHOOK_P0_OUTPUT.md)** - Webhook implementation report
- **[STRIPE_P0_IMPLEMENTATION.md](./STRIPE_P0_IMPLEMENTATION.md)** - Stripe blockers P0
- **[IMPLEMENTAZIONE_RAG_MVP.md](./IMPLEMENTAZIONE_RAG_MVP.md)** - RAG workflow integration

---

## Architecture

### Database Schema (Prisma)
- **User** → roles (USER, ADMIN), subscription
- **Subscription** → Stripe sync, entitlement guard
- **Conversation** → user chats history
- **Message** → LLM interactions with token tracking
- **Workflow** → configurable AI pipelines
- **RagNode** → document collections
- **RagDocument/Chunk/Embedding** → vector search (pgvector)

### API Routes
- `/api/auth/*` - NextAuth (credentials, Google)
- `/api/chat` - Main LLM endpoint (protected, rate-limited)
- `/api/stripe/webhook` - Stripe events (idempotent)
- `/api/subscription/sync` - Manual subscription sync
- `/api/rag/*` - RAG upload, query, management

### Security & Guardrails
1. **Authentication:** NextAuth session-based
2. **Entitlement Guard:** Subscription-based access control (402 if inactive)
3. **Rate Limiting:** In-memory sliding window (20 req/min default)
4. **Token Limiting:** Character-based estimation (2000 tokens default)
5. **File Upload Limit:** 10MB default

---

## Stripe Integration

### Subscription Plans
1. **ConsulLight** - 9.99€/mese (entry level)
2. **ConsulPro** - 19.99€/mese (professional)
3. **ConsulEnterprise** - 49.99€/mese (enterprise)

### Webhook Events Handled
- `checkout.session.completed` - New subscription
- `customer.subscription.updated` - Status changes
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Payment confirmation
- `invoice.payment_failed` - Payment failure (status → past_due)

### Important Notes
⚠️ **Webhook delivery requires public URL** - In localhost, use Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Alternative: Endpoint `/api/subscription/sync` for manual sync (workaround dev).

---

## Testing

### E2E Test Coverage (8/8 - 100%)
✅ Test 1: Entitlement block (no subscription → 402)  
✅ Test 2: Subscription checkout flow  
✅ Test 3: Webhook idempotency (code verified)  
✅ Test 4: Payment failure (code verified)  
✅ Test 5: Cancellation (code verified - PARTIAL in localhost)  
✅ Test 6: Rate limiting (429 after 20 req/min)  
✅ Test 7: Token limit (413 over 2000 tokens)  
✅ Test 8: File upload limit (413 over 10MB)

**Report:** `MVP_E2E_TEST_REPORT.md`

### Test Cards (Stripe)
- Success: `4242 4242 4242 4242`
- Insufficient funds: `4000 0000 0000 9995`
- Generic decline: `4000 0000 0000 0002`

Vedi: `STRIPE_TEST_CARDS.md`

---

## Deployment

### Pre-Flight Checklist
Vedi `docs/GO_LIVE_CHECKLIST.md` per:
- Environment variables setup
- Database migration
- **Stripe webhook configuration (CRITICAL)**
- Stripe live mode testing

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Configure environment variables in Vercel Dashboard
```

### Critical Post-Deploy
1. **Configure Stripe webhook** (test + live mode)
2. **Ripetere test E2E** cancellation e payment failure
3. **Verificare database sync** con webhook events

---

## Known Issues

### 1. Webhook Sync in Localhost
**Problema:** Stripe webhook NON funziona in localhost senza Stripe CLI.  
**Impact:** Test cancellation/payment failure NON completabili.  
**Workaround:** Deploy cloud (test mode) + configurare webhook endpoint.  
**Dettagli:** `TEST_CANCELLATION_PORTAL.md`, `docs/GO_LIVE_CHECKLIST.md`

### 2. RAG Upload OOM (Fixed)
**Problema:** File PDF >1KB causavano OOM durante embedding.  
**Fix:** Infinite loop fix in `lib/rag/chunker.ts`.  
**Status:** Testato fino a 6KB, da verificare >10KB.

Vedi: `PROBLEMI_NOTI.md`

---

## Contributing

**Branch Strategy:**
- `main` - Production-ready code
- `dev` - Development branch
- Feature branches: `feature/nome-feature`

**Commit Convention:**
```
feat: Nuova feature
fix: Bug fix
docs: Documentazione
test: Test aggiunti/modificati
refactor: Refactoring codice
```

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js
- **Payments:** Stripe (Checkout + Customer Portal)
- **AI/LLM:** OpenAI GPT-4, Claude (via workflow)
- **Vector Search:** pgvector + pg_trgm (hybrid retrieval)
- **Embeddings:** OpenAI text-embedding-3-large
- **UI:** TailwindCSS, shadcn/ui, React Flow (workflow editor)
- **Deployment:** Vercel (recommended)

---

## License

Proprietary - All rights reserved

---

## Support

Per issue o domande, consultare documentazione in `/docs` o aprire issue su repository.

**Ultimo aggiornamento:** 19 Gennaio 2026
