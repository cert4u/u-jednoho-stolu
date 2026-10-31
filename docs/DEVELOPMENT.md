# Vývoj a architektura

[Dokumentace](README.md) · [API](API.md) · [Přispívání](../CONTRIBUTING.md) · [Vydávání](RELEASING.md)

## Dva podporované způsoby spuštění

| | Node / SQLite | Lokální Cloudflare |
| --- | --- | --- |
| Použití | Vlastní server, Docker a lokální ověření stejné varianty. | Původní vývojová varianta přes Wrangler. |
| Build | `npm run build:node` | `npm run build` |
| Start | `node --env-file=.env server/start.mjs` | `npm run dev` nebo po buildu `npm start` |
| Databáze | `.stul-data/game.sqlite`, případně `STUL_DATA_DIR`. V Dockeru `/data/game.sqlite`. | D1 emulovaná ve `.wrangler/state`. |
| Migrace | Při startu Node serveru. | `npm run db:init` po Cloudflare buildu. |
| Port | 8080, případně proměnná `PORT`. | Vývoj 5173; sestavená lokální varianta přes `npm start` obvykle 8787. |
| Správa `/admin` | Ano; aktualizace vyžaduje Docker updater. | Node administrace zde neběží. |
| Hlas | Volitelný LiveKit podle [návodu](VOICE.md), plně popsaný pro Node hosting. | Srovnatelný spravovaný hlasový deployment zde není připravený. |

Oba buildy používají adresář `dist`. Nespouštěj je současně a před startem zvol správný build. `npm run db:init` vyžaduje konfiguraci vytvořenou Cloudflare buildem; pro Node se nepoužívá.

## Rychlý start Node bez Dockeru

Potřebuješ Git, npm a Node **22.15.0 nebo novější**. Pro reprodukci CI používej řadu Node 22. Z kořene repozitáře:

```bash
npm run install:ci
cp -n .env.example .env
```

Existující `.env` tím nepřepisuj. Do `.env` nastav `PUBLIC_ORIGIN=http://localhost:8080`, vlastní `STUL_ADMIN_PASSWORD` (alespoň 20 znaků) a jiný `STUL_UPDATER_TOKEN` (alespoň 32). Pro každý můžeš použít zvláštní `openssl rand -hex 32`. Ponech volitelné hlasové proměnné prázdné, pokud LiveKit nepoužíváš.

```bash
chmod 600 .env
npm run build:node
node --env-file=.env server/start.mjs
```

`npm run start:node` spouští tentýž server, ale samo **nenačítá `.env`**. Použij je jen tehdy, máš-li proměnné již předané prostředím. `STUL_BIND` a `STUL_PORT` jsou proměnné pro Docker Compose; nativní server čte `PORT` a poslouchá na `0.0.0.0`. Při lokálním testu omez síťový přístup hostitelským prostředím/firewallem podle potřeby.

Pro druhou, oddělenou testovací instanci se stejným již sestaveným Node kódem můžeš v dalším terminálu použít jinou databázi a port:

```bash
PORT=18089 PUBLIC_ORIGIN=http://127.0.0.1:18089 STUL_DATA_DIR=/tmp/stul-dev-test \
  node --env-file=.env server/start.mjs
```

Port musí být volný; tuto instanci pak otevři na `http://127.0.0.1:18089`. Každá testovací družina zapisuje do uvedeného adresáře, nikoli do výchozí databáze. `Ctrl+C` server ukončí; data zůstávají do jejich samostatného odstranění. Pro tento postup musí `.env` už obsahovat platné základní hodnoty.

Administrace se otevře i bez updateru a vysvětlí, proč nejsou dostupné aktualizace a návrat verze. Provozní Docker instalace je popsaná v [SELF_HOSTING.md](SELF_HOSTING.md).

## Lokální Cloudflare vývoj

```bash
npm run install:ci
npm run build
npm run db:init
npm run dev
```

Otevři `http://127.0.0.1:5173`. Cloudflare účet ani tajný `.env` pro tuto lokální emulaci nejsou potřeba. `.openai/hosting.json` zachovává obecná jména vazeb DB/R2 z původní šablony. `vite.config.ts` vytváří lokální D1 vazbu; `db:init` aplikuje pouze místní migrace přes sestavené `dist/server/wrangler.json`. Neprovádí vzdálené nasazení ani vzdálené migrace. Repozitář žádný existující hostovaný web sám neaktualizuje.

