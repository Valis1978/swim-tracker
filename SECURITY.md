# Přihlášení a provoz

- `AUTH_SECRET` musí obsahovat alespoň 32 náhodných znaků. Bez něj nelze
  vytvořit ani ověřit relaci. `PARENT_PIN` a `KID_PIN` nastavují samostatné
  role; chybějící PIN danou roli vypne. PIN je řetězec o 1–128 znacích.
- Relace má podepsanou roli a serverem ověřovanou platnost 30 dní. Změna
  příslušného PINu nebo tajného klíče ji okamžitě zneplatní. Při přechodu
  ze starších statických cookies se uživatelé přihlásí znovu.
- Přihlášení má společný limit 10 pokusů za 15 minut na instanci, včetně
  úspěšných pokusů. Limit nevěří hlavičkám s IP adresou. Pro více instancí
  nebo ochranu proti úmyslnému vyčerpávání limitu přidejte sdílenou ochranu
  na vstupním proxy; stav tohoto lokálního limitu se restartem resetuje.
- Privátní stránky kontrolují roli před načtením dat. Rodičovská API ověřují
  relaci také v handleru. Proxy je další vrstva a zjednodušuje přesměrování.
- Synchronizace používá vlastní `SYNC_TOKEN`. Existující GET a parametr
  `token` zůstávají kvůli kompatibilitě plánovače. Pro nové volání používejte
  POST a hlavičku `x-sync-token`, aby se tajemství neukládalo do URL logů.

## Lokální ověření

Testy používají syntetické PINy a nepotřebují produkční proměnné ani databázi.
Nativní spuštění TypeScriptu v testech vyžaduje Node 22.18 nebo novější.

```sh
npm ci
npm run test:security
npx tsc --noEmit
npm run build
npm run test:security:http
```

HTTP test spouští sestavenou aplikaci pouze na loopbacku a předává jí jen
syntetické přihlašovací údaje. Úspěšná autorizace je testována neplatným ID,
které handler odmítne ještě před síťovým voláním. Test nespouští synchronizaci.
