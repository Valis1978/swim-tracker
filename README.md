# swim-tracker — Plavání · Valentovi

Family PWA tracking Viki's swimming results, CZ rankings and races. Data from the public CSPS portal (vysledky.czechswimming.cz), cached in Supabase, synced daily.

## Env
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Valis1978 project, `swim_*` tables
- `FAMILY_PIN` — login PIN, `AUTH_SECRET` — cookie hash salt
- `SYNC_TOKEN` — token for `POST /api/sync` (daily cron)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — new-result notifications

## Sync
`POST /api/sync?token=...` — pulls swimmers' results + season rankings, detects new results, sends Telegram, awards badges. Run daily (evening) via cron.
