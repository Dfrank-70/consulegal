# Flussi – Diagrammi (Mermaid)

> File “solo diagrammi” per knowledge base e discussion.

## D1 – Chat AI + CTA sempre visibili

```mermaid
flowchart TD
  U[Utente: invia prompt] --> P[Platform: pre-check (auth/guardrail)]
  P --> L[LLM: risposta sintetica e accurata]
  L --> UI[Chat UI: mostra risposta AI]
  UI --> CTA[CTA sempre visibili in coda]
  CTA --> V[Richiedi validazione esperto]
  CTA --> S[Richiedi parere scritto]
  CTA --> C[Richiedi consulenza videocall]
  UI --> U2[Utente: continua la chat (opzionale)]
  U2 --> P
```

## D2 – Validazione esperto (2 esiti)

```mermaid
flowchart TD
  CTA1[CTA: Richiedi validazione esperto] --> R1[Platform: crea ExpertRequest(type=VALIDATION)]
  R1 --> SEND[Invia packet a Expert]
  SEND --> E[Esperto valuta]
  E --> A{Esito?}
  A -->|Validato| BADGE[UI: badge "Validato da esperto" sul messaggio AI]
  A -->|Non validato| MSG[UI: messaggio strutturato con punti da chiarire]
  BADGE --> CTA[CTA sempre disponibili]
  MSG --> CTA
```

## D3 – Parere scritto e Videocall

```mermaid
flowchart TD
  CTA2[CTA: Parere scritto] --> PRICE[UI: prezzo/tempi/SLA + form]
  PRICE --> PAY[Pagamento + creazione request]
  PAY --> E2[Esperto redige parere firmato]
  E2 --> DELIV[UI: allegato in chat + download + tracking]
  DELIV --> CTA[CTA sempre disponibili]

  CTA3[CTA: Videoconferenza] --> AVAIL[Calendario/slot + pagamento]
  AVAIL --> CONF[Conferma meeting link + invite]
  CONF --> CALL[Video call]
  CALL -->|Opzionale| SUMMARY[UI: resoconto post-call]
  CALL --> CTA
  SUMMARY --> CTA
```

## State machine richiesta esperto (comune)

```mermaid
stateDiagram-v2
  [*] --> OPEN
  OPEN --> WAITING_EXPERT: invio/assegnazione esperto
  WAITING_EXPERT --> ANSWERED: output prodotto
  ANSWERED --> CLOSED: archiviazione (opzionale)
```
