# CURRENT_STATE - Analisi Progetto Traspolegal/ConsuLegal

**Data Analisi:** 19 Gennaio 2026  
**Versione:** 0.1.0  
**Branch:** main

---

## 1. Descrizione Generale del Sistema

### Scopo dell'Applicazione
Traspolegal (precedentemente ConsuLegal) è una **piattaforma SaaS di consulenza legale potenziata da AI** che combina:
- Chat assistita da LLM multi-provider (OpenAI, Anthropic Claude)
- Sistema RAG (Retrieval-Augmented Generation) per interrogazione documenti legali
- Workflow visuali componibili per automatizzare processi legali complessi
- Sistema di abbonamenti a pagamento tramite Stripe

### Tipo di Utenti Previsti
1. **PRIVATE (Privati):** Cittadini che necessitano consulenza legale occasionale
2. **COMPANY (Aziende):** PMI e studi legali che richiedono supporto AI continuativo
3. **ADMIN:** Gestori della piattaforma con accesso a configurazioni LLM, workflow, RAG e monitoraggio utenti

### Flusso Principale di Utilizzo
```
1. Registrazione utente (privato/azienda con dati fatturazione)
2. Login → Redirect dashboard
3. Acquisto piano (ConsulLight/Pro/Expert) via Stripe Checkout
4. Sincronizzazione automatica abbonamento al ritorno da Stripe
5. Chat con AI:
   - Invio messaggio testuale
   - (Opzionale) Allegare documenti PDF/DOCX/DOC
   - L'AI risponde utilizzando:
     * LLM configurato (OpenAI/Claude)
     * (Opzionale) Workflow personalizzato
     * (Opzionale) Knowledge base RAG
6. Cronologia conversazioni salvata e navigabile
7. (Admin) Configurazione provider LLM, creazione workflow, gestione nodi RAG
```

---

## 2. Architettura Attuale

### Componenti/Moduli Principali

#### Frontend (Next.js 15 App Router)
```
app/
├── page.tsx                    # Landing page marketing
├── login/                      # Autenticazione (NextAuth.js)
├── register/                   # Registrazione utente (privato/azienda)
├── dashboard/
│   ├── page.tsx               # Chat interface principale
│   ├── plans/                 # Pagina selezione piani
│   ├── profile/               # Gestione profilo utente
│   ├── admin/
│   │   ├── page.tsx          # Dashboard amministratore
│   │   ├── workflows/        # Editor workflow (ReactFlow)
│   │   ├── providers/        # Configurazione LLM providers
│   │   ├── rag/              # Gestione nodi RAG
│   │   ├── user-management/  # Gestione utenti
│   │   └── monitoring/       # Log e performance
└── api/
    ├── chat/                  # Endpoint conversazioni
    ├── stripe/                # Checkout e webhook
    ├── subscription/sync/     # Sincronizzazione abbonamenti
    ├── rag/                   # Upload documenti e retrieval
    ├── admin/                 # API gestione workflow/provider
    └── auth/                  # NextAuth handlers
```

#### Backend (Next.js API Routes)
```
lib/
├── workflow-executor.ts       # Esecuzione workflow multi-nodo
├── rag/
│   ├── parser.ts             # Parsing PDF/DOCX/DOC (pdftotext, mammoth, word-extractor)
│   ├── chunker.ts            # Text chunking con overlap
│   ├── embeddings.ts         # OpenAI embeddings (text-embedding-3-large)
│   ├── retrieval.ts          # Hybrid search (pgvector + pg_trgm)
│   └── ingestPipeline.ts     # Orchestrazione upload → parse → chunk → embed
├── stripe.ts                  # Client Stripe configurato
├── subscription.ts            # Helpers recupero subscription
└── llm-costs.ts              # Calcolo costi token per provider
```

#### Database (PostgreSQL + Prisma)
**14 modelli principali:**
- **User:** Utenti (privati/aziende) con dati fatturazione
- **Conversation/Message:** Cronologia chat con token tracking
- **Subscription:** Abbonamenti Stripe con token limit
- **Plan:** Definizione piani tariffari
- **TokenUsage:** Tracking utilizzo giornaliero
- **Workflow/WorkflowNode/WorkflowEdge:** Definizione workflow visuali
- **WorkflowExecutionLog:** Log esecuzioni workflow
- **LLMProvider:** Configurazione provider AI (OpenAI, Anthropic)
- **RagNode/RagDocument/RagChunk/RagEmbedding:** Sistema RAG completo

