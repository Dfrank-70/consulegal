# API Critical Endpoints - Traspolegal

**Analisi:** 19 Gennaio 2026  
**Scopo:** Identificazione 10 endpoint più critici per business con failure modes

---

## 1. `POST /api/chat` - Core Chat con AI

**Criticità Business:** 🔴 MASSIMA (core revenue-generating feature)

### Input
```typescript
{
  message: string;              // Messaggio utente
  conversationId?: string;      // ID conversazione esistente (opzionale)
  files?: File[];              // Allegati PDF/DOCX/DOC (opzionale)
}
```

### Output
```typescript
{
  conversationId: string;       // ID conversazione (creata o esistente)
  messageId: string;           // ID messaggio salvato
  response: string;            // Risposta AI (streaming o completa)
  tokensUsed: {
    in: number;
    out: number;
  };
  cost: number;
}
```

### Dipendenze
- **DB:** Prisma (User, Conversation, Message, TokenUsage, Subscription)
- **LLM:** OpenAI GPT-4/GPT-3.5 o Anthropic Claude (configurable)
- **Workflow:** `executeWorkflow()` se utente ha workflow custom
- **RAG:** `hybridRetrieval()` se workflow contiene nodo RAG
- **File Parsing:** pdf2json, mammoth, word-extractor
- **Stripe:** Nessuna dipendenza diretta (ma verifica subscription attiva)

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **OpenAI API down** | Media | Totale (chat inutilizzabile) | ❌ Nessun fallback Claude automatico |
| **Token limit exceeded** | Alta | Alto (LLM rifiuta request) | ⚠️ Token counting impreciso (len/4), no enforcement pre-call |
| **File parsing failure** | Media | Medio (allegato ignorato) | ⚠️ Fallback silenzioso con messaggio `[ERRORE: ...]` |
| **Workflow execution timeout** | Bassa | Alto (response vuota) | ❌ Nessun timeout configurato |
| **DB connection pool exhausted** | Bassa | Critico (500 error) | ⚠️ Pool default Prisma (10 conn) |
| **Out of Memory (file parsing)** | Media | Critico (server crash) | ✅ Mitigato ma non risolto (Node 4GB heap) |
| **Subscription inactive** | Alta | Medio (request rifiutata) | ✅ Check subscription status in code |
| **RAG retrieval slow (>10s)** | Media | Alto (timeout utente) | ❌ Nessun timeout, nessuna cache |

**Codepath Critico:**
```
User request → Session auth → Subscription check → File parsing (se allegati) → 
Workflow executor → LLM API call → Token tracking → DB save → Response stream
```

**SLA Atteso:** <5s per risposta senza allegati, <15s con file PDF

---

## 2. `POST /api/stripe/checkout-session` - Creazione Sessione Pagamento

**Criticità Business:** 🔴 MASSIMA (revenue generation)

### Input
```typescript
{
  priceId: string;  // Stripe Price ID (price_xxx)
}
```

### Output
```typescript
{
  sessionId: string;  // Stripe Session ID
  url: string;        // Redirect URL a Stripe Checkout
}
```

### Dipendenze
- **DB:** Prisma (User - read/write stripeCustomerId)
- **Stripe API:** 
  - `customers.retrieve()` - Verifica customer esistente
  - `customers.create()` - Crea nuovo customer se necessario
  - `checkout.sessions.create()` - Crea sessione checkout
- **Auth:** NextAuth session (user.id, user.email)

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **Stripe API down** | Bassa | Totale (impossibile acquistare) | ❌ Nessun retry logic |
| **User email duplicata in Stripe** | Bassa | Medio (conflitto customer) | ✅ Retrieve by ID, fallback create new |
| **stripeCustomerId invalido** | Media | Medio (errore 404 Stripe) | ✅ Try/catch con re-creation customer |
| **Stripe test/live key mismatch** | Media | Alto (customer not found) | ✅ Fallback re-creation se retrieve fails |
| **client_reference_id missing** | Bassa | Critico (webhook non sincronizza) | ✅ Hardcoded a `confirmedUser.id` |
| **DB transaction failure** | Bassa | Alto (customer creato ma non salvato) | ⚠️ Nessun rollback Stripe se Prisma fallisce |
| **Network timeout Stripe** | Bassa | Medio (utente vede errore generico) | ❌ Timeout default (30s?), no retry |

