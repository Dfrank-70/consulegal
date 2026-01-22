# ARCHIVED

**Superseded by:** `docs/CURRENT_SPEC.md`

**Archived copy:** `docs/archive/2026-01-22_EXPERT_CASE_MVP-2.md`

---

# Expert Case MVP-2 — Escalation controllata dal Workflow Chat

## Obiettivo

Separare in modo coerente:

- **Chat workflows (per utente):** generano risposte in chat e possono abilitare/disabilitare l’escalation.
- **1 Expert Packet workflow (di sistema):** `system_expert_packet_v1` (globale) usato solo per generare dossier.

## Regola chiave

Il bottone “Chiedi parere all’esperto” **non dipende** dalla mera presenza di una risposta.

Compare solo se il workflow chat attivo ha:

- `allowExpertEscalation=true`

## Flag

- Prisma: `Workflow.allowExpertEscalation Boolean @default(false)`
- Default: `false`

## UI

- Il toggle `allowExpertEscalation` è configurabile nell’editor workflow.
- Il toggle non è previsto per workflow di sistema (`system_*`).

## Chat UI: criteri di rendering bottone

Il bottone è mostrato solo quando:

- `allowExpertEscalation=true`
- utente entitled
- il messaggio è l’ultimo `ASSISTANT`

Se esiste un Case `OPEN`/`WAITING_EXPERT` per la conversazione:

- bottone disabilitato “Richiesta inviata (in attesa)”

## Backend

- `POST /api/cases/request-expert` resta invariato (guardrail + dedup + rate limit + no expertPacket in response).
- L’endpoint seleziona sempre il workflow di sistema `system_expert_packet_v1`.

## Default Expert (auto-assign)

- Ogni **CUSTOMER** ha un `defaultExpertId`.
- Nuove richieste **auto-assegnate** a quell’expert (se presente).
- Se non impostato → case **unassigned** (fallback MVP).

## Expert Inbox

- Lista mostra **solo** cases assegnati all’expert loggato.
- Bottone manuale: **“Controlla nuove richieste”** + timestamp ultimo refresh.

## Workflow System (filtro + blocco edit)

- I workflow `system_*` **non compaiono** in Gestione Workflow.
- Se aperti via URL → pagina **read-only**.

## Snippet filtro workflow

```ts
const workflows = await prisma.workflow.findMany({
  where: { name: { not: { startsWith: 'system_' } } },
  include: { nodes: true, edges: true, users: { select: { id: true, name: true, email: true } } },
  orderBy: { createdAt: 'desc' },
});
```

## File modificati

- `prisma/schema.prisma` (defaultExpertId + relation)
- `app/api/admin/users/route.ts`
- `app/api/admin/users/[userId]/route.ts`
- `app/dashboard/admin/users/page.tsx`
- `app/api/cases/request-expert/route.ts`
- `app/dashboard/expert/cases/page.tsx`
- `app/api/admin/workflows/route.ts`
- `app/api/admin/workflows/[id]/route.ts`
- `app/dashboard/admin/workflows/[id]/page.tsx`

## Test plan (aggiornato)

1) Admin assegna **defaultExpertId** a un customer.
2) Customer clic “Chiedi parere” → Case nasce già `assignedToId=expert`.
3) Expert → “Controlla nuove richieste” → case visibile in inbox.
4) Customer senza defaultExpertId → Case unassigned visibile ad admin.
5) Dedup: seconda richiesta stessa conversation → riuso case senza duplicati.
6) system_expert_packet_v1 non compare in lista workflow; edit bloccato.

**E2E eseguito (porta 3001):** customer → richiesta parere → case auto-assegnato → expert inbox aggiornata con bottone “Controlla nuove richieste”.

---

# Onboarding Esperti — MVP

## Ruoli
- `CUSTOMER`, `ADMIN`, `EXPERT`, `EXPERT_PENDING`

## Modello
- `ExpertProfile` con status `PENDING | APPROVED | REJECTED`

## UX
- Login: link “Sei un esperto? Richiedi accesso” → `/expert/apply`
- Apply page: form + consenso privacy (obbligatorio)
- Pending: `/expert/status` mostra “in revisione” o “rifiutata”

## API
- `POST /api/expert/apply`
- `GET /api/admin/experts/requests`
- `PUT /api/admin/experts/requests/[id]` (approve/reject)

## Admin
- Nuova sezione: `/dashboard/admin/experts`

## Test plan onboarding
1) Apply crea `User(role=EXPERT_PENDING)` + `ExpertProfile(PENDING)`.
2) Login EXPERT_PENDING → redirect `/expert/status`.
3) Admin approva → user.role=EXPERT + profile.APPROVED.
4) Expert login → inbox casi assegnati.
5) Admin rifiuta → profile.REJECTED + accesso casi bloccato.
6) CUSTOMER flow invariato (subscription guard OK).