**Estensioni PostgreSQL:**
- `pgvector` per similarity search su embeddings 3072D
- `pg_trgm` per full-text search trigram-based

### Responsabilità di Ciascun Componente

| Componente | Responsabilità |
|------------|----------------|
| **app/page.tsx** | Landing page marketing, redirect utenti non autenticati |
| **app/dashboard/page.tsx** | Wrapper chat interface, verifica subscription attiva |
| **components/chat/chat-interface.tsx** | UI conversazioni, invio messaggi, allegati, streaming AI |
| **app/api/chat/route.ts** | Coordinamento: parsing file → workflow execution → LLM call → salvataggio DB |
| **lib/workflow-executor.ts** | Grafo esecuzione: input → LLM(s) → RAG → output, tracking token/costi |
| **lib/rag/** | Pipeline completa: file → text → chunks → embeddings → retrieval |
| **app/api/stripe/** | Gestione checkout + webhook (sincronizzazione abbonamenti) |
| **app/api/subscription/sync/** | Sincronizzazione manuale/automatica abbonamenti Stripe ↔ DB |
| **app/dashboard/admin/** | CRUD workflow, provider, utenti, RAG nodes |
| **auth.ts (NextAuth)** | Autenticazione credentials, session management |
| **middleware.ts** | Protezione route autenticate, redirect /dashboard |

### Dipendenze tra Moduli (Chi Chiama Chi)

```
Frontend (Browser)
  ↓
app/dashboard/page.tsx (Server Component)
  ↓
components/chat/chat-interface.tsx (Client Component)
  ↓ POST /api/chat
app/api/chat/route.ts
  ├→ lib/workflow-executor.ts
  │   ├→ OpenAI SDK / Anthropic SDK
  │   └→ lib/rag/retrieval.ts (se workflow contiene nodo RAG)
  │       └→ Prisma (query pgvector + pg_trgm)
  ├→ extractTextFromFile() → pdf2json/mammoth/word-extractor
  └→ Prisma (salvataggio Conversation/Message/TokenUsage)
  
Stripe Checkout
  ↓ redirect success_url=/dashboard?new-subscription=true
app/dashboard/client-layout.tsx (useEffect)
  ↓ POST /api/subscription/sync
app/api/subscription/sync/route.ts
  ├→ Stripe API (customers.list, subscriptions.list)
  └→ Prisma (update User, upsert Subscription)
  
Admin Upload RAG
  ↓ POST /api/rag/nodes/[id]/upload
app/api/rag/nodes/[id]/upload/route.ts
  ├→ lib/rag/parser.ts (pdftotext subprocess)
  ├→ lib/rag/chunker.ts
  ├→ lib/rag/embeddings.ts → OpenAI API
  └→ Prisma (insert RagDocument/RagChunk/RagEmbedding)
```

---

## 3. Tecnologie e Framework

### Linguaggi
- **TypeScript 5:** 100% codebase
- **TSX/JSX:** Componenti React
- **SQL:** Prisma migrations (PostgreSQL dialect)

### Framework Principali
- **Next.js 15.3.3:** App Router, Server Components, API Routes
- **React 19.0.0:** UI components
- **Prisma 6.10.0:** ORM + migrations + client
- **NextAuth.js 5.0.0-beta.28:** Autenticazione session-based
- **TailwindCSS 3.4.1:** Styling utility-first
- **Shadcn/ui:** Component library (Radix UI primitives)

### Librerie AI / Agent / RAG
| Libreria | Versione | Uso |
|----------|----------|-----|
| `openai` | 5.5.1 | Chat completions, embeddings (text-embedding-3-large 3072D) |
| `@anthropic-ai/sdk` | 0.65.0 | Claude chat completions (alternativa OpenAI) |
| `reactflow` | 11.11.4 | Editor workflow visuali (drag & drop nodi/edges) |
| `pdf2json` | - | Parsing PDF (fallback pdftotext subprocess) |
| `mammoth` | 1.11.0 | Parsing DOCX |
| `word-extractor` | 1.0.4 | Parsing DOC legacy |
| `pdf-parse` | 2.1.6 | Alternativa parsing PDF (non usata attivamente) |

**Strategia RAG:**
- **Chunking:** Sliding window 800 caratteri, overlap 200
- **Embeddings:** OpenAI text-embedding-3-large (3072 dimensioni)
- **Retrieval:** Hybrid search (cosine similarity pgvector + trigram pg_trgm)
- **Reranking:** Alpha-weighted fusion (default alpha=0.5)

### Database e Storage
- **PostgreSQL:** Database principale (Prisma)
  - Estensioni: `pgvector`, `pg_trgm`
  - Vector index per similarity search
  - GIN index per full-text search
- **File System:** Storage documenti RAG
  - Path: `ragdata/[nodeId]/[documentId]/[filename]`
  - Nessuna cloud storage (S3/GCS) configurata
- **Stripe:** Gestione subscription metadata (external)

### Deployment & Infra
- **Node.js:** Runtime con `--max-old-space-size=4096` (4GB heap)
- **Environment:** `.env` per secrets (DATABASE_URL, OPENAI_API_KEY, STRIPE_SECRET_KEY_TEST)
- **Build:** Next.js build output (server rendering)
- **Non configurato:** Docker, CI/CD, cloud deployment

---

## 4. Stato di Maturità delle Parti

### ✅ Funziona Stabilmente

| Componente | Status | Note |
|------------|--------|------|
| **Autenticazione** | ✅ Stabile | NextAuth credentials provider, session JWT |
| **Landing Page** | ✅ Stabile | Marketing statico, no dipendenze esterne |
| **Dashboard Layout** | ✅ Stabile | Sidebar, navigation, responsive |
| **Stripe Checkout** | ✅ Stabile | Redirect a Stripe funzionante, test mode attivo |
| **Sincronizzazione Subscription** | ✅ Stabile | Fix 19/01/2026: endpoint `/api/subscription/sync` bypassa webhook |
| **Chat Interface UI** | ✅ Stabile | Input, allegati, streaming messages |
| **Database Schema** | ✅ Stabile | 14 modelli, relazioni corrette, migrations applicabili |
| **Workflow Editor UI** | ✅ Stabile | ReactFlow drag & drop, salvataggio nodi/edges |
| **Admin Provider Config** | ✅ Stabile | CRUD LLMProvider con API key encryption |

### ⚠️ Funziona ma è Fragile / Sperimentale

| Componente | Status | Criticità |
|------------|--------|-----------|
| **RAG Upload** | ⚠️ Fragile | OOM su file >1KB risolto parzialmente (commit 8af5041). Batch embeddings size 2-3, ma memoria Node.js 4GB è workaround temporaneo |
| **Workflow Executor** | ⚠️ Sperimentale | Funziona per flussi lineari, non testato su grafi complessi con loops/condizioni |
| **Chat con File Allegati** | ⚠️ Fragile | Parsing PDF con pdf2json può fallire silenziosamente, nessun retry logic |
| **Token Tracking** | ⚠️ Impreciso | Calcolo token semplificato (len/4), non usa tiktoken, può sforare limiti |
| **RAG Retrieval** | ⚠️ Non validato | Hybrid search implementato ma non testato su dataset reale >100 documenti |
| **Stripe Webhook** | ⚠️ Inaffidabile | Webhook handler esiste ma dipende da Stripe CLI locale (spesso down). Risolto con sync manuale ma webhook production non configurato |
| **Multi-provider LLM** | ⚠️ Sperimentale | OpenAI e Claude supportati ma config JSON provider non ha schema validation |

### ❌ Non Completato

| Componente | Stato | Evidenza |
|------------|-------|----------|
| **Speech-to-Text** | ❌ Stub | Directory `lib/speech/tts.ts` esiste ma vuota |
| **Gestione File Allegati Avanzata** | ❌ Parziale | Drag & drop non implementato, solo file picker |
| **RAG Node Sharing** | ❌ Mancante | Nessun meccanismo per condividere knowledge base tra utenti |
| **Token Limit Enforcement** | ❌ Non implementato | `subscription.tokenLimit` salvato ma non controllato prima del LLM call |
| **Workflow Conditions/Branching** | ❌ Non implementato | Executor segue solo path lineare, ignora `edge.data.condition` |
| **Test Suite** | ❌ Assente | Zero test automatici (unit/integration/e2e) |
| **Monitoring/Observability** | ❌ Stub | Admin monitoring page esiste ma senza metriche reali |
| **Error Boundaries** | ❌ Parziale | Alcuni try/catch ma nessun global error handler React |
| **Rate Limiting** | ❌ Assente | Nessuna protezione spam/abuse su API |

---

## 5. Punti Critici Noti

### 🔴 Bug Frequenti

1. **RAG Upload OOM (Risolto Parzialmente)**
   - **Sintomo:** Server crash durante upload documenti
   - **Causa Root:** Infinite loop in `chunker.ts` quando tail chunk < overlap
   - **Fix:** Commit 8af5041 - `startChar += Math.max(chunkContent.length - overlap, 1)`
   - **Residuo:** File >100KB ancora rischioso, batch embeddings max 3 chunks

2. **Stripe Subscription Non Sincronizzata (Risolto 19/01/2026)**
   - **Sintomo:** Piano "Nessun piano attivo" dopo acquisto Stripe
   - **Causa Root:** Webhook Stripe CLI non affidabile in dev locale
   - **Fix:** Endpoint `/api/subscription/sync` chiamato automaticamente da `client-layout.tsx`
   - **Documentazione:** `PROBLEMI_NOTI.md`

3. **Token Display Mostra 0**
   - **Sintomo:** Dashboard visualizza "Token: 0" anche con subscription attiva
   - **Causa:** Calcolo `tokenUsed` non sottratto da `subscription.tokenLimit`
   - **Status:** Non risolto

### 🟡 Parti Difficili da Capire o Mantenere

1. **Workflow Executor (`lib/workflow-executor.ts` - 396 righe)**
   - **Complessità:** Gestione grafo nodi, edge traversal, multi-provider switching
   - **Mancanze:** Nessun commento su logica branching, documentazione esecuzione asincrona
   - **Rischio:** Modifiche possono rompere flussi esistenti senza test coverage

2. **RAG Pipeline (`lib/rag/ingestPipeline.ts`)**
   - **Complessità:** 5 step sequenziali (parse → chunk → embed → save), error handling su 4 layer
   - **Fragile:** Batch processing manuale, nessun retry su failure parziale
   - **Memoria:** Carica tutto in RAM prima di DB insert

3. **Prisma Schema Migrations**
   - **12 migrations:** Alcune con date overlap, naming inconsistente
   - **Rischio:** Rollback difficile, no snapshot data per dev seed

4. **NextAuth Configuration (`auth.ts`)**
   - **Callbacks custom:** `jwt()`, `session()` con logica business (role, subscription check)
   - **Hardcoded:** Alcuni redirect paths non configurabili

### 🟠 Comportamento Non Deterministico

1. **PDF Parsing (pdf2json vs pdftotext)**
   - **Problema:** Fallback pdftotext subprocess dipende da path hardcoded `/opt/homebrew/bin/pdftotext` (macOS specific)
   - **Risultato:** Su Linux/Windows parsing fallisce silenziosamente

2. **LLM Response Streaming**
   - **OpenAI:** Stream funziona
   - **Claude (Anthropic):** Stream non implementato, fallback a response completa
   - **Esperienza:** Utente vede caricamento lungo senza feedback

3. **Hybrid Retrieval Ranking**
   - **Alpha parameter:** Default 0.5 ma non chiaro impatto su precision/recall
   - **Nessun A/B test:** Risultati RAG non validati contro baseline

4. **Workflow Execution Order**
   - **Assunzione:** Executor assume grafo aciclico (DAG)
   - **Realtà:** Nessuna validazione, loop infiniti possibili se admin configura male

---

## 6. Cosa Manca per un Utilizzo "Produttivo"

### Logging
- ❌ **Structured logging:** Console.log sparsi, no logging framework (Winston, Pino)
- ❌ **Log aggregation:** Nessun shipping a servizio esterno (Datadog, Sentry)
- ❌ **Correlation IDs:** Impossibile tracciare request attraverso componenti
- ❌ **Performance tracing:** Nessun APM per identificare bottleneck

**Raccomandazione:**
```typescript
// Sostituire console.log con:
import { logger } from '@/lib/logger'; // Winston/Pino
logger.info('Chat message received', { 
  userId, 
  conversationId, 
  messageLength: content.length,
  correlationId: req.headers['x-correlation-id']
});
```

### Gestione Errori
- ❌ **Global error boundary:** React error boundary assente
- ❌ **API error standardization:** Response errors inconsistenti (a volte `{ error: string }`, a volte `{ message: string }`)
- ❌ **Retry logic:** Nessun retry automatico su LLM/Stripe API failures
- ❌ **Graceful degradation:** Se OpenAI down, intero sistema inutilizzabile (no fallback Claude automatico)

**Raccomandazione:**
```typescript
// app/error.tsx globale
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error); // Error tracking
  }, [error]);
  return <ErrorPage error={error} onRetry={reset} />;
}
```

### Persistenza Stato
- ❌ **Session storage:** Chat input non salvato su refresh (testo perso)
- ❌ **Draft messages:** Nessun autosave durante digitazione
- ❌ **Workflow draft:** Modifiche workflow non salvate automaticamente (solo salvataggio manuale)
- ⚠️ **File upload state:** Allegati persi se navigazione interrotta

**Raccomandazione:**
- LocalStorage per draft messages (autosave ogni 2s)
- Prisma model `DraftConversation` per persistenza cross-device

### Sicurezza / Privacy
- ❌ **API Rate limiting:** Nessuna protezione DDoS/abuse
- ❌ **Input sanitization:** SQL injection protetto da Prisma, ma XSS possibile su rendering message content
- ❌ **CORS policy:** Non configurata (accetta tutti origins in dev)
- ❌ **GDPR compliance:** Nessun data export/deletion automatico
- ❌ **API key rotation:** LLM provider API keys hardcoded in `.env`, nessun vault (Vault, AWS Secrets Manager)
- ⚠️ **File upload validation:** Solo check MIME type (facilmente bypassabile)

**Raccomandazione:**
```typescript
// middleware.ts rate limiting
import { Ratelimit } from '@upstash/ratelimit';
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});
```

### Test
- ❌ **Unit tests:** Zero coverage
- ❌ **Integration tests:** Nessun test API routes
- ❌ **E2E tests:** Nessun Playwright/Cypress per user flows
- ❌ **Load tests:** Non testato oltre 1 utente concorrente
- ❌ **RAG quality tests:** Nessun benchmark retrieval precision/recall

**Raccomandazione:**
```bash
# Setup test infra
npm install -D vitest @testing-library/react playwright
# Test critici da implementare:
# 1. /api/chat con mock LLM
# 2. Workflow executor con fixture graphs
# 3. RAG retrieval con golden dataset
# 4. Stripe webhook con mock events
```

### Performance
- ❌ **Database indexes:** Mancano indici su `Message.conversationId`, `TokenUsage.userId+date`
- ❌ **Connection pooling:** Prisma default pool (10 connessioni), non ottimizzato per production
- ❌ **Image optimization:** Nessun CDN, images in public/ non ottimizzate
- ❌ **Bundle size:** next.config.js non configurato per code splitting aggressivo
- ⚠️ **Memory leaks:** Node.js 4GB heap workaround, no root cause fix

### Monitoraggio Production-Ready
- ❌ **Health checks:** Nessun endpoint `/health` per load balancer
- ❌ **Metrics export:** Nessun Prometheus/StatsD metrics
- ❌ **Uptime monitoring:** Nessun Pingdom/UptimeRobot
- ❌ **Cost tracking:** Utilizzo OpenAI/Stripe non aggregato per alerting

---

## 7. Obiettivi Impliciti dal Codice

### Funzionalità Non Completate ma Suggerite

1. **Speech-to-Text Integration**
   - **Evidenza:** Directory `lib/speech/tts.ts` (vuota)
   - **Scopo Implicito:** Consentire input vocale per messaggi chat
   - **Completamento:** 0% - nessuna API integration

2. **Multi-Language Support**
   - **Evidenza:** Hard-coded string "Consulenza Legale AI" senza i18n
   - **Scopo Implicito:** Supportare inglese/francese oltre italiano
   - **Completamento:** 0% - nessun framework i18n (react-intl, next-i18next)

3. **Workflow Marketplace**
   - **Evidenza:** `Workflow.userId` nullable, `Workflow.isDefault` flag
   - **Scopo Implicito:** Template workflow condivisi tra utenti (pubblici vs privati)
   - **Completamento:** 10% - schema pronto, nessuna UI

4. **Team/Organization Accounts**
   - **Evidenza:** `User.companyName`, `UserType.COMPANY`
   - **Scopo Implicito:** Subscription condivisa tra più utenti azienda
   - **Completamento:** 20% - dati fatturazione pronti, no user invitation/roles

5. **Document Version Control (RAG)**
   - **Evidenza:** `RagDocument.metadata` JSON field (non popolato)
   - **Scopo Implicito:** Tracciare versioni documento, update embeddings
   - **Completamento:** 5% - campo preparato, nessuna logica

6. **Advanced Workflow Conditions**
   - **Evidenza:** `WorkflowEdge.data.condition` field (ignorato)
   - **Scopo Implicito:** Branching condizionale (if/else) nei workflow
   - **Completamento:** 15% - schema pronto, executor non implementato

7. **Cost Optimization Dashboard**
   - **Evidenza:** `llm-costs.ts` con costi dettagliati per modello
   - **Scopo Implicito:** Dashboard admin per tracking spesa LLM per utente
   - **Completamento:** 30% - calcoli implementati, nessuna UI aggregazione

### TODO Rilevanti nel Codice

**Da grep search risultati:**

1. **File Upload Security**
   ```typescript
   // app/api/rag/nodes/[id]/upload/route.ts
   // TODO: Validare magic bytes, non solo MIME type
   ```

2. **Embedding Model Versioning**
   ```typescript
   // lib/rag/embeddings.ts
   // TODO: Support multiple embedding models (sentence-transformers, Cohere)
   ```

3. **Workflow Error Recovery**
   ```typescript
   // lib/workflow-executor.ts
   // TODO: Implement retry logic for transient LLM failures
   ```

4. **Token Limit Enforcement**
   ```typescript
   // app/api/chat/route.ts
   // TODO: Check subscription.tokenLimit before LLM call, reject if exceeded
   ```

5. **Database Cleanup**
   ```typescript
   // prisma/seed.ts
   // TODO: Seed script incompleto, manca popolamento Plans
   ```

### Debito Tecnico Evidente

| Categoria | Evidenza | Priorità Fix |
|-----------|----------|--------------|
| **Test Pages Residue** | 8 directory `app/*-test/` non rimosse (css-test, tailwind-fix-test, etc.) | P3 - Pulizia |
| **Commented Code** | `app/api/chat/route.ts` ha 50+ righe commentate di vecchia logica formidable | P3 - Pulizia |
| **Hardcoded Paths** | `/opt/homebrew/bin/pdftotext` in `parser.ts` | P1 - Cross-platform |
| **Magic Numbers** | Chunk size 800, overlap 200 senza costanti named | P2 - Manutenibilità |
| **Duplicate Logic** | Token counting duplicato in `chat/route.ts` e `workflow-executor.ts` | P2 - DRY |
| **Memory Config in Package** | `NODE_OPTIONS='--max-old-space-size=4096'` in dev script | P1 - Root cause fix |

---

## Riepilogo Stato Maturità

```
┌─────────────────────────────────────────────────────┐
│ MATURITY BREAKDOWN                                  │
├─────────────────────────────────────────────────────┤
│ ✅ Production Ready:        35% (auth, UI, database)│
│ ⚠️  Needs Hardening:        45% (RAG, workflows)    │
│ ❌ Not Implemented:         20% (tests, monitoring) │
└─────────────────────────────────────────────────────┘

CRITICAL PATH TO PRODUCTION:
1. Fix RAG OOM root cause (worker threads)
2. Implement token limit enforcement
3. Add error tracking (Sentry)
4. Configure production Stripe webhook
5. Write critical path E2E tests
6. Add rate limiting + CORS
7. Database connection pooling
8. Health check endpoint
```

---

**Report compilato il:** 2026-01-19  
**Prossima review consigliata:** Dopo implementazione test suite (milestone 0.2.0)
