# ARCHIVED — 2026-01-22_EXPERT_CASE_MVP

**Superseded by:** `docs/CURRENT_SPEC.md`

---

# Expert Case MVP - "Richiedi parere esperto"

**Data implementazione:** 20 Gennaio 2026  
**Versione:** 1.0.0 MVP  
**Status:** ✅ Production Ready

---

## 📋 Panoramica

Sistema per permettere agli utenti di richiedere una revisione esperta di una risposta AI. Quando attivato:

1. Crea un **Case/Ticket** associato all'utente e alla conversazione
2. Costruisce un **payload strutturato** con:
   - Ultimo messaggio utente
   - Ultima risposta AI (draft)
   - Metadata allegati
   - Citazioni RAG estratte
3. Esegue workflow globale **system_expert_packet_v1** per generare dossier
4. Salva output come **expertPacket** nel Case
5. Aggiorna status a **WAITING_EXPERT**

Micro-hardening (MVP):
- Rate limit dedicato su endpoint request-expert (`EXPERT_RPM`, default 10/min)
- Dedup Case per evitare doppio click / retry (riusa Case OPEN/WAITING_EXPERT)
- Response sicura: non ritorna `expertPacket`
- Selezione workflow deterministica (ultimo `system_expert_packet_v1` globale)
- Parsing citazioni stabile tramite sezione `SOURCES:`

---

## 🗄️ Schema Database

### Enum

```prisma
enum CaseStatus {
  OPEN            // Caso appena creato
  WAITING_EXPERT  // In attesa revisione esperto
  ANSWERED        // Risposta esperto fornita
  CLOSED          // Caso chiuso
}

enum CasePriority {
  LOW
  MEDIUM
  HIGH
}

enum CaseTriggeredBy {
  USER_REQUEST  // Utente ha premuto il bottone
  AUTO_FLAG     // Sistema ha rilevato keyword/pattern
}

enum CaseMessageRole {
  SYSTEM  // Messaggio generato dal sistema
  USER    // Messaggio dall'utente
  EXPERT  // Risposta dall'esperto umano
}
```

### Model Case

```prisma
model Case {
  id             String           @id @default(cuid())
  userId         String           // FK → User
  conversationId String           // FK → Conversation
  status         CaseStatus       @default(OPEN)
  priority       CasePriority     @default(MEDIUM)
  triggeredBy    CaseTriggeredBy  @default(USER_REQUEST)
  expertPacket   Json?            // Dossier strutturato (output workflow)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  messages     CaseMessage[]

  @@index([userId])
  @@index([conversationId])
  @@index([status, priority])
}
```

### Model CaseMessage

```prisma
model CaseMessage {
  id        String          @id @default(cuid())
  caseId    String          // FK → Case
  authorId  String?         // FK → User (nullable per SYSTEM)
  role      CaseMessageRole
  content   String          @db.Text
  meta      Json?           // Metadata aggiuntivi
  createdAt DateTime        @default(now())

  case   Case  @relation(fields: [caseId], references: [id], onDelete: Cascade)
  author User? @relation(fields: [authorId], references: [id])

  @@index([caseId])
}
```

### Relazioni aggiunte

**User:**
```prisma
model User {
  // ... campi esistenti ...
  cases        Case[]
  caseMessages CaseMessage[]
}
```

**Conversation:**
```prisma
model Conversation {
  // ... campi esistenti ...
  cases Case[]
}
```

---

## 🔄 Workflow Globale system_expert_packet_v1

### Identificazione

```javascript
const expertWorkflow = (await prisma.workflow.findMany({
  where: {
    name: 'system_expert_packet_v1',
    userId: null // Workflow globale (sistema)
  },
  orderBy: { createdAt: 'desc' },
  take: 1,
}))[0];
```

### Creazione/Seed

**Script:** `scripts/seed-expert-workflow.js`

```bash
node scripts/seed-expert-workflow.js
```

Output: ID workflow da usare nell'endpoint.

### Struttura Workflow

