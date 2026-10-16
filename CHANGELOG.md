# Changelog

## 2026-10-16 (animace)

### CZ
- **Kreslené animace ve chvílích, které se počítají.** Na domovské obrazovce se jednou přehraje to nejdůležitější:
  nový osobák (tabule se dotočí na nový čas), medaile v ročníku, postup z náhradnic (karta se přetočí na rozplavbu
  a dráhu), den závodu a zveřejněné rozplavby (skok ze startovního bloku s číslem její dráhy). Pak zůstane „Přehrát znovu".
- **Závod znovu:** u každé odplavané trati jde přehrát závod shora v její skutečné dráze proti duchovi předchozího
  rekordu, pro 25 i 50m bazén.
- Bez knihoven a videí: SVG + canvas + jednoduchá fyzika vody, respektuje „omezit pohyb".

### EN
- Cartoon "moments" (personal best, medal, reserve promoted, race day / heats drawn) played once per event on the home
  screen and race page, then available as "replay".
- Race replay from above against the ghost of the previous record, in her real lane, for 25 m and 50 m pools.
- Dependency-free engine (SVG scene, canvas particles, spring-chain water), honours reduced motion.

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
