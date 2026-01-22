# ARCHIVED — 2026-01-22_ATTACHMENTS_AUDIT

**Superseded by:** `docs/CURRENT_SPEC.md`

---

# ATTACHMENTS AUDIT — Gestione Allegati Chat (19 Gen 2026)

## STATO ATTUALE

### 1. UI — Upload File (`components/chat/message-input.tsx`)

**✅ GIÀ PRESENTE:**
- Input file con pulsante Paperclip (Lucide icon)
- Validazione client-side tipi supportati:
  - `application/pdf` (PDF)
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
  - `application/msword` (DOC)
- Accept attribute: `.pdf,.doc,.docx`
- Preview file con icone colorate:
  - PDF: rosso (`text-red-600`, `bg-red-50`)
  - Word (DOC/DOCX): blu (`text-blue-600`, `bg-blue-50`)
- Pulsante rimozione file (X icon)
- Alert per file non supportato: `"Tipo di file non supportato. Sono accettati solo file PDF, DOC e DOCX."`

**❌ MANCA:**
- Supporto TXT (non richiesto nel brief, ma potrebbe essere utile)
- Indicazione limite size file visibile all'utente

---

### 2. BACKEND — API Chat (`app/api/chat/route.ts`)

#### A. ORDINE CONTROLLI (L151-277)

**✅ SEQUENZA CORRETTA:**
1. **Auth** (L153-156): `auth()` → 401 se non autenticato
2. **Rate limit** (L160-178): `checkRateLimit()` → 429 se superato
3. **Fetch user + subscription** (L180-196): `prisma.user.findUnique()` → 404 se non trovato
4. **Entitlement** (L204-217): `checkSubscriptionEntitlement()` → 402 se no abbonamento attivo
5. **Parse formData** (L219-230): `req.formData()` → 400 se messaggio e file assenti
6. **File size check** (L232-246): → 413 se file > MAX_FILE_BYTES
7. **Extract file** (L248-256): `extractTextFromFile()` → warning se fallisce
8. **Token estimate/check** (L258-277): `checkTokenLimit()` → 413 se token > MAX_INPUT_TOKENS
9. **LLM/Workflow** (L335+): esecuzione logica principale

**✅ ORDINE RISPETTATO** secondo requisiti.

#### B. LIMITI E GUARDRAIL

**✅ GIÀ IMPLEMENTATI:**
- `MAX_FILE_BYTES` (env, default 10MB = `10485760` bytes) — L234
- `MAX_INPUT_TOKENS` (env, default 2000) — da `lib/token-estimator.ts:94`
- Entitlement check (blocco se subscription inattiva)
- Rate limiting (requests/minute per user/IP)
- Token usage tracking nel DB

**❌ MANCA:**
- `ATTACHMENT_MAX_CHARS` — nessuna limitazione char per preview

#### C. PARSING FILE (`extractTextFromFile()` L41-149)

**✅ GIÀ IMPLEMENTATO:**

| Tipo | Libreria | Status | Note |
|------|----------|--------|------|
| **PDF** | `pdf2json` (dynamic import) | ⚠️ PROBLEMATICO | Import dinamico (L54), gestione errori basica, memoria indica OOM issues |
| **DOCX** | `mammoth` | ✅ OK | `mammoth.extractRawText()` (L106) |
| **DOC** | `word-extractor` | ✅ OK | Salva temp file, estrae, cancella (L112-127) |

**❌ MANCA / PROBLEMI:**
1. **PDF parsing instabile**: pdf2json causa OOM (vedi memoria `SYSTEM-RETRIEVED-MEMORY[37b6ac2e]`)
   - Libreria `pdf-parse` già presente in `package.json` ma non usata
   - Errori ritornano stringhe placeholder invece di 400 error
2. **Error handling non strutturato**:
   - Tipo non supportato (L134-136): ritorna stringa `[ERRORE: Tipo di file "X" non supportato...]` invece di **400 {error:'unsupported_file_type'}**
   - Parse failed: ritorna stringhe `[ERRORE...]` invece di **400 {error:'file_parse_failed'}**
   - Catch generico (L145-148): ritorna stringa invece di throw error
