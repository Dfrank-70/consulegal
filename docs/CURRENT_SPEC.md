# CURRENT SPEC (GOLD)

**Status:** ACTIVE  
**Last updated:** 2026-01-22

Questo documento è la **singola fonte di verità** per lo stato/spec attuale.  
I documenti storici sono in `docs/archive/`.

---

## 1) Terminologia

- **Chat workflow (A):** workflow assegnato all’utente/conversazione, genera la risposta AI in chat. Può abilitare/disabilitare escalation.
- **System workflow (B):** workflow globale di sistema, non assegnabile agli utenti. In particolare: `system_expert_packet_v1`.
- **Richiesta esperto (oggi MVP):** entità persistita come `Case` (Prisma) con stato (`OPEN`, `WAITING_EXPERT`, `ANSWERED`, `CLOSED`).

---

## 2) CTA rules definitive (Chat UI)

### 2.1 Visibilità/abilitazione CTA “Chiedi parere all’esperto”

La CTA in chat è mostrata/abilitata solo se:

- `allowExpertEscalation=true` sul workflow chat attivo
- utente **entitled** (abbonamento attivo)
- la CTA è riferita all’**ultima risposta `ASSISTANT`** (non su messaggi intermedi)
- se esiste già un `Case` in `OPEN` o `WAITING_EXPERT` per quella `conversationId`, la CTA risulta **disabilitata** (richiesta già in corso)

Note implementative:
- Frontend: `components/chat/message-list.tsx` (logica `canShowExpertAction`)
- Backend status (gating UI): `GET /api/cases/status?conversationId=...` ritorna `pendingExpertCaseStatus`.

---

## 3) Gating 6B (assignedExpertId) — auto-assign

### Regola MVP (attuale)

- Ogni customer può avere un **esperto di default** associato.
- Alla creazione della richiesta esperto, il sistema assegna automaticamente la richiesta a quell’esperto.

### Mapping implementativo (nomi attuali)

- `User.defaultExpertId` (Prisma) = **assignedExpertId** (nella tua nomenclatura di gating)
- `Case.assignedToId` = expert a cui la richiesta è assegnata

Se `defaultExpertId` non è impostato:
- `Case.assignedToId = null` (fallback MVP)

---

## 4) Snapshot / contesto expert + summary on-demand (1B,2B,3B,4A)

### 4.1 Contesto completo

Nel pannello expert, quando si apre una richiesta:
- si mostra la **chat completa** della `Conversation` collegata (non `take:2`).

### 4.2 Evidenza coppia target

La UI evidenzia la coppia target:
- **ultima domanda utente** (`USER`)
- **ultima risposta AI** (`ASSISTANT`)

### 4.3 Sintesi LLM on-demand (mai implicita)

- L’esperto può cliccare “Genera sintesi” solo su richiesta.
- Il risultato è persistito su DB e riutilizzato su riapertura.

Endpoint:
- `POST /api/expert/requests/:id/generate-summary`

Persistenza:
- `Case.expertSummary` (Json)
- `Case.expertSummaryProvider`, `Case.expertSummaryModel`, `Case.expertSummaryCreatedAt`

Configurazione (admin):
- `ExpertAssistantConfig` (DB) + pagina admin `/dashboard/admin/expert-assistant`

### 4.4 Parere esperto

- L’esperto scrive nel textarea e invia.
- La risposta viene salvata in:
  - `CaseMessage(role=EXPERT)`
  - `Message(role=ASSISTANT, meta.authorType='expert')` per propagazione in chat

---

## 5) MVP scope vs backlog

### In scope (MVP corrente)

- Escalation controllata da `allowExpertEscalation`
- Creazione richiesta esperto come `Case` con dedup
- System workflow `system_expert_packet_v1` genera `expertPacket`
- Expert inbox + dettaglio con chat completa
- Expert Assistant: **summary on-demand** + config DB/admin

### Backlog (non in scope adesso)

- Migrazione da `Case` a `ExpertRequest` come modello unificato (VALIDATION / WRITTEN / VIDEO)
- “Validazione esperto” con badge e scope sul singolo messaggio AI (diagramma D2)
- Evidenziazione/label nella chat utente della risposta esperto (UI user)
- CTA “sempre visibili” come barra persistente multi-azione (se richiesto dalla UX finale)
- Pagamenti/SLA per parere scritto e videocall

---

## 6) Riferimenti (doc attivi)

- Policies:
  - `SUBSCRIPTION_POLICY.md`
  - `RATE_LIMITING.md`
  - `ATTACHMENTS_IMPLEMENTATION.md`
  - `WORKFLOW_ROLES.md`
  - `EXPERT_ASSISTANT.md`
- Flussi:
  - `FLOWS_DIAGRAMS.md`
- TODO:
  - `TODO_NEXT_SESSION.md`
