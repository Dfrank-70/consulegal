# Decision Log

Questo documento registra le decisioni chiave (numerate) con data, per evitare ambiguità e contraddizioni.

---

## D1 — System workflows identificati da prefisso `system_` (2026-01-??)

- **Decisione:** un workflow è “di sistema” solo se `name.startsWith('system_')`.
- **Motivazione:** `userId: null` indica template globale (chat), non “system”.

## D2 — `system_expert_packet_v1` non assegnabile e non editabile in UI admin (2026-01-??)

- **Decisione:** i workflow `system_*` sono read-only e non compaiono nei picker/lista chat workflows.

## D3 — Entità richiesta esperto MVP = `Case` (2026-01-20)

- **Decisione:** per MVP si usa `Case` come entità richiesta esperto (inbox/status/reply).
- **Motivazione:** modifiche minime e compatibili con UI/admin già esistenti.

## D4 — Auto-assign expert via `defaultExpertId` (gating 6B) (2026-01-20)

- **Decisione:** il sistema assegna la richiesta a `User.defaultExpertId` (se presente).

## D5 — `expertPacket` generato automaticamente dal workflow di sistema (2026-01-20)

- **Decisione:** al click CTA, il backend esegue `system_expert_packet_v1` e salva output in `Case.expertPacket`.

## D6 — Expert Assistant summary è solo on-demand e persistente (2026-01-22)

- **Decisione:** la sintesi/bozza per l’esperto è generata **solo su click** e viene salvata su DB.
- **Persistenza:** `Case.expertSummary*`.

## D7 — Configurazione Expert Assistant su DB (non hard-coded) (2026-01-22)

- **Decisione:** `ExpertAssistantConfig` è la configurazione attiva (provider/model/instruction/maxOutputTokens).
- **Admin UI:** `/dashboard/admin/expert-assistant`.

---

## Note

- Per specifica attuale (gold spec) vedi: [`CURRENT_SPEC.md`](./CURRENT_SPEC.md)