**Business Impact:** Ogni failure = revenue perso. Nessun alerting configurato.

**SLA Atteso:** <2s (dipende da latenza Stripe)

---

## 3. `POST /api/subscription/sync` - Sincronizzazione Abbonamento

**Criticità Business:** 🟠 ALTA (UX post-acquisto, retention)

### Input
```typescript
// Nessun body, usa session.user.email
{}
```

### Output
```typescript
{
  success: true;
  subscription: string;  // Stripe Subscription ID
}
// OR error
{
  error: string;  // "No active subscription found", etc.
}
```

### Dipendenze
- **DB:** Prisma (User, Subscription - upsert transaction)
- **Stripe API:**
  - `customers.list({ email })` - Trova customer per email
  - `subscriptions.list({ customer, status: 'active' })` - Lista subscription attive
- **Auth:** NextAuth session

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **No Stripe customer found** | Media | Alto (sync fallisce, UI mostra "Nessun piano") | ⚠️ Return 404, utente deve ricomprare |
| **No active subscription** | Media | Alto (piano scaduto non rilevato) | ⚠️ Return 404, nessun fallback su `past_due` |
| **Stripe API rate limit** | Bassa | Medio (sync ritardato) | ❌ Nessun exponential backoff |
| **DB transaction timeout** | Bassa | Critico (subscription non salvata) | ⚠️ Default timeout Prisma (10s?) |
| **Multiple active subscriptions** | Bassa | Medio (prende solo il primo) | ⚠️ `limit: 1` arbitrario, no business logic |
| **Email mismatch Stripe vs DB** | Media | Alto (sync fallisce se email cambiata) | ❌ Cerca solo per email, no fallback su userId |

**Critical Path:** Chiamato automaticamente da `client-layout.tsx` al ritorno da Stripe. Se fallisce, utente bloccato.

**SLA Atteso:** <3s (2 Stripe API calls + 1 DB transaction)

---

## 4. `POST /api/auth/register` - Registrazione Utente

**Criticità Business:** 🟠 ALTA (funnel onboarding)

### Input
```typescript
{
  email: string;
  password: string;
  name?: string;
  userType: 'PRIVATE' | 'COMPANY';
  // Se userType === 'COMPANY':
  companyName?: string;
  vatNumber?: string;
  billingAddress?: string;
  sdiCode?: string;
}
```

### Output
```typescript
{
  id: string;
  email: string;
  name: string;
  userType: string;
  createdAt: string;
  // password omessa per sicurezza
}
```

### Dipendenze
- **DB:** Prisma (User - create)
- **Bcrypt:** Password hashing (12 rounds)

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **Email già esistente** | Alta | Basso (utente informato) | ✅ Check + 409 Conflict response |
| **Weak password** | Alta | Alto (account vulnerabile) | ❌ Nessuna validazione complessità password |
| **SQL injection** | Bassa | Critico (DB compromise) | ✅ Prisma parametrized queries |
| **Bcrypt hash failure** | Molto bassa | Critico (password non salvabile) | ⚠️ Try/catch generico, no retry |
| **Email validation missing** | Alta | Medio (spam accounts) | ❌ Nessuna validazione formato email |
| **Rate limiting assente** | Alta | Alto (account creation spam) | ❌ Nessun rate limit |
| **GDPR consent missing** | Alta | Legale (non compliant) | ❌ Nessun campo `acceptedTerms` |

**Business Impact:** Ogni signup = potenziale revenue. Nessuna email verification = rischio spam/abuse.

**SLA Atteso:** <1s

---

## 5. `POST /api/stripe/webhook` - Webhook Eventi Stripe

**Criticità Business:** 🔴 MASSIMA (sincronizzazione subscription automatica)

### Input
```typescript
// Raw body (Stripe signature verification)
Stripe-Signature: string (header)
Body: Stripe.Event JSON
```

### Output
```typescript
// Status 200 per ACK Stripe
{ success: true }
```