3. **Nessuna validazione MIME robusta**: si basa solo su `file.type` (client-controllato)
4. **TXT non supportato** (non in spec ma facile da aggiungere)

#### D. CONTESTO TEMPORANEO

**✅ GIÀ IMPLEMENTATO:**
- File content estratto viene inserito in `fullMessage` (L422-425):
  ```typescript
  fullMessage = `${message} allego questi file

L'utente ha inviato 1 file allegato:
- Contenuto del file "${file.name}": ${fileContent}`;
  ```
- Passa al workflow via `executeWorkflow(workflowId, userId, fullMessage)` (L455)
- NO ingest persistente, NO vector store

**❌ MANCA:**
- **ATTACHMENT_MAX_CHARS**: intero file content inserito senza limite (rischio OOM/token overflow)
- **Preview limitata**: dovrebbe troncare a es. 12000 char
- **Metadata separata**: no campo `attachment_meta` passato al workflow
- **NO distinzione** nel prompt LLM tra fonti RAG vs allegato utente

#### E. PERSISTENZA

**✅ SCHEMA PRESENTE:**
- `Message.attachments Json?` (Prisma schema L116) — campo già definito ma **NON USATO**

**❌ NON IMPLEMENTATO:**
- Nessun salvataggio metadata (filename, mimeType, sizeBytes, preview, sha256)
- Nessun salvataggio preview limitata
- File binario NON salvato (✅ corretto secondo spec)

---

### 3. LIBRERIE DISPONIBILI (`package.json`)

**✅ PRESENTI:**
- `mammoth: ^1.11.0` — estrazione DOCX
- `word-extractor: ^1.0.4` — estrazione DOC
- `pdf-parse: ^2.1.6` — **alternativa stabile a pdf2json** (non usata)
- `@types/pdf-parse: ^1.1.5`

**⚠️ IMPORTATE MA NON IN PACKAGE.JSON:**
- `pdf2json` — importata dinamicamente (L54) ma non listata (forse global?)

**❌ NON PRESENTI:**
- Nessuna nuova dipendenza richiesta (tutto disponibile)

---

### 4. ENV VARS

**✅ CONFIGURATE:**
- `MAX_FILE_BYTES` — usata in `app/api/chat/route.ts:234` (default 10MB)
- `MAX_INPUT_TOKENS` — usata in `lib/token-estimator.ts:94` (default 2000)

**❌ NON CONFIGURATE:**
- `ATTACHMENT_MAX_CHARS` — da aggiungere (default 12000)

---

## CHECKLIST GAP — Cosa Manca vs Requisiti

### A. Parsing File Robusto

| Requisito | Status | Gap |
|-----------|--------|-----|
| PDF estrazione stabile | ❌ | Usa pdf2json problematico, sostituire con pdf-parse |
| PDF error → 400 {error:'file_parse_failed'} | ❌ | Ritorna stringhe placeholder invece di HTTP 400 |
| Word (DOC/DOCX) estrazione | ✅ | Già implementato con mammoth + word-extractor |
| Tipo non supportato → 400 {error:'unsupported_file_type', mimeType} | ❌ | Ritorna stringa invece di HTTP 400 con JSON strutturato |

### B. Contesto Temporaneo

| Requisito | Status | Gap |
|-----------|--------|-----|
| Preview max ATTACHMENT_MAX_CHARS | ❌ | Nessuna limitazione, intero file inserito |
| Campo `attachment_context` (string) passato a workflow | ❌ | Tutto concatenato in fullMessage |
| Campo `attachment_meta` passato a workflow | ❌ | Nessun metadata separato |
| NO ingest persistente | ✅ | Nessun vector store/KB creato |

### C. Limiti e Ordine Controlli

| Requisito | Status | Gap |
|-----------|--------|-----|
| Ordine: Auth → Rate → User → Entitlement → Parse → Size → Extract → Token → LLM | ✅ | Già rispettato |
| MAX_FILE_BYTES check | ✅ | Implementato (L232-246) |
| MAX_INPUT_TOKENS check | ✅ | Implementato (L258-277) |