**Nodi:**
1. **input-1** (type: input) - Riceve payload JSON
2. **llm-expert-analyzer** (type: llm) - Analizza e genera dossier
3. **output-1** (type: output) - Ritorna JSON strutturato

**Provider:** OpenAI GPT-4o-mini  
**Temperature:** 0.3 (bassa per output strutturato)  
**Max Tokens:** 2000

### Input Payload

```json
{
  "conversationId": "cmk...",
  "userId": "cmk...",
  "caseId": "cmk...",
  "user_message": "Domanda originale dell'utente...",
  "ai_draft": "Risposta bozza generata dall'AI...",
  "attachments": [
    {
      "filename": "documento.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 125000,
      "extractedChars": 5000,
      "previewChars": 5000,
      "isTruncated": false
    }
  ],
  "citations_block": "SOURCES:\n- [RAG] ..." 
}
```

### Output JSON (Expert Packet)

```json
{
  "summary": "Riassunto del caso in 2-3 frasi",
  "facts": [
    "Fatto verificabile 1",
    "Fatto verificabile 2"
  ],
  "user_question": "Domanda principale estratta",
  "ai_draft_quality": "medium",
  "missing_info_questions": [
    "Domanda da fare all'utente per completare analisi",
    "Altra domanda necessaria"
  ],
  "risk_level": "medium",
  "citations": [
    "Art. 123 Codice Civile",
    "Sentenza Cass. n. 456/2023"
  ],
  "draft_answer": "Riassunto risposta AI",
  "expert_actions": [
    "Verificare normativa X",
    "Richiedere documento Y all'utente"
  ],
  "notes_for_expert": "Contesto rilevante per revisione umana"
}
```

---

## 🚀 API Endpoint

### POST /api/cases/request-expert

**Autenticazione:** ✅ Required  
**Entitlement:** ✅ Active subscription required

**Rate limit:** `EXPERT_RPM` richieste/minuto per userId (default: 10)

#### Request

```http
POST /api/cases/request-expert HTTP/1.1
Content-Type: application/json

{
  "conversationId": "cmk..."
}
```

#### Response Success (200)

```json
{
  "success": true,
  "caseId": "cmk...",
  "status": "WAITING_EXPERT"
}
```

Se la richiesta viene deduplicata:

```json
{
  "success": true,
  "caseId": "cmk...",
  "status": "WAITING_EXPERT",
  "reused": true
}
```

#### Error Responses

**401 Unauthorized**
```json
{
  "error": "Non autorizzato"
}
```

**402 Payment Required**
```json
{
  "error": "Abbonamento attivo richiesto per richiedere parere esperto"
}
```

**404 Not Found**
```json
{
  "error": "Conversazione non trovata o non autorizzato"
}
```

**400 Bad Request**
```json
{
  "error": "conversationId richiesto"
}
```

```json
{
  "error": "Conversazione deve contenere almeno una domanda e una risposta AI"
}
```

**429 Too Many Requests**
```json
{
  "error": "rate_limited",
  "retry_after_seconds": 42
}
```

**500 Internal Server Error**
```json
{
  "error": "workflow_not_configured",
  "workflow": "system_expert_packet_v1"
}
```

```json
{
  "error": "Errore generazione dossier esperto",
  "details": "Error message from workflow",
  "caseId": "cmk...",
  "status": "OPEN"
}
```

---

## 🎨 UI Component

### Bottone "Richiedi parere esperto"

**Location:** `components/chat/message-list.tsx`  
**Icona:** `UserPlus` (lucide-react)  
**Colore:** Verde (border-green-500, text-green-600)  
**Visibilità (MVP-2):** il bottone appare solo se il workflow chat attivo ha `allowExpertEscalation=true`, l’utente è entitled, il messaggio è l’ultimo `ASSISTANT` della conversazione e non esiste già un Case `OPEN/WAITING_EXPERT`.

**Posizione (MVP-2):** in fondo al messaggio `ASSISTANT`, in un blocco “Azioni” (visibile dopo lo scroll naturale).

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleRequestExpert}
  disabled={isRequestingExpert || expertRequestSuccess}
  className="h-10 w-10 sm:h-8 sm:w-8 p-0 border-green-500 text-green-600 hover:bg-green-50 cursor-pointer disabled:opacity-50"
  title={expertRequestSuccess ? "Richiesta inviata" : "Richiedi parere esperto"}
