# Rate Limiting & Token Limits - MVP

**Data:** 19 Gennaio 2026  
**Versione:** MVP 1.0

---

## Overview

Sistema di **guardrail economici** per prevenire abusi e controllare costi API (OpenAI LLM, embeddings).

**Protezioni implementate:**
1. **Rate Limiting** - Limita richieste per utente/IP per unità di tempo
2. **Token Limit Enforcement** - Blocca input troppo grandi prima di chiamata LLM

---

## Environment Variables

### Configurazione Rate Limiting

```bash
# .env o .env.production
CHAT_RPM=20  # Requests per minute per /api/chat (default: 20)
```

**Default:** `20 requests/minute` se non specificato.

**Raccomandazioni:**
- **Development:** `CHAT_RPM=100` (testing friendly)
- **Production (free tier):** `CHAT_RPM=10`
- **Production (paid tier):** `CHAT_RPM=30-60`

---

### Configurazione Token Limits

```bash
# .env o .env.production
MAX_INPUT_TOKENS=2000  # Max token input per request (default: 2000)
```

**Default:** `2000 tokens` se non specificato.

**Context:**
- GPT-4 context window: 8K-128K tokens
- GPT-3.5-turbo: 16K tokens
- Nostro limit: Input only (message + system prompt + file)

**Raccomandazioni:**
- **MVP:** `MAX_INPUT_TOKENS=2000` (sicuro, copre 99% use cases)
- **Production:** `MAX_INPUT_TOKENS=4000` (file PDF più grandi)
- **Enterprise:** `MAX_INPUT_TOKENS=8000` (documenti lunghi)

---

### Configurazione File Upload Limits

```bash
# .env o .env.production
MAX_FILE_BYTES=10485760  # Max file size in bytes (default: 10MB)
```

**Default:** `10485760` (10MB) se non specificato.

**Conversione:**
- 1MB = 1,048,576 bytes
- 5MB = 5,242,880 bytes
- 10MB = 10,485,760 bytes (default)
- 20MB = 20,971,520 bytes

**Raccomandazioni:**
- **MVP:** `MAX_FILE_BYTES=10485760` (10MB, documenti standard)
- **Production:** `MAX_FILE_BYTES=20971520` (20MB, PDF lunghi)
- **Enterprise:** `MAX_FILE_BYTES=52428800` (50MB, contratti complessi)

---

## Rate Limiting Implementation

### Endpoint Protetti

| Endpoint | Identifier | Limit | Window |
|----------|------------|-------|--------|
| `POST /api/chat` | userId (o IP fallback) | `CHAT_RPM` | 60 seconds |

**Nota:** Altri endpoint (RAG query, admin) non hanno rate limit in MVP.

---

### Logica Rate Limit

```typescript
// lib/rate-limit.ts
function checkRateLimit(identifier: string, limit: number): RateLimitResult {
  // Sliding window per identifier (userId o IP)
  // In-memory store (Map<identifier, { count, windowStart }>)
  
  if (count >= limit) {
    return { 
      allowed: false, 
      retryAfterSeconds: Math.ceil((windowEnd - now) / 1000) 
    };
  }
  
  return { allowed: true, remaining: limit - count };
}
```

**Caratteristiche:**
- **Sliding window:** Reset automatico dopo 60s
- **Per-user isolation:** User A non impatta rate limit User B
- **IP fallback:** Utenti non autenticati rate-limitati per IP
- **In-memory:** Limits reset su server restart (accettabile per MVP)

---

### Storage: In-Memory vs Database

**Scelta MVP:** In-memory `Map<string, RateLimitEntry>`

**Pro:**
- ✅ Zero dipendenze (no Redis)
- ✅ Performance eccellente (<1ms lookup)
- ✅ Implementazione semplice (50 righe codice)

**Contro:**
- ❌ Limits reset su server restart
- ❌ Non funziona con multi-instance (load balancer)

**Future:** Se deploy multi-instance, migrare a Redis:
```typescript
// Esempio Redis (non implementato MVP)
await redis.incr(`rate:${userId}:${minute}`);
await redis.expire(`rate:${userId}:${minute}`, 60);
```

---

### Auto-Cleanup Memory

```typescript
// Automatic cleanup ogni 5 minuti
setInterval(() => cleanupRateLimitStore(), 5 * 60 * 1000);
```