## Struktura a tok dat

| Cesta | Odpovědnost |
| --- | --- |
| `app/page.tsx` | Herní klient, přihlášení, dvousekundová synchronizace a propojení panelů. |
| `app/api/game/route.ts` | Autentizace, oprávnění, akce a filtrovaný pohled pro příjemce. |
| `app/api/voice/route.ts`, `lib/voice.ts` | Ověření členství a krátkodobá hlasová vstupenka pouze pro mikrofon. |
| `lib/game.ts`, `db/schema.ts` | Vnitřní stav hry a tabulka místností. |
| `lib/dungeon.ts`, `lib/exploration.ts` | Geometrie, patra, dveře, propojení schodů, dohled a paměť mapy. |
| `lib/dungeon-generator.ts`, `lib/generation.ts` | Sdílený deterministický náhled, serverové vložení a ochrana kapacity/souběhu. |
| `lib/monsters.ts`, `lib/initiative.ts`, `lib/mechanics.ts` | Příšery, pořadí souboje, hody, návaznost útoku/obrany a zranění. |
| `lib/sheets.ts`, `lib/character.ts` | Deníky a ochrana změněných polí. |
| `lib/powers.ts`, `lib/conditions.ts`, `lib/life.ts`, `lib/recovery.ts` | Kouzla/magenergie, stavy, vyřazení a obnova životů/magenergie. |
| `lib/map-notes.ts`, `lib/map-note-alerts.ts`, `lib/challenges.ts` | Příprava míst, upozornění při přiblížení a zkoušky. |
| `lib/loot.ts`, `lib/equipment.ts`, `lib/journey.ts` | Kořist, výbava/měšec a čas/světlo. |
| `lib/access.ts`, `lib/backup.ts` | Obnovovací klíče a přenositelné úplné zálohy. |
| `components/` | Mapa, dialogy a herní panely; `voice-panel.tsx` spravuje WebRTC spojení. |
| `server/start.mjs`, `server/database.mjs` | Node obálka, administrace, údržba, SQLite a adaptérová vrstva. |
| `deploy/updater/` | Oddělený Docker updater, stabilní vydání, výměna kontejnerů a rollback. |
| `drizzle/` | Verzované migrace; aplikované SQL soubory se nemění. |
| `scripts/`, `.github/workflows/ci.yml` | Buildy, místní testy a CI. |

Při Node buildu alias ve `vite.config.ts` nahradí `cloudflare:workers` modulem `server/cloudflare-node.ts`. Ten poskytne SQLite adaptér pro používané D1 operace. Herní API tak sdílí Drizzle dotazy pro oba runtime.

`scripts/build-node.mjs` zapisuje `dist/stul-build.json` z verze balíčku, commitu a času. Pro řízený build podporuje `STUL_VERSION` a `STUL_REVISION`; Compose wrapper automaticky předává `STUL_BOOTSTRAP_REVISION` do sestavení. Tyto údaje neurčují herní oprávnění.

Node obálka poslouchá na veřejném aplikačním portu a předává herní požadavky vnitřnímu Vinext serveru na náhodném loopback portu. Sama obsluhuje `/healthz`, `/admin` a `/internal/*`. Hlasová média jdou přímo mezi prohlížečem a LiveKitem; neprocházejí JSON herním API ani jeho dvousekundovým pollingem.

## Souběh, opakování a soukromí

Místnost je jeden JSON v databázovém řádku s číslem verze. Server zapisuje s podmínkou na aktuální verzi a při souběhu načte nový stav; po nejvýše šesti pokusech vrátí konflikt. Klient zahazuje starší revize odpovědí.

- Editory deníků, přípravy a příšer posílají jen změněná pole s původními hodnotami `expected`.
- Strukturované akce obvykle vyžadují `expectedRevision`, případně další náhled očekávaných hodnot. Generátor má `expectedState`.
- Podporované mutace mají `requestId` a omezenou historii již provedených operací. Při síťovém opakování používej stejný identifikátor, ne nový. Není to neomezená archivní garance pro libovolně staré požadavky.
- Hody vytváří server přes kryptografický zdroj náhody. Nevkládej do změny klientské výsledky jako autoritativní.
- Pohled odpovědi se sestavuje podle příjemce; tajná data se hráčům neposílají. CSS skrytí nestačí.
- Šeptání vidí odesílatel a adresát; PJ nemá plošný přístup ke všem šeptáním mezi hráči. Správce databáze však má fyzický přístup k uloženému obsahu.