>
  <UserPlus className="h-5 w-5 sm:h-4 sm:w-4" />
</Button>
```

### UX Flow

1. Utente legge risposta AI
2. Clicca bottone verde UserPlus
3. Appare confirm dialog: "Vuoi richiedere un parere esperto su questa risposta?"
4. Se conferma:
   - Bottone diventa disabled
   - Chiamata POST /api/cases/request-expert
   - Alert con esito:
     - ✅ Success: "Richiesta inviata con successo! Caso ID: cmk..."
     - ❌ Error: Mostra messaggio errore

---

## 🧪 Test Cases

Test plan minimo (micro-hardening):

1. Rate limit: dopo N richieste/minuto → 429 `rate_limited`
2. Doppio click: 1 solo Case creato → response `reused:true`
3. Response: non include `expertPacket`
4. Workflow mancante: 500 `workflow_not_configured`

### TEST 1: Utente non loggato → 401

**Setup:**
- Logout dall'applicazione
- Tentare chiamata diretta API

**Richiesta:**
```bash
curl -X POST http://localhost:3000/api/cases/request-expert \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "cmk..."}'
```

**Risultato atteso:**
```json
{
  "error": "Non autorizzato"
}
```
**Status:** 401

---

### TEST 2: Utente senza subscription → 402

**Setup:**
- Login come utente senza abbonamento attivo
- O con abbonamento scaduto

**Richiesta:**
```javascript
await fetch('/api/cases/request-expert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversationId: 'cmk...' })
});
```

**Risultato atteso:**
```json
{
  "error": "Abbonamento attivo richiesto per richiedere parere esperto"
}
```
**Status:** 402

---

### TEST 3: Conversation di altro utente → 404

**Setup:**
- Login come user A (pippo@kennedyi.it)
- Tentare di richiedere expert su conversazione di user B

**Richiesta:**
```javascript
await fetch('/api/cases/request-expert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversationId: 'conversation-of-user-b' })
});
```

**Risultato atteso:**
```json
{
  "error": "Conversazione non trovata o non autorizzato"
}
```
**Status:** 404

---

### TEST 4: Richiesta valida → 200 + Case WAITING_EXPERT

**Setup:**
- Login come pippo@kennedyi.it (ConsulPro attivo)
- Conversazione esistente con almeno 1 domanda utente + 1 risposta AI

**Richiesta:**
```javascript
const response = await fetch('/api/cases/request-expert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversationId: 'cmkmhots0001n3r7260wlnajb' })
});

const data = await response.json();
```

**Risultato atteso:**
```json
{
  "success": true,
  "caseId": "cmk...",
  "status": "WAITING_EXPERT"
}
```

**Verifica DB:**
```sql
SELECT * FROM "Case" WHERE id = 'cmk...';
-- status = 'WAITING_EXPERT'
-- expertPacket IS NOT NULL

SELECT * FROM "CaseMessage" WHERE "caseId" = 'cmk...';
-- Esiste almeno 1 messaggio role='SYSTEM' con metadata workflow
```

**Status:** 200

---

### TEST 5: Workflow execution error → 500 + Case OPEN

**Setup:**
- Workflow system_expert_packet_v1 configurato con modello inesistente
- O API key OpenAI non valida

**Richiesta:**
```javascript
const response = await fetch('/api/cases/request-expert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversationId: 'cmk...' })
});
```

**Risultato atteso:**
```json
{
  "error": "Errore generazione dossier esperto",
  "details": "Error: Invalid API key or model not found",
  "caseId": "cmk...",
  "status": "OPEN"
}
```

**Verifica DB:**
```sql
SELECT * FROM "Case" WHERE id = 'cmk...';
-- status = 'OPEN' (non è passato a WAITING_EXPERT)
-- expertPacket contiene { error: "...", input: {...} }
```

**Status:** 500

---

### TEST 6: Allegato presente → Attachments inclusi nel payload

**Setup:**
- Conversazione con ultimo messaggio USER contenente file allegato
- Message.attachments popolato con metadata

**Esempio Message.attachments:**
```json
[
  {
    "filename": "contratto-locazione.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 125000,
    "extractedChars": 5000,
    "uploadedAt": "2026-01-20T11:30:00.000Z",
    "previewChars": 5000,
    "isTruncated": false
  }
]
```

**Richiesta:**
```javascript
const response = await fetch('/api/cases/request-expert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversationId: 'cmk...' })
});