### Dipendenze
- **Stripe SDK:** `stripe.webhooks.constructEvent()` - Signature verification
- **DB:** Prisma (User, Subscription - transaction upsert)
- **Env:** `STRIPE_WEBHOOK_SECRET_TEST` o `STRIPE_WEBHOOK_SECRET`

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **Signature verification failed** | Media | Alto (evento ignorato) | ✅ Return 400, Stripe retry automatico |
| **Webhook secret non configurato** | Media | Critico (tutti eventi rifiutati) | ✅ Check + 500 error se mancante |
| **client_reference_id missing** | Media | Critico (impossibile identificare user) | ⚠️ Log warning ma non salva subscription |
| **User not found by customerId** | Media | Alto (subscription update/delete non applicato) | ⚠️ Log error, evento perso |
| **DB transaction failure** | Bassa | Critico (subscription non sincronizzata) | ⚠️ Log error, Stripe NON retry (200 sent) |
| **Stripe CLI disconnected (dev)** | Alta | Totale in dev (webhook non ricevuti) | ✅ Workaround: `/api/subscription/sync` |
| **Production webhook URL non configurato** | Alta | Critico (production non funziona) | ❌ Nessun webhook production configurato |
| **Event duplicate processing** | Media | Medio (idempotency issue) | ⚠️ Upsert aiuta ma no explicit deduplication |

**Critical:** In produzione, se webhook non configurato, **TUTTI gli acquisti falliscono silenziosamente**.