### D. Persistenza Minima

| Requisito | Status | Gap |
|-----------|--------|-----|
| Salva meta + preview limitata | ❌ | Campo `attachments` Json esistente ma non usato |
| NO salvataggio file binario | ✅ | File non salvato (corretto) |
| Associato a messaggio | ✅ | Schema già supporta (`Message.attachments`) |

### E. Prompt Formatting

| Requisito | Status | Gap |
|-----------|--------|-----|
| Distinzione "Fonti normative" vs "Documento allegato" | ❌ | Nessuna istruzione nel prompt LLM per distinguere RAG vs upload |

---

## SUMMARY — Gap Reali da Implementare

### 🔴 PRIORITÀ ALTA (Blocca MVP)

1. **Sostituire pdf2json con pdf-parse** (già in package.json)
   - Causa: pdf2json instabile, OOM su file >6KB
   - Fix: usare `pdf-parse` come fatto in `lib/rag/parser.ts`

2. **Error handling strutturato**
   - Parse failed → `400 {error:'file_parse_failed'}`
   - Tipo non supportato → `400 {error:'unsupported_file_type', mimeType}`

3. **Limitazione preview attachment**
   - Aggiungere `ATTACHMENT_MAX_CHARS=12000` env
   - Troncare fileContent a questo limite prima di inserire in prompt

### 🟡 PRIORITÀ MEDIA (Migliora UX)

4. **Salvataggio metadata**
   - Usare campo `Message.attachments` (già presente)
   - Salvare: `{filename, mimeType, sizeBytes, preview, uploadedAt}`

5. **Prompt LLM distinction**
   - Aggiungere istruzione nel system prompt per distinguere fonti RAG vs allegati

### 🟢 NICE-TO-HAVE (Non bloccante)

6. **Supporto TXT**
   - Parsing triviale: `Buffer.toString('utf-8')`
   - Già gestito implicitamente se MIME non match (fallback a string?)

---

## FILE DA MODIFICARE (Step 2)

1. **`app/api/chat/route.ts`**
   - Sostituire `pdf2json` con `pdf-parse` in `extractTextFromFile()`
   - Aggiungere limitazione `ATTACHMENT_MAX_CHARS`
   - Throw errors invece di stringhe placeholder
   - Salvare metadata in `Message.attachments`
   - Aggiungere try-catch con error codes 400

2. **`lib/token-estimator.ts`** (opzionale)
   - Nessuna modifica richiesta (già funziona)

3. **`.env.example`** (se esiste)
   - Documentare `ATTACHMENT_MAX_CHARS=12000`

4. **Prompt LLM** (in workflow o route.ts)
   - Aggiungere distinzione RAG vs allegato

---

## TEST PLAN MINIMO (Step 2 Output)

1. **PDF piccolo OK** (<1MB, estrae testo)
2. **DOCX OK** (estrae testo formattato)
3. **File > MAX_FILE_BYTES** → HTTP 413 {error:'file_too_large'}
4. **Token > MAX_INPUT_TOKENS** → HTTP 413 {error:'input_too_large'}
5. **File corrotto** → HTTP 400 {error:'file_parse_failed'}
6. **Tipo non supportato** (es. .jpg) → HTTP 400 {error:'unsupported_file_type', mimeType}
7. **File >12000 char** → preview troncata nel prompt (verifica content length)
8. **Metadata salvato** → query DB `Message.attachments` contiene JSON corretto

---

## CONCLUSIONE

**Stato corrente**: Sistema funzionale ma fragile
- UI completa ✅
- Backend 60% completo (parsing esiste ma error handling manca)
- Schema DB pronto (campo `attachments` non usato)
- Librerie necessarie disponibili

**Lavoro richiesto**: ~50-80 righe di codice in 1 file (`app/api/chat/route.ts`)
- Sostituire parser PDF
- Aggiungere error handling
- Limitare preview
- Salvare metadata

**Risk**: BASSO (no refactor, solo gap filling)