**Previene:** Memory leak da utenti inattivi (entries non usate da >5min vengono rimosse).

---

## Token Limit Enforcement

### Endpoint Protetti

| Endpoint | Check | Limit | Method |
|----------|-------|-------|--------|
| `POST /api/chat` | Input size | `MAX_INPUT_TOKENS` | Character-based estimation |

---

### Logica Token Estimation

```typescript
// lib/token-estimator.ts
function estimateTokens(text: string): number {
  // Conservative: 3.5 chars/token (overestimate)
  return Math.ceil(text.length / 3.5);
}

function estimateChatInputTokens(
  message: string,
  systemPrompt?: string,
  fileContent?: string
): number {
  let total = 0;
  total += estimateTokens(message);
  total += estimateTokens(systemPrompt);
  total += estimateTokens(fileContent);
  total += 50; // Format overhead
  return total;
}
```

**Metodo:** Character-based approximation (conservative)

**Accuracy:**
- ✅ Overestima leggermente (safer)
- ⚠️ Non accuracy 100% (no tiktoken library)
- ✅ Sufficiente per MVP (evita input giganti)

**Future:** Usare `tiktoken` per count preciso:
```typescript
import { encoding_for_model } from 'tiktoken';
const enc = encoding_for_model('gpt-4');
const tokens = enc.encode(text).length;
```

---

### Input Components Checked

```
Total Input Tokens = 
  User Message Tokens +
  System Prompt Tokens +
  File Content Tokens (if any) +
  50 (formatting overhead)
```

**Esempio:**
- Message: "Analizza questo contratto" (28 chars → ~8 tokens)
- System: "You are a legal assistant" (27 chars → ~8 tokens)
- File: PDF 10KB → ~3000 chars → ~857 tokens
- Overhead: +50 tokens
- **Total:** ~923 tokens ✅ (< 2000 limit)

---

## Response Format

### Rate Limit Exceeded (429)

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 45

{
  "error": "rate_limited",
  "retry_after_seconds": 45
}
```

**Headers:**
- `Retry-After`: Secondi da attendere (standard HTTP)

**Status Code:** `429 Too Many Requests`

---

### Input Too Large (413)

```json
HTTP/1.1 413 Content Too Large

{
  "error": "input_too_large",
  "max_input_tokens": 2000,
  "estimated_tokens": 3500
}
```

**Status Code:** `413 Content Too Large` (o `400 Bad Request`)

**Info returned:**
- `max_input_tokens`: Limit configurato
- `estimated_tokens`: Token stimati input utente

---

## Logging

### Rate Limit Denied

```typescript
console.log(`🚫 Rate limit exceeded for ${userId || 'IP:' + ip}`);
```

**Output:**
```
🚫 Rate limit exceeded for cm123abc
🚫 Rate limit exceeded for IP:192.168.1.1
```

---

### Token Limit Denied

```typescript
console.log(`🚫 Input too large for user ${userId}: ${estimatedTokens} tokens (max: ${maxTokens})`);
```

**Output:**
```
🚫 Input too large for user cm123abc: 3500 tokens (max: 2000)
```

**Dati NON Loggati:**
- ❌ Contenuto messaggio (privacy)
- ❌ File content (privacy)
- ❌ IP address completo (GDPR)

---

## Test Cases

### Test 1: Rate Limit OK (Sotto Soglia)

**Setup:**
```bash
CHAT_RPM=20
```

**Request Sequence:**
```bash
# User cm123abc
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/chat \
    -H "Cookie: next-auth.session-token=..." \
    -F "message=Test $i"
done
```

**Expected:**
- Requests 1-10: `200 OK`
- Requests processate normalmente
- Rate limit: 10/20 remaining

---

### Test 2: Rate Limit EXCEEDED (Sopra Soglia)

**Setup:**
```bash
CHAT_RPM=5  # Low limit for testing
```

**Request Sequence:**
```bash
# Invia 10 requests rapidamente
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/chat \
    -H "Cookie: ..." \
    -F "message=Test $i" &
done
wait
```

**Expected:**
- Requests 1-5: `200 OK`
- Requests 6-10: `429 Too Many Requests`
- Response body: `{ "error": "rate_limited", "retry_after_seconds": 45-60 }`
- Header: `Retry-After: 45`

**Verification:**
```
Server logs:
🚫 Rate limit exceeded for cm123abc
🚫 Rate limit exceeded for cm123abc
...
```

---

### Test 3: Token Limit OK (Input Normale)

**Setup:**
```bash
MAX_INPUT_TOKENS=2000
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Cookie: ..." \
  -F "message=Breve domanda su contratto locazione" \
  -F "file=@small-doc.pdf"  # 1KB file
