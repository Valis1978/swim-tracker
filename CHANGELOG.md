# Changelog

## 2026-10-16 — Jména soupeřek / Rivals by name

**CZ:** Viki vidí jména ostatních plavkyň (veřejné výsledky a startovky svazu): v přehrání rozplavby i ročníku (sloupec jmen u drah jako v televizi, do 15 drah), v seznamu „Tvoje rozplavba“ před závodem a v novém rozbalovacím seznamu „Kdo plaval s tebou“ (rozplavba + celý ročník s časy). Přehrání je přes celou šířku karty, písmo větší. Jména se ukládají ze startovky OMEGA a z výsledků kategorie; starší závody doplněny. Zobrazuje se jen se zapnutým pořadím.

**EN:** Rival names (public CSPS results and start lists) in heat and birth-year replays (TV-style lane list, up to 15 lanes), the pre-race heat lineup and a new collapsible "Kdo plaval s tebou" list (heat + birth year with times). Replay spans the full card width with larger type. Names stored from the OMEGA start list and category results; past meets backfilled. Shown only when placings are enabled.

## 2026-10-16 (soupeřky)

### CZ
- **Přehrání závodu začíná rozplavbou**, Viki hned vidí soupeřky ve skutečných drahách; proti rekordu a ročník jsou další záložky.
- **Soupeřky u nadcházejícího závodu:** po zveřejnění startovky ukáže každá rozlosovaná trať celou rozplavbu (dráha,
  ročník, oddíl, přihlášený čas) a přehrání „jak by to dopadlo podle přihlášených časů". Bez jmen dětí.
- Animace pro Viki kdykoli na `/animace` (tlačítko na domovské obrazovce).

### EN
- Replay opens on the real heat; upcoming drawn races show the whole heat from the OMEGA start list (lane, birth
  year, club, entry time, no names) and a predicted replay at entry times. Kid-accessible animation gallery.

## 2026-10-16 (tričko a celé rozplavby)

### CZ
- **„Dnes závodíš!"** začíná na bloku v oddílovém bílém tričku a trenýrkách: zamává, tričko shodí, připraví se a skočí.
- **Přehrání závodu má tři pohledy:** proti rekordu, **celá rozplavba** (skutečné dráhy, ročníky a časy všech
  plavkyň v její rozplavbě) a **celý ročník** (všechny holky jejího ročníku z té trati v jednom bazénu). Rozplavbu
  a ročník Viki uvidí jen se zapnutým pořadím. Jména ostatních dětí appka neukládá.

### EN
- Race-day intro in the club T-shirt; replay views: ghost, real heat (lanes, birth years, times) and whole birth year.
- Heat and birth-year field stored per swum entry from CSPS results (group = heat, line = lane), no names.

## 2026-10-16 (čepice a oddílová výbava)

### CZ
- **Viki si vybírá čepici** své postavičky na domovské obrazovce: oddílová půlená modrobílá (výchozí) nebo modrá, bílá,
  červená, žlutá, růžová, tyrkysová, fialová. Volba platí ve všech animacích i v přehrání závodu.
- **Oddílová výbava OSP Hodonín** podle fotek z webu oddílu: královská modrá mikina s bílou značkou a trenýrky
  na lavičce náhradníků (po postupu ji shodí), plavky v klubové modré.
- **Medaile na stupních vítězů** v oddílové mikině místo mávání z vody.
- Nastavení → **Ukázky animací** pro rodiče.

### EN
- Kid-selectable cap (club half-and-half cap by default, 7 bright colours) used by every animation and the replay;
  `/api/avatar` is the only API the kid role may call (validated allowlist).
- Club kit from the club's own photos: royal blue hoodie and shorts on the reserves' bench, club-blue swimsuit.
- Medal moment on a podium; parent preview page of all animations.

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
