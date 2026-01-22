# Expert Assistant (MVP)

Questo documento descrive l’MVP “Expert Assistant” per rendere il pannello expert **human-friendly** e introdurre la **sintesi LLM on-demand** persistente su DB.

## Obiettivo

Quando un esperto apre una richiesta (oggi: `Case`) deve vedere:

- conversazione completa (tutti i messaggi della `Conversation`)
- evidenza della coppia target “ultima domanda utente + ultima risposta AI”
- sintesi LLM **solo on-demand** (mai generata implicitamente)
- textarea per scrivere il parere e inviare risposta
- bottone per copiare la bozza (draft) nel textarea
- JSON tecnico solo in sezione collassabile (default chiuso)

---

## Data model (Prisma)

### Nuovo model

`prisma/schema.prisma`

```prisma
model ExpertAssistantConfig {
  id                String   @id @default(cuid())
  isActive          Boolean  @default(true)
  provider          String   @default("openai")
  model             String   @default("gpt-4o-mini")
  customInstruction String
  maxOutputTokens   Int      @default(800)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@index([isActive])
}
```

### Campi aggiunti a `Case`

```prisma
expertSummary          Json?
expertSummaryProvider  String?
expertSummaryModel     String?
expertSummaryCreatedAt DateTime?
```

---

## UI Expert (pannello expert)

### Dettaglio richiesta

File: `app/dashboard/expert/cases/[id]/page.tsx`

Nota UX:
- La pagina è scrollabile verticalmente (contenitore con `overflow-y-auto`) per evitare che conversazioni/sintesi lunghe risultino non raggiungibili.

Sezioni:

1. **Conversazione (contesto completo)**
   - mostra `conversation.messages` in ordine cronologico
   - label/chips:
     - `USER` → “Utente”
     - `ASSISTANT` → “AI”
     - `ASSISTANT` con `meta.authorType === 'expert'` → “Esperto”
   - highlight:
     - evidenzia *ultimo* messaggio `USER` e *ultimo* messaggio `ASSISTANT` (ring giallo)

2. **Sintesi LLM (assistente esperto) — ON DEMAND**
   - se non presente: mostra “Non generata” + bottone “Genera sintesi”
   - se presente: render leggibile per sezioni + bottone “Rigenera sintesi”
   - bottone “Copia bozza nel parere”: copia `expertSummary.draft_opinion` nel textarea

3. **Parere dell’esperto**
   - textarea + bottone invio come oggi

4. **Dettagli tecnici (JSON)**
   - `details/summary` collassabile (default chiuso)
   - mostra `expertPacket` con `JSON.stringify(..., null, 2)`

---

## Settings Admin (Expert Assistant Settings)

### Pagina

- `app/dashboard/admin/expert-assistant/page.tsx`

Permette di salvare:
- `provider` (openai/claude)
- `model`
- `customInstruction` (obbligatoria)
- `maxOutputTokens`

### API

- `GET /api/admin/expert-assistant-config`
  - ritorna config attiva
  - se non esiste, ne crea una con instruction default (v1)

- `PUT /api/admin/expert-assistant-config`
  - disattiva eventuali config attive (`isActive=false`)
  - crea una nuova config attiva

---

## Endpoint: Generate Summary (on-demand)

Endpoint:

- `POST /api/expert/requests/:id/generate-summary`

AuthZ:
- `ADMIN` sempre
- `EXPERT` solo se `Case.assignedToId === session.user.id`

Caricamento dati:
- `Case` + `conversation.messages` **completi** (`orderBy createdAt asc`)

Input al modello:
- serializza in testo i messaggi in ordine cronologico
- include `attachments` solo come metadata JSON (no parsing aggiuntivo)

Config:
- legge `ExpertAssistantConfig` attiva

Output:
- chiede al modello di restituire **solo JSON valido** nel seguente schema

Schema JSON salvato in DB (`Case.expertSummary`):

```json
{
  "summary": "Testo 5-10 righe",
  "key_points": ["...", "..."],
  "open_questions": ["...", "..."],
  "assumptions": ["...", "..."],
  "risk_flags": [
    { "level": "low|medium|high", "text": "..." }
  ],
  "draft_opinion": "Bozza risposta esperto pronta da copiare",
  "notes_for_expert": ["...", "..."],
  "meta": {
    "generated_at": "ISO-8601",
    "instruction_version": "v1",
    "input_message_count": 0
  }
}
```

Persistenza:
- `Case.expertSummary`
- `Case.expertSummaryProvider`
- `Case.expertSummaryModel`
- `Case.expertSummaryCreatedAt`

Logging (minimale):
- logga solo `requestId` e `userId`

---

## File modificati/aggiunti

### Modificati
- `prisma/schema.prisma`
- `app/api/expert/cases/[id]/route.ts`
- `app/dashboard/expert/cases/[id]/page.tsx`

### Aggiunti
- `app/api/admin/expert-assistant-config/route.ts`
- `app/dashboard/admin/expert-assistant/page.tsx`
- `app/api/expert/requests/[id]/generate-summary/route.ts`
- `docs/EXPERT_ASSISTANT.md`

---

## Endpoints (nuovi/modificati)

### Nuovi
- `GET /api/admin/expert-assistant-config`
  - response: `ExpertAssistantConfig`

- `PUT /api/admin/expert-assistant-config`
  - request:
    - `provider: string`
    - `model: string`
    - `customInstruction: string` (required)
    - `maxOutputTokens: number`
  - response: `ExpertAssistantConfig` (nuova attiva)

- `POST /api/expert/requests/:id/generate-summary`
  - response:
    - `{ id, expertSummary, expertSummaryProvider, expertSummaryModel, expertSummaryCreatedAt }`

### Modificati
- `GET /api/expert/cases/:id`
  - ora include:
    - `conversation.messages` completi
    - `expertSummary*`

---

## Test plan (manuale) — 8 casi

1. **Expert vede chat completa**
   - apri un case con conversazione lunga
   - verifica che la sezione “Conversazione” mostri tutti i messaggi

2. **Summary non presente di default**
   - apri un case appena creato
   - verifica che “Sintesi LLM” mostri “Non generata”

3. **Click “Genera sintesi” → genera e salva**
   - click su “Genera sintesi”
   - verifica che compaiano i contenuti nelle sezioni

4. **Reopen → summary persiste**
   - ricarica pagina / riapri dettaglio
   - verifica che la sintesi sia ancora presente

5. **Rigenera → sovrascrive**
   - click “Rigenera sintesi”
   - verifica che `expertSummaryCreatedAt` cambi e i contenuti siano aggiornati

6. **Copy draft → textarea popolato**
   - click “Copia bozza nel parere”
   - verifica che textarea contenga `draft_opinion`

7. **JSON tecnico nascosto (default closed)**
   - verifica che “Dettagli tecnici (JSON)” sia collassato di default

8. **Settings cambiano provider/model/instruction e vengono usati dall’endpoint**
   - vai su `/dashboard/admin/expert-assistant`
   - modifica `model`/instruction e salva
   - rigenera sintesi e verifica che `expertSummaryProvider/model` riflettano i nuovi valori

9. **Scroll verticale presente su dettaglio expert**
   - apri un case con conversazione/sintesi lunga
   - verifica che la pagina consenta scroll verticale e che tutte le sezioni siano raggiungibili