```

**Expected:**
- Estimated tokens: ~350 (message 50 + file 300)
- Response: `200 OK`
- Chat processato normalmente

---

### Test 4: Token Limit EXCEEDED (Input Troppo Grande)

**Setup:**
```bash
MAX_INPUT_TOKENS=2000
```

**Request:**
```bash
# Message molto lungo (5000 caratteri) + file grande
curl -X POST http://localhost:3000/api/chat \
  -H "Cookie: ..." \
  -F "message=$(cat long-text.txt)" \
  -F "file=@huge-doc.pdf"  # 50KB file
```

**Expected:**
- Estimated tokens: ~15,000 (message 1428 + file 14000)
- Response: `413 Content Too Large`
- Body:
  ```json
  {
    "error": "input_too_large",
    "max_input_tokens": 2000,
    "estimated_tokens": 15000
  }
  ```

**Verification:**
```
Server logs:
🚫 Input too large for user cm123abc: 15000 tokens (max: 2000)
```

---

### Test 5: Rate Limit Anonimo (IP Fallback)

**Setup:**
```bash
CHAT_RPM=10
```

**Scenario:** Utente NON autenticato (o userId mancante)

**Request:**
```bash
# Senza cookie auth
curl -X POST http://localhost:3000/api/chat \
  -F "message=Test"
```

**Expected:**
- Response: `401 Unauthorized` (entitlement guard blocca prima)
- MA se auth bypassata (test): rate limit usa IP address

**Note:** Nel flusso reale, entitlement guard blocca prima di rate limit per utenti non-auth.

---

### Test 6: Utente Active con Tutti i Controlli

**Setup:**
```bash
CHAT_RPM=20
MAX_INPUT_TOKENS=2000
```

**Scenario:** Utente con subscription active, input valido

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Cookie: next-auth.session-token=..." \
  -F "message=Analizza questo contratto" \
  -F "file=@contract.pdf"  # 10KB
```

**Flow:**
```
1. Auth check ✅ (session valid)
2. Rate limit check ✅ (5/20 requests used)
3. Token limit check ✅ (900/2000 tokens)
4. Entitlement check ✅ (subscription active)
5. LLM processing ✅
6. Response: 200 OK with chat response
```

**Expected:**
- All guards pass
- Response: `200 OK`
- Body: Normal chat response JSON

---

## Order of Checks (Flow)

```
Request POST /api/chat
  ↓
1. Authentication (401 if failed)
  ↓
2. Rate Limiting (429 if exceeded)
  ↓
3. Fetch User + Subscription (404 if not found)
  ↓
4. Entitlement Check (402 if no active subscription)
  ↓
5. Parse formData (message, file)
  ↓
6. File Size Check (413 if file > MAX_FILE_BYTES)
  ↓
7. Extract file content (if any)
  ↓
8. Token Limit Check (413 if input > MAX_INPUT_TOKENS)
  ↓
9. Process LLM Request ✅
```

**Rationale (hardened order):**
- **Auth first** - Cheapest check (~1ms)
- **Rate limit** - Prevent spam before DB queries (~1ms)
- **Fetch user** - Single DB query, needed for entitlement (~10ms)
- **Entitlement** - Block non-subscribers BEFORE expensive operations (~1ms)
- **Parse formData** - Only for entitled users (~5-50ms)
- **File size check** - Fast rejection of huge files before parsing (~1ms)
- **Extract file** - Most expensive operation (~100-500ms)
- **Token limit** - Last check before LLM cost (~5ms)
- **LLM call** - Only if all guards pass ($$$)

**Key improvement:** Entitlement check moved BEFORE formData parsing to avoid processing uploads for non-paying users.

---

## Performance Impact

### Rate Limit Check

**Cost:** ~0.5ms (in-memory Map lookup)

**Overhead:** Negligible

---

### Token Estimation

**Cost:** ~1-5ms (string length calculation)

**Operations:**
- File content extraction: 10-500ms (depends on file size)
- Character count: <1ms
- Division: <0.1ms

**Overhead:** Acceptable (pre-LLM check saves $$ on rejected requests)

