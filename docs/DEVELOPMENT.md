# Vývoj a architektura

## Technologie a struktura

- TypeScript, React 19, Vinext a Vite.
- Cloudflare Worker obsluhuje stránku a API; D1/SQLite přes Drizzle ukládá místnosti.
- `app/page.tsx`: hlavní klient, synchronizace a propojení komponent.
- `app/api/game/route.ts`: serverové akce, oprávnění a filtrované pohledy.
- `lib/dungeon.ts`, `lib/exploration.ts`: geometrie, patra, průchodnost, dohled a paměť mapy.
- `lib/mechanics.ts`: hody, soubojové záznamy a publikum zpráv.
- `lib/sheets.ts`: porovnání původních hodnot při editaci.
- `lib/access.ts`, `lib/backup.ts`: obnovovací klíče a úplné zálohy.
- `components/`: mapa, editory, dialogy, správa přístupů a čekající akce.
- `drizzle/`: verzované databázové migrace.

Místnost je jeden JSON s kontrolou verze databázového řádku. Souběžný zápis opakuje server proti aktuální verzi. Editory navíc posílají jen změněná pole a jejich původní hodnoty, aby starý formulář nepřepsal nové zranění. Při konfliktu server vrací 409.

Klient načítá stav po dvou sekundách. Oprávnění a soukromí se ověřují na serveru: skryté mapy, příšery a cizí poznámky se hráčům neposílají. Obnovovací klíče mají na serveru jen otisky; plná záloha nezahrnuje tokeny ani otisky klíčů.

## Lokální data a konfigurace

`.openai/hosting.json` obsahuje obecná jména vazeb DB a případného R2 úložiště. Neobsahuje identifikátor soukromého projektu. Závislost na konfiguraci vznikla z vývojové šablony a je zachována, aby fungovalo sestavení.

`vite.config.ts` připravuje lokální D1 vazbu s neprodukčním identifikátorem. `npm run db:init` používá `wrangler d1 migrations apply` s přepínačem `--local`, sestavenou konfigurací a úložištěm `.wrangler/state`. Neprovádí vzdálené migrace a neodstraňuje existující data.

`node_modules`, sestavení, databáze, pracovní stav, proměnné prostředí a soubory obnovovacích klíčů se do Gitu neukládají. Pro běžné lokální spuštění není potřeba žádný tajný `.env` soubor ani účet provozovatele hostingu.

## Ověření

```bash
npm run check
npm test
npm run build
npm run db:init
npm run test:ci
```

`test:ci` spouští vlastní vývojový server na portu 5173. Port musí být volný. Server se ukončí také při neúspěchu testů. Jednotlivé API sady vytvářejí oddělené testovací místnosti:

| Skript | Ověřuje |
| --- | --- |
| `test-game.mjs` | Místnosti, chat, šeptání, vlastnosti a zkušenosti. |
| `test-map.mjs` | Úpravy mapy, odhalování, oprávnění a vracení tahů. |
| `test-union.mjs` | Spojování půdorysů, příčky, dveře a kreslená schodiště. |
| `test-exploration.mjs` | Pohyb, dohled, paměť, vedoucí, patra a schody. |
| `test-monsters.mjs` | Správu příšer, přesuny, životy, archivaci a skrytí. |
| `test-mechanics.mjs` | Bonusy, přehazování šestek, útok/obranu a zranění. |
| `test-repairs.mjs` | Souběžnou editaci, tajné souboje, ořez chatu, klíče a úplnou obnovu. |

Node.js musí podporovat `registerHooks` a odstraňování TypeScriptových typů, proto je minimem 22.15. Testy mají používat místní emulaci; běžně se neprovádějí proti živému dobrodružství.

## Hranice současného nasazení

Server dnes přímo používá `cloudflare:workers` a D1. Obyčejné spuštění přes Node na VPS není hotová alternativa. Přechod na vlastní hosting bude vyžadovat výběr runtime, přizpůsobení databázové vrstvy, TLS a provozní postupy. Veřejný repozitář nic automaticky nenasazuje a nemění přístupy k dosavadní hostované aplikaci.

Převzaté licence a oznámení jsou v [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Nové změny přidávej pod MIT a zachovej podmínky jejich závislostí.