const data = await response.json();
```

**Risultato atteso:**

La response NON include `expertPacket` (salvato solo a DB). L'endpoint deve ritornare:

```json
{
  "success": true,
  "caseId": "cmk...",
  "status": "WAITING_EXPERT"
}
```

**Verifica workflow input:**

Il payload inviato al workflow deve contenere:
```json
{
  "attachments": [
    {
      "filename": "contratto-locazione.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 125000,
      "extractedChars": 5000,
      "previewChars": 5000,
      "isTruncated": false
    }
  ]
}
```

Nota citazioni (MVP):
- `citations_block` viene estratto da `SOURCES:` fino a fine messaggio
- Se `SOURCES:` non è presente, `citations_block` viene passato come `null`

**Status:** 200

---

## 📁 File Modificati/Aggiunti

### Database

- ✅ `prisma/schema.prisma` - 4 enum, 2 models, relazioni
- ✅ `prisma/migrations/20260120113435_add_expert_case_system/` - Migration SQL

### Backend

- ✅ `app/api/cases/request-expert/route.ts` - Endpoint principale (240 righe)
- ✅ `scripts/seed-expert-workflow.js` - Seed workflow globale (120 righe)

### Frontend

- ✅ `components/chat/message-list.tsx` - Bottone UserPlus + handler (30 righe modificate)
- ✅ `components/chat/chat-interface.tsx` - Passa conversationId (1 riga)

### Documentazione

- ✅ `docs/EXPERT_CASE_MVP.md` - Questo file
- ✅ `docs/EXPERT_FLOW_READINESS.md` - Assessment tecnico preliminare

---

## 🚦 Deployment Checklist

### Pre-deployment

- [ ] Eseguire migration: `npx prisma migrate deploy`
- [ ] Rigenerare Prisma Client: `npx prisma generate`
- [ ] Creare workflow: `node scripts/seed-expert-workflow.js`
- [ ] Verificare API key OpenAI in production env
- [ ] Test endpoint con Postman/curl

### Post-deployment

- [ ] Verificare workflow ID in DB production
- [ ] Test e2e con utente reale
- [ ] Monitorare logs WorkflowExecutionLog
- [ ] Verificare creazione Case in DB
- [ ] Test UI button funzionante

---

## 🔒 Guardrail Esistenti Rispettati

✅ **Entitlement check:** Subscription attiva required (402 se mancante)  
✅ **Rate limit:** Dedicato su `POST /api/cases/request-expert` (`EXPERT_RPM`, default 10/min)  
✅ **MAX_FILE_BYTES:** Validato in `/api/chat` prima del salvataggio Message  
✅ **MAX_INPUT_TOKENS:** Controllato prima esecuzione workflow  
✅ **User ownership:** Conversazione deve appartenere all'utente (404 altrimenti)  
✅ **No workflow type changes:** Usa infrastruttura esistente (executeWorkflow)  
✅ **Minimal UI changes:** Solo 1 bottone aggiunto accanto a TTS

---

## 🎯 Prossimi Sviluppi (Fuori Scope MVP)

- Admin UI per gestire casi in `/dashboard/admin/cases`
- Notifiche email a esperti quando caso assegnato
- Dashboard casi utente in `/dashboard/my-cases`
- Workflow per risposta esperto → utente
- Analytics: tempo medio risoluzione, tassi soddisfazione
- Auto-assignment algoritmo basato su carico lavoro esperti

---

**Fine Documentazione MVP**
