# Changelog

## 2026-10-16

### CZ
- **Přihlášky na závody naživo.** Ke každé přihlášené trati appka ukazuje stav: přihlášená, náhradnice (s pořadím),
  potvrzená, rozplavba a dráha, tentokrát ne, odhlášeno, odplaváno. Čte přihlášky ČSPS, seznam po odhláškách od pořadatele
  (PDF), startovku (OMEGA CSV nebo PDF) a výsledky. Každá změna se zapíše do historie („náhradnice č. 1 → rozplavba 8,
  dráha 2 → 2:07,85") a rodič dostane upozornění na Telegram.
- **Detail závodu** (`/zavod/[id]`): průběh přihláška → odhlášky → losování → závod → výsledky, program po půldnech
  s časem rozplavání a startu, plánek bazénu s drahou, dokumenty od pořadatele.
- **Moje rekordy** (`/rekordy`) zvlášť pro krátký (25 m) a dlouhý (50 m) bazén, včetně oficiálních mezičasů.
- **Pořadí na závodech** v ročníku u každé odplavané trati; v dětském pohledu jde vypnout v Nastavení.
- Nový vzhled: vlastní značky plaveckých způsobů, lano s bójkami, písmo Lexend, hlavička s hladinou.
- Synchronizace má režim `mode=live` pro závodní dny a `backfill=<dny>` pro doplnění historie.

### EN
- **Live race entries.** Every entered race shows its status (entered, reserve with order, accepted, heat and lane,
  not accepted, withdrawn, swum) resolved from CSPS applications, the organiser's accepted list (PDF), the start list
  (OMEGA CSV or PDF) and results. Changes are kept in a per-entry history and pushed to the parent via Telegram.
- Race detail page with process stepper, half-day schedule, lane map and organiser documents.
- Personal records split by pool length (25 m / 50 m), official splits included.
- Placings within the swimmer's birth year; parent-controlled switch for the kid view.
- Visual redesign (custom stroke glyphs, lane-rope motif, Lexend body font).
- Sync supports `mode=live` (race-day polling) and `backfill=<days>`.
