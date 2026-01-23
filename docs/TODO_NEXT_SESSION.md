# TODO Next Session

Contesto architettura:

- Workflow chat (A) per utente con flag `allowExpertEscalation`
- Workflow di sistema (B) `system_expert_packet_v1` invocato da `POST /api/cases/request-expert`
- UI bottone “Chiedi parere all’esperto” in fondo all’ultima risposta assistant, visibile solo se `allowExpertEscalation=true` + entitlement + no Case aperto

## Checklist (ordine consigliato)

1) DOC ALIGNMENT (MVP)
   1. Aggiornare `docs/EXPERT_CASE_MVP-3.md`:
      - Rimuovere/aggiornare frase “rate limit ereditato da auth middleware”
      - Sostituire con “rate limit dedicato `EXPERT_RPM`”
   2. Aggiornare snippet “workflow lookup”:
      - Usare selezione deterministica del workflow globale con `orderBy: { createdAt: 'desc' }`
      - Verificare che la query selezioni sempre l’ultimo `system_expert_packet_v1` globale

2) UI/UX BOTTONE “CHIEDI PARERE” (MVP)
   1. Verificare gating in UI:
      - `allowExpertEscalation=true` sul workflow chat attivo
      - entitlement in stato `active` o `trialing`
      - se esiste Case `OPEN`/`WAITING_EXPERT` per `conversationId` → bottone **disabled** con label “Richiesta inviata (in attesa)”
   2. Verificare posizionamento:
      - bottone nel blocco “Azioni” in fondo all’ultima risposta `ASSISTANT`
      - non appare su messaggi non-ultimi o su messaggi `USER`

3) BACKEND STATUS CASE PER UI (se manca) (MVP)
   1. Aggiungere un modo minimo per conoscere se esiste già un Case `OPEN`/`WAITING_EXPERT` per conversazione:
      - Opzione A: endpoint `GET /api/cases/status?conversationId=...` che ritorna `{ pendingExpertCaseStatus }`
      - Opzione B: dedurre dallo stato dopo click (`reused:true`) e memorizzare in client state
   2. Scegliere la via più semplice, implementarla e documentarla (motivazione + impatto su UI).

4) EXPERT REPLY MVP (post-hardening) (MVP)
   1. Progettare come inserire la risposta dell’esperto in chat con modifiche minime:
      - Audit modelli `Message`/`Conversation` e renderer UI
      - Scelta MVP:
         - Opzione A: `role='ASSISTANT'` + `meta.author='expert'` + badge UI
         - Opzione B: nuovo ruolo `EXPERT` (se compatibile con schema/renderer)
   2. Implementare pagina admin minima “Cases”:
      - lista Case `WAITING_EXPERT`
      - detail: mostra `expertPacket` + textarea risposta + CTA “Invia”
      - su invio: aggiornare status a `ANSWERED` e creare il messaggio in chat

5) NOTIFICHE MINIME (optional)
   1. Inbox admin con badge “Nuovi” (conteggio Case in `WAITING_EXPERT`)
   2. (Opzionale) Slack webhook o email “nuovo case” senza PII