Podrobnosti oprávnění, polí požadavků a opakování jsou v [API](API.md). Úplná herní záloha JSON odstraní tokeny a otisky klíčů; snapshot celé SQLite databáze je zachová.

## Migrace a lokální data

`npm run db:generate` generuje migrace z `db/schema.ts`. Zkontroluj výsledné SQL i metadata a přidej je do stejného PR. Existující aplikované SQL soubory nepřepisuj: Node ukládá jejich otisky a při rozdílu start odmítne. Změnu migrace ověř na prázdné i existující testovací databázi a popiš dopad na obnovu/rollback.

Node start migrace aplikuje transakčně; Cloudflare emulace přes `db:init`. SQLite používá WAL. Pro kopírování běžící databáze nestačí samotný soubor `game.sqlite`; používej [zálohovací postup](SELF_HOSTING.md#data-a-zálohy).

Do Gitu nepatří `.env`, `.stul-data`, `.stul-state`, `.wrangler/state`, databáze, herní zálohy, obnovovací klíče ani `node_modules`. Sdílené příklady musí být smyšlené.

## Ověření a CI

Základní kontrola zdrojů a dokumentace:

```bash
npm run check:docs
npm run check
npm test
```

Node hosting, databáze a API na vlastní dočasné instanci (port 18088 musí být volný):

```bash
npm run build:node
npm run test:hosting
npm run test:updater
```

`test:hosting` vytvoří dočasnou databázi, otestuje administraci, údržbu a konzistentní snapshot, restartuje svůj server a spustí integrační sady. Hlas ověří s vypnutou i zapnutou konfigurací a kontrolou podpisu tokenů; LiveKit server pro tento test nepotřebuje. Dočasná data i server se uklidí.

Cloudflare sestavení a integrační běh (port 5173 musí být volný):

```bash
npm run build
npm run db:init
npm run test:ci
```

`test:ci` si spustí a ukončí vývojový server, ale používá místní D1 úložiště a přidané testovací místnosti v něm zůstanou. Proti již spuštěné oddělené místní instanci lze použít `npm run test:integration -- http://127.0.0.1:5173`. Testy nepouštěj proti rozehrané instalaci; vytvářejí i obnovují vlastní syntetické kampaně.

Současných 21 integračních sad v `scripts/test-integration.mjs`:

| Sada `test-*.mjs` | Ověřuje |
| --- | --- |
| `game`, `map`, `exploration` | Přístupy, chat, deníky, zkušenosti, geometrii, průzkum a patra. |
| `monsters`, `mechanics`, `initiative` | Viditelnost příšer, hody/zranění a pořadí souboje. |
| `conditions`, `powers`, `recovery`, `life` | Stavy, magenergii, použití schopností, léčení a vyřazení. |
| `journey`, `map-notes`, `note-alerts`, `challenges` | Čas a světlo, soukromou přípravu, přiblížení a zkoušky. |
| `loot`, `equipment` | Převzetí nálezů, měšec a výbavu bez zdvojování. |
| `generator-core`, `generator`, `access` | Deterministické mapy, vložení, propojení, vchody a východy. `access` zde znamená mapové vstupy. |
| `voice`, `repairs` | Hlasová oprávnění a regresní případy souběhu, přístupů a úplných záloh. |

Samostatné `npm test` ověřuje spojování půdorysů (`test-union.mjs`). `test:updater` používá simulovaný Docker engine; skutečné kontejnery a obnovu ověřuje CI pomocí `scripts/test-docker.mjs` na Linuxu s Dockerem. Volitelný [mediální test LiveKitu](VOICE.md#ověření-skutečného-přenosu-zvuku) přenese syntetický zvuk bez mikrofonu.

U změn UI doplň vizuální ověření PJ i hráčského pohledu, mobilního rozložení, dlouhých textů a klávesnice. U hlasu navíc reálný mikrofon, zamítnuté oprávnění, odpojení a veřejnou síť. Automatické testy přenosu nejsou zkouškou každé domácí sítě.

CI provádí TypeScript, dokumentační odkazy/příkazy, geometrii, oba buildy, integrační sady, Node hosting a Docker upgrade. `npm run lint` je dostupný pomocný skript; neprezentuj jej jako kontrolu provedenou CI, pokud ji workflow nespouští.