**Eventi gestiti:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice_payment.paid`

**SLA Atteso:** <2s per rispondere a Stripe (evitare retry loop)

---

## 6. `POST /api/rag/nodes/[id]/upload` - Upload Documento RAG

**Criticità Business:** 🟡 MEDIA (feature differenziante, non core)

### Input
```typescript
FormData {
  file: File;  // PDF, DOCX, DOC (max 1MB)
}
```

### Output
```typescript
{
  documentId: string;
  chunksCreated: number;
  embeddingsCreated: number;
  processingTimeMs: number;
}
```

### Dipendenze
- **DB:** Prisma (RagNode, RagDocument, RagChunk, RagEmbedding - batch inserts)
- **File System:** `fs/promises` - Write file a `ragdata/[nodeId]/[docId]/`
- **Parser:** `parseDocument()` → pdftotext subprocess (macOS `/opt/homebrew/bin/pdftotext`) o mammoth/word-extractor
- **Chunker:** `chunkTextWithPreset()` - Sliding window 800 chars, overlap 200
- **Embeddings:** OpenAI `text-embedding-3-large` (3072 dimensions)

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **Out of Memory (file >1KB)** | Alta | Critico (server crash) | ✅ Parzialmente risolto (batch size 2-3, Node 4GB heap) |
| **pdftotext not found (Linux/Windows)** | Alta | Alto (PDF parsing fallisce) | ❌ Hardcoded macOS path `/opt/homebrew/bin/pdftotext` |
| **OpenAI embeddings API timeout** | Media | Alto (upload non completa) | ⚠️ Batch processing aiuta, no explicit timeout |
| **File size > 1MB** | Media | Basso (reject con 400) | ✅ Validation + clear error message |
| **Infinite loop chunker** | Bassa | Critico (hang server) | ✅ Fix commit 8af5041 (advance check) |
| **DB batch insert failure** | Bassa | Alto (embeddings persi, no rollback) | ⚠️ Nessun transaction wrapping full pipeline |
| **Disk full** | Bassa | Critico (fs.writeFile fails) | ❌ Nessun disk space check |
| **MIME type spoofing** | Media | Medio (parser wrong type) | ❌ Solo check MIME header, no magic bytes |

**Business Impact:** Upload fallito = feature RAG inutilizzabile. Nessun retry UX.

**SLA Atteso:** 5-30s per file 1MB (dipende da chunk count)

---

## 7. `POST /api/rag/query` - Retrieval Documenti RAG

**Criticità Business:** 🟡 MEDIA (usato solo se workflow contiene nodo RAG)

### Input
```typescript
{
  nodeId: string;
  query: string;
  topK?: number;        // Default 20 (candidate retrieval)
  returnK?: number;     // Default 5 (final results)
  hybridAlpha?: number; // Default 0.5 (vector vs text weight)
}
```

### Output
```typescript
{
  contexts: Array<{
    chunkId: string;
    documentId: string;
    filename: string;
    content: string;
    score: number;
    metadata: object;
  }>;
  retrievalTimeMs: number;
}
```

### Dipendenze
- **DB:** Prisma raw SQL (pgvector cosine similarity + pg_trgm trigram search)
- **OpenAI:** Embedding query (text-embedding-3-large)
- **PostgreSQL Extensions:** `pgvector`, `pg_trgm`

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **Query embedding timeout** | Media | Alto (retrieval fallisce) | ❌ Default OpenAI timeout (60s?) |
| **No chunks found** | Alta | Basso (return empty array) | ✅ Graceful handling |
| **Slow vector search (>10s)** | Media | Alto (workflow timeout) | ❌ Nessun index optimization, no cache |
| **pgvector extension missing** | Bassa | Critico (DB error) | ⚠️ Assume extension installed, no runtime check |
| **topK > chunk count** | Alta | Basso (return all available) | ✅ SQL LIMIT handles gracefully |
| **Invalid hybridAlpha (>1 or <0)** | Media | Medio (ranking skewed) | ❌ Nessuna validazione input alpha |
| **Concurrent queries deadlock** | Bassa | Medio (query timeout) | ⚠️ Nessun connection pool tuning |

**Business Impact:** Query lento = workflow executor timeout → chat response vuota.

**SLA Atteso:** <2s per query (1s embedding + 1s retrieval)

---

## 8. `PUT /api/admin/workflows/[id]` - Salvataggio Workflow

**Criticità Business:** 🟡 MEDIA (admin feature, impatta tutti utenti se workflow è default)

### Input
```typescript
{
  name: string;
  description?: string;
  isDefault: boolean;
  nodes: Array<{
    id: string;
    type: string;  // 'input', 'llm', 'rag', 'output'
    position: { x: number; y: number };
    data: object;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data?: object;
  }>;
}
```

### Output
```typescript
{
  id: string;
  name: string;
  updatedAt: string;
  nodes: [...];
  edges: [...];
}
```

### Dipendenze
- **DB:** Prisma (Workflow, WorkflowNode, WorkflowEdge - transaction DELETE + CREATE)
- **Auth:** NextAuth session (role === 'ADMIN')

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **Ciclo nel grafo** | Media | Alto (workflow executor loop infinito) | ❌ Nessuna validazione DAG |
| **Nodo disconnesso** | Alta | Medio (nodo ignorato, confusione admin) | ❌ Nessuna validazione connected graph |
| **Edge source/target inesistente** | Media | Alto (runtime error executor) | ❌ Nessuna foreign key check |
| **Transaction timeout (molti nodi)** | Bassa | Alto (save parziale) | ⚠️ DELETE all + CREATE all (non atomic per nodo) |
| **isDefault conflict** | Media | Alto (due workflow default contemporaneamente) | ❌ Nessun unique constraint DB |
| **Invalid node.data JSON** | Media | Critico (executor crash) | ❌ Nessuna schema validation (Zod) |
| **Concurrent admin edits** | Media | Alto (last write wins, perdita dati) | ❌ Nessun optimistic locking |

**Business Impact:** Workflow default corrotto = chat fallisce per TUTTI gli utenti.

**SLA Atteso:** <3s per workflow con 10-20 nodi

---

## 9. `POST /api/conversations` - Creazione Conversazione

**Criticità Business:** 🟢 BASSA (UX convenience, non blocca funzionalità core)

### Input
```typescript
// Body vuoto, usa session.user.id
{}
```

### Output
```typescript
{
  id: string;
  userId: string;
  title: string;  // "Nuova Consulenza" o "Nuova Consulenza (2)"
  createdAt: string;
}
```

### Dipendenze
- **DB:** Prisma (Conversation - create, findMany per title uniqueness)
- **Auth:** NextAuth session

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **Race condition titoli duplicati** | Media | Basso (UI confusa, non bloccante) | ⚠️ Loop find + increment, no unique constraint |
| **Infinite loop title increment** | Bassa | Critico (hang request) | ⚠️ `while(true)` senza max iterations |
| **DB insert failure** | Bassa | Medio (utente retry manuale) | ⚠️ Generic 500 error |

**Business Impact:** Non critico, chat funziona anche senza conversazione esplicita (creata on-demand in `/api/chat`).

**SLA Atteso:** <500ms

---

## 10. `GET /api/conversations` - Lista Conversazioni

**Criticità Business:** 🟢 BASSA (UI sidebar, non blocca core functionality)

### Input
```typescript
// Query params opzionali:
?id=<conversationId>  // Fetch singola conversazione
// O nessun param → fetch tutte
```

### Output
```typescript
// Se id fornito:
{
  id: string;
  title: string;
  createdAt: string;
}
// Altrimenti:
[
  { id, title, createdAt, updatedAt },
  ...
]
```

### Dipendenze
- **DB:** Prisma (Conversation - findUnique o findMany)
- **Auth:** NextAuth session

### Failure Modes

| Failure | Probabilità | Impatto | Mitigazione Attuale |
|---------|-------------|---------|---------------------|
| **N+1 query su molte conversazioni** | Alta | Medio (slow response >5s se 100+ conv) | ⚠️ `findMany` con `select` ridotto, ma no pagination |
| **userId mismatch (security)** | Bassa | Critico (leak dati altri utenti) | ✅ Where clause `userId: session.user.id` |
| **Conversation not found (404)** | Media | Basso (UI mostra empty state) | ✅ Return 404 con messaggio chiaro |
| **Nessuna paginazione** | Alta | Alto (timeout se >1000 conversations) | ❌ Nessun limit/offset |

**Business Impact:** UI sidebar lenta, ma chat funziona.

**SLA Atteso:** <1s per <100 conversations

---

## Riepilogo Criticità

| Rank | Endpoint | Criticità | Failure Mode più Critico |
|------|----------|-----------|--------------------------|
| 1 | `POST /api/chat` | 🔴 MASSIMA | OpenAI API down (no fallback) |
| 2 | `POST /api/stripe/checkout-session` | 🔴 MASSIMA | Stripe API down (revenue loss) |
| 3 | `POST /api/stripe/webhook` | 🔴 MASSIMA | Production webhook non configurato |
| 4 | `POST /api/subscription/sync` | 🟠 ALTA | No active subscription → UX bloccata |
| 5 | `POST /api/auth/register` | 🟠 ALTA | No rate limit (spam accounts) |
| 6 | `POST /api/rag/nodes/[id]/upload` | 🟡 MEDIA | OOM crash (parzialmente mitigato) |
| 7 | `POST /api/rag/query` | 🟡 MEDIA | Slow retrieval >10s (no timeout) |
| 8 | `PUT /api/admin/workflows/[id]` | 🟡 MEDIA | Workflow default corrotto → tutti utenti impattati |
| 9 | `POST /api/conversations` | 🟢 BASSA | Race condition titoli (non bloccante) |
| 10 | `GET /api/conversations` | 🟢 BASSA | No pagination (slow con >100 conv) |

---

## Azioni Prioritarie (Business Impact)

### P0 - Critico (Impatta Revenue Immediato)
1. **Configurare Stripe webhook production** (`/api/stripe/webhook`)
2. **Implementare fallback LLM** (Claude se OpenAI down) in `/api/chat`
3. **Rate limiting** su `/api/auth/register` e `/api/chat`

### P1 - Alto (Impatta UX/Stabilità)
4. **Token limit enforcement** pre-call in `/api/chat`
5. **Workflow DAG validation** in `/api/admin/workflows/[id]`
6. **Cross-platform PDF parsing** (fix hardcoded pdftotext path)

### P2 - Medio (Impatta Scalabilità)
7. **Pagination** su `/api/conversations`
8. **Caching** su `/api/rag/query` (Redis)
9. **Health check endpoint** (`/api/health`)
10. **Error tracking** (Sentry integration)

---

**Report compilato:** 2026-01-19  
**Fonte analisi:** Codebase commit fccab57