---

### Total Added Latency

**Best case (no file):** +1ms  
**Worst case (large file):** +505ms (but prevents $5 API call)

**Trade-off:** Worth it for cost protection.

---

## Monitoring & Metrics

### Queries Utili

```sql
-- Rate limit violations per user (se loggato in DB future)
SELECT userId, COUNT(*) as violations
FROM rate_limit_violations  -- Tabella future
WHERE timestamp > NOW() - INTERVAL '1 day'
GROUP BY userId
ORDER BY violations DESC;

-- Token limit violations
SELECT userId, AVG(estimated_tokens) as avg_tokens
FROM token_limit_violations  -- Tabella future
WHERE timestamp > NOW() - INTERVAL '1 day'
GROUP BY userId;
```

**Nota:** MVP logga solo su console, non su DB.

---

### Alerting (Future)

**Trigger alert se:**
- Rate limit violations > 100/hour (possibile abuse)
- Token limit violations > 50/hour (user workflow issue)
- Spike anomalo requests (DDoS)

---

## Troubleshooting

### Problema: Utente legittimo bloccato da rate limit

**Causa:** Limit troppo basso per use case utente.

**Debug:**
```
Server logs:
🚫 Rate limit exceeded for cm123abc (10 occorrences in 5 minutes)
```

**Fix:**
1. Aumentare `CHAT_RPM` (es. 20 → 40)
2. Oppure implementare tier-based limits (free=10, paid=60)

---

### Problema: File PDF rifiutato per token limit

**Causa:** PDF molto grande (>20 pagine) + `MAX_INPUT_TOKENS=2000` troppo basso.

**Debug:**
```
🚫 Input too large for user cm123abc: 8500 tokens (max: 2000)
```

**Fix:**
1. Aumentare `MAX_INPUT_TOKENS=4000`
2. Oppure implementare chunking (split file in più requests)
3. Oppure UI warning pre-upload (estimate client-side)

---

### Problema: Rate limit non funziona (same user bypass)

**Causa:** Server restart cancella in-memory store.

**Workaround:** Accettabile per MVP.

**Fix production:** Migrare a Redis persistent storage.

---

## Future Enhancements

### 1. Tier-Based Rate Limits (Non Implementato)

**Scenario:** Piani diversi → limiti diversi.

```typescript
function getRateLimitForUser(subscription: Subscription): number {
  const tierLimits = {
    'ConsulLight': 10,   // RPM
    'ConsulPro': 30,
    'ConsulExpert': 100
  };
  return tierLimits[subscription.planName] || 10;
}
```

---

### 2. Redis-Backed Rate Limiting (Non Implementato)

**Benefit:** Persistent, multi-instance safe.

```typescript
import { Redis } from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const key = `rate:${userId}:${Math.floor(Date.now() / 60000)}`;
  const count = await redis.incr(key);
  await redis.expire(key, 60);
  return { allowed: count <= limit, remaining: limit - count };
}
```

---

### 3. Token Usage Tracking (Parzialmente Implementato)

**Current:** Token estimate pre-call (input only).

**Future:** Track actual tokens used post-call (input + output).

```typescript
// Dopo LLM response
const actualTokens = response.usage.total_tokens;
await prisma.tokenUsage.create({
  data: { userId, tokensUsed: actualTokens, cost: actualTokens * 0.00002 }
});
```

---

### 4. Burst Allowance (Non Implementato)

**Scenario:** Allow occasional burst oltre limit.

**Algoritmo:** Token bucket invece di sliding window.

```typescript
// Allow 20 RPM + burst di 5 requests
const bucket = { tokens: 25, refillRate: 20/60 };
```

---

### 5. Client-Side Estimation (Non Implementato)

**Benefit:** UI warning PRIMA di submit.

```typescript
// Frontend JavaScript
const estimatedTokens = Math.ceil(message.length / 3.5);
if (estimatedTokens > 2000) {
  alert("Message too long. Max 2000 tokens (~7000 characters)");
}
```

---

## Riferimenti

- **HTTP 429:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
- **HTTP 413:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413
- **Rate Limiting Algorithms:** https://en.wikipedia.org/wiki/Rate_limiting
- **Tiktoken Library:** https://github.com/openai/tiktoken

---

**Documento aggiornato:** 2026-01-19  
**Owner:** Backend Team  
**Review:** Post-MVP testing
