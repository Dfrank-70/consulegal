# Workflow Roles

## Chat workflow (per utente)

- **Scopo:** generare la risposta in chat.
- **Assegnazione:** viene selezionato come workflow dell’utente (`User.workflowId`) oppure come workflow di default (`Workflow.isDefault=true`).
- **Tipologia nodi:** lineare (Input→LLM→Output) oppure (Input→RAG→LLM→Output).
- **Escalation:** il workflow chat espone un flag configurabile `allowExpertEscalation`.
  - Se `allowExpertEscalation=true`, la UI può mostrare il bottone “Chiedi parere all’esperto” in chat.

## System workflow (Expert Packet)

- **Scopo:** generare un dossier strutturato (“expert packet”) da inviare a revisione esperta.
- **Nome univoco (MVP):** `system_expert_packet_v1`
- **Ambito:** workflow globale di sistema (non assegnabile agli utenti).
- **Utilizzo:** viene usato esclusivamente dall’endpoint `POST /api/cases/request-expert`.

## Regole UI: bottone “Chiedi parere all’esperto”

Il bottone è visibile **solo** quando:
- Il workflow chat attivo ha `allowExpertEscalation=true`.
- L’utente è entitled (abbonamento attivo).
- Il messaggio è l’ultimo messaggio `ASSISTANT` della conversazione.

Se esiste già un Case in `OPEN` o `WAITING_EXPERT` per la conversazione:
- il bottone viene mostrato disabilitato con label “Richiesta inviata (in attesa)”.

## Backend

- `POST /api/cases/request-expert` seleziona sempre il workflow di sistema `system_expert_packet_v1` con lookup deterministico.
- I workflow `system_*` non sono assegnabili agli utenti (UI + validazione API admin).
