# Vývoj a architektura

[Dokumentace](README.md) · [API](API.md) · [Přispívání](../CONTRIBUTING.md) · [Vydávání](RELEASING.md)

## První změna na místním stole

V čistém klonu potřebuješ Git, npm a Node **22.15.0 nebo novější**. Pro stejnou řadu jako v CI použij Node 22. Z kořene projektu spusť:

```bash
npm run install:ci
npm run dev:node
```

Otevři `http://127.0.0.1:5174` a založ smyšlenou družinu. Při úpravě kódu se náhled obnovuje. SQLite databáze vznikne při prvním požadavku v ignorovaném adresáři `.stul-dev-data/`. Stůl poslouchá jen místně a spustíš ho bez Dockeru, účtu Cloudflare nebo souboru `.env`. Pro ověření `/admin` použij [sestavenou Node instalaci](#rychlý-start-node-bez-dockeru).

Před první změnou zkus otevřít bestiář. Jeho předlohy najdeš v [katalogu](../content/bestiary), výběr a vyhledávání v [panelu](../components/bestiary-panel.tsx) a přidávání do kampaně v [herní logice příšer](../lib/monsters.ts). Po úpravě spusť `npm run verify`. U změny herního chování pokračuj [integračním ověřením](#ověření-a-ci).

## Dva podporované způsoby spuštění

| | Node / SQLite | Lokální Cloudflare |
| --- | --- | --- |
| Použití | Vlastní server, Docker a lokální ověření stejné varianty. | Původní vývojová varianta přes Wrangler. |
| Build | `npm run build:node` | `npm run build` |
| Start | `npm run dev:node` pro vývoj. Po buildu `node --env-file=.env server/start.mjs` pro provoz. | `npm run dev` nebo po buildu `npm start` |
| Databáze | Vývoj `.stul-dev-data/game.sqlite`. Provoz `.stul-data/game.sqlite` nebo `STUL_DATA_DIR`. V Dockeru `/data/game.sqlite`. | D1 emulovaná ve `.wrangler/state`. |
| Migrace | Při startu Node serveru. | `npm run db:init` po Cloudflare buildu. |
| Port | Vývoj 5174. Provoz 8080 nebo proměnná `PORT`. | Vývoj 5173; sestavená lokální varianta přes `npm start` obvykle 8787. |
| Správa `/admin` | Po spuštění `server/start.mjs`. Aktualizace vyžaduje Docker updater. | Node administrace zde neběží. |
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

## Aktualizace nativní Node instalace

Tento postup platí pro vlastní běh `server/start.mjs`, ne pro Docker updater. Předem si poznamenej `/healthz` a uložený commit. Zastav aplikaci svým správcem procesu (při běhu v terminálu `Ctrl+C`) a vytvoř soukromou konzistentní zálohu databáze; při kopírování zastavené instalace zachovej i případný WAL/SHM a `.env`. [Zálohy a obnova](SELF_HOSTING.md#data-a-zálohy) popisují rozdíl oproti exportu jedné kampaně.

Pro nasazení ověřené hlavní větve v čistém checkoutu:

```bash
git fetch origin
git merge --ff-only origin/main
npm run install:ci
npm run build:node
node --env-file=.env server/start.mjs
```

Před aktualizací musí checkout již být na `main`; lokální úpravy nejprve bezpečně vyřeš. Pro vydanou verzi místo hlavní větve použij konkrétní ověřený tag a jeho dokumentaci. Existující `.env`, data ani obnovovací klíče nenahrazuj vzorovými soubory. Pokud je pro danou instalaci soubor prostředí jinde, nahraď cestu v posledním příkazu.

Ověř `/healthz`: správný `revision`, očekávaný `version` a `maintenance: false`. Zkontroluj otevření původní kampaně a rozhraní; změny se v již otevřené kartě mohou projevit až po obnovení stránky. Databázové migrace aplikuje start. Při selhání nespouštěj náhodně starší kód proti nově změněným datům: vrať společně odpovídající kód a zálohu podle provozního postupu.

LiveKit spravuješ samostatně. Jeho běžící proces ani uložené klíče se sestavením aplikace nenahrazují; pokud je vypnutý, spusť jej s původní konfigurací podle [hlasového návodu](VOICE.md). Samostatné Node spuštění nezajišťuje automatický start po restartu počítače; ten nastavuje správce provozu.

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
| [app/page.tsx](../app/page.tsx) | Propojení mapy, družiny, chatu a dialogů. |
| [components/dungeon-map.tsx](../components/dungeon-map.tsx) | Editor mapy: režimy, lišta nástrojů, posun, přiblížení a dialogy. [Plátno SVG](../components/dungeon-map/canvas.tsx) vykresluje mapu a značky. [Obsluha vstupu](../components/dungeon-map/use-map-input.ts) zpracovává myš a klávesnici, sestavuje tahy a spravuje jejich opakování. |
| [components/game-table/](../components/game-table) | Lobby, chat, deník, odměny, registr dialogů a klientská komunikace. `game-client.ts` volá API a `use-game-polling.ts` načítá stav každé dvě sekundy. |
| [app/api/game/route.ts](../app/api/game/route.ts) | HTTP, ověření člena, vstup do kampaně a zápis s kontrolou revize. |
| [app/api/game/actions.ts](../app/api/game/actions.ts) | Směrování mutací a kontrola rolí. Pravidla jednotlivých akcí jsou v odpovídajících modulech `lib/`. |
| [app/api/game/view.ts](../app/api/game/view.ts) | Výslovný výběr polí herního pohledu podle příjemce. Klient používá typ `GameView` z tohoto modulu. |
| `app/api/voice/route.ts`, `lib/voice.ts` | Ověření členství a krátkodobá hlasová vstupenka pouze pro mikrofon. |
| `lib/game.ts`, `db/schema.ts` | Vnitřní stav hry a tabulka místností. |
| `lib/scenery.ts`, `components/scenery/` | Komunitní JSON katalog, organické plochy (`lib/surfaces.ts`, `lib/surface-drawing.ts`), deterministické doplnění podlahy, paleta, editor a veřejná paměť; [model a regrese](SCENERY.md). |
| `lib/dungeon.ts`, `lib/exploration.ts` | Geometrie, patra, dveře, propojení schodů, dohled a paměť mapy. |
| `lib/dungeon-generator.ts`, `lib/generation.ts` | Verzovaný deterministický náhled, serverové vložení a ochrana kapacity/souběhu. V2 jádro, validátor a sdílené typy jsou v samostatných `generator-*.ts` modulech; [audit a návrh](GENERATOR_V2.md). |
| [content/](../content) | Samostatné JSON soubory pro příšery, jeskyně a dobrodružství. Indexy vytváří `npm run content:sync`. Katalogy a testy čtou stejná Zod schémata. [Přidávání obsahu](OBSAH.md). |
| `lib/monsters.ts`, `lib/initiative.ts`, `lib/mechanics.ts`, `lib/combat-rules.ts` | Příšery, pořadí souboje, hody, návaznost útoku/obrany a zranění. |
| `lib/sheets.ts`, `lib/character.ts` | Deníky a ochrana změněných polí. |
| `lib/powers.ts`, `lib/conditions.ts`, `lib/life.ts`, `lib/recovery.ts` | Kouzla/magenergie, stavy, vyřazení a obnova životů/magenergie. |
| `lib/map-inspection.ts`, `lib/room-labels.ts`, `components/map-inspector.tsx` | Výběr celé místnosti/propojeného prostoru pro PJ, rozložení čísel mimo schody/vstupy a čtecí přehled. |
| `lib/story-phases.ts`, `lib/story-outline.ts`, `components/story-outline-panel.tsx` | Společné fáze předloh, soukromá osnova s revizí a stabilními vazbami na poznámky; [model a regrese](STORY_OUTLINE.md). |
| `lib/map-notes.ts`, `lib/map-note-alerts.ts`, `lib/challenges.ts` | Příprava míst, upozornění při přiblížení a zkoušky. |
| `lib/lighting.ts`, `components/light-sight-settings.tsx` | Průnik osvětlení a přímého výhledu, dohled bez světla a volba automatiky. Nosiče a přepočet paměti napojuje `lib/exploration.ts`. |
| `lib/loot.ts`, `lib/equipment.ts`, `lib/journey.ts` | Kořist, výbava/měšec a čas/světlo. |
| `lib/access.ts` | Vydávání a ověřování obnovovacích klíčů. |
| [lib/backup.ts](../lib/backup.ts) | Export bez přístupových údajů, načtení zálohy a přidělení nových tokenů. |
| [lib/backup/](../lib/backup) | Schémata uložených údajů podle oblastí hry. `campaign-schema.ts` je skládá do formátu zálohy. `validate-campaign.ts` kontroluje vazby mezi oblastmi, například zda příšera odkazuje na existující patro. |
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

Rychlá kontrola zdrojů, dokumentace, datových předloh a geometrie:

```bash
npm run verify
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
npm run check:client-content
npm run test:ci
```

`test:ci` použije build pro migrace, založí dočasné D1 úložiště a spustí vlastní server na `127.0.0.1:18173`. Po dokončení server zastaví a testovací úložiště odstraní. Proti již spuštěné oddělené místní instanci lze použít `npm run test:integration -- http://127.0.0.1:5173`. Testy nepouštěj proti rozehrané instalaci; vytvářejí i obnovují vlastní syntetické kampaně.

Současných 28 integračních sad v `scripts/test-integration.mjs`:

| Sada `test-*.mjs` | Ověřuje |
| --- | --- |
| `game`, `map`, `exploration` | Přístupy, chat, deníky, zkušenosti, geometrii, průzkum a patra. |
| `monsters`, `mechanics`, `initiative` | Viditelnost příšer, hody/zranění a pořadí souboje. |
| `conditions`, `powers`, `recovery`, `life` | Stavy, magenergii, použití schopností, léčení a vyřazení. |
| `journey`, `map-notes`, `note-alerts`, `challenges` | Čas a světlo, soukromou přípravu, přiblížení a zkoušky. |
| `loot`, `equipment` | Převzetí nálezů, měšec a výbavu bez zdvojování. |
| `generator-core`, `generator-v2`, `generator`, `generation-v2-integration`, `access` | Deterministické mapy, vložení, propojení, vchody a východy. `access` zde znamená mapové vstupy. |
| `room-parchments` | Skutečný vstup a průchod místností, schodiště, ruční zveřejnění, soukromí, opakování a zálohy. |
| `adventures` | Veřejná upoutávka bez tajné přípravy, založení z předlohy, soukromí a úplná záloha. |
| `session-recap` | Zápis ze sezení, oprávnění, soukromí mapy, opakování, konflikty a zálohy. |
| `lighting` | Dohoření/undo, šedou paměť a příšery, skupinový průchod za tmy i se světlem (včetně mezikroků), nosiče v boji, nesčítání dosahů, průhlednost hran, přepsání PJ a zálohy. |
| `basic-mechanics` | Zamčené/tajné dveře a paměť, individuální bojový pohyb a sdílený dohled, seskupení, soukromé atomické transfery, zálohy a souběh. |
| `voice`, `repairs` | Hlasová oprávnění a regresní případy souběhu, přístupů a úplných záloh. |

Samostatné `npm test` ověřuje spojování půdorysů (`test-union.mjs`) a vymezení prostoru inspekce (`test-map-inspection.mjs`): dveře i otevřené, příčky, diagonální oddělení, platné V2 místnosti a přechod na současnou geometrii po ruční změně. Testy `map-notes` kontrolují také čísla, přesouvání, oddělené publikované verze a zálohy; testy generátoru ověřují polohy čísel mimo schody/vstupy. `test:updater` používá simulovaný Docker engine; skutečné kontejnery a obnovu ověřuje CI pomocí `scripts/test-docker.mjs` na Linuxu s Dockerem. Volitelný [mediální test LiveKitu](VOICE.md#ověření-skutečného-přenosu-zvuku) přenese syntetický zvuk bez mikrofonu.

Kreslenou prezentaci mapy ověřuje také `test-map-drawing.mjs` v rámci `npm test`: determinismus, geometrická nezávislost, orientace šraf, tajné dveře, mlha, paměť bez světla a návrat k univerzálnímu stylu. [Architektura rendererů a vizuální srovnání](MAP_APPEARANCE.md) popisují rozdělení plátna a dekorací.

U změn UI doplň vizuální ověření PJ i hráčského pohledu, mobilního rozložení, dlouhých textů a klávesnice. U hlasu navíc reálný mikrofon, zamítnuté oprávnění, odpojení a veřejnou síť. Automatické testy přenosu nejsou zkouškou každé domácí sítě.

CI provádí TypeScript, dokumentační odkazy/příkazy, geometrii, oba buildy, integrační sady, Node hosting a Docker upgrade. `npm run lint` je dostupný pomocný skript; neprezentuj jej jako kontrolu provedenou CI, pokud ji workflow nespouští.

Informativní benchmark generátoru spustíš `npm run benchmark:generator`; nemá časový CI limit. V2 sada testuje 2160 konfigurací nezávislým validátorem skutečných hran a připíná původní V1 výstupy.

## Testování katalogové knihovny

Společné schéma a resolver jsou v `lib/catalogs/`, Node adaptéry v `server/catalog-*.mjs`. `npm run build:node` navíc sestaví `dist/catalog-core.mjs` pro existující administraci. Po tomto sestavení spusť `npm run test:catalogs`: migrace existující databáze, ZIP, úložiště/restart, řízené GitHub odpovědi a skutečná administrace s herní integrací. Sada běží také v `npm run test:hosting`. Síťové katalogové testy nepoužívají skutečný GitHub. [Architektura a provoz](CATALOG_LIBRARY.md).

`npm run test:catalog-audit -- /tmp/catalog-audit.json` provede samostatně celý přenos demonstračního dolu, aktualizaci s odebranou používanou položkou, obnovu úplného serverového ZIP do jiného datového adresáře a měření API. Používá izolované dočasné databáze a port 18089. Testovací Node server má blokované `fetch` mimo loopback a zaznamenává případný pokus. Zápis výsledků je volitelný; běžná katalogová sada audit provádí také, bez změny dokumentačního artefaktu. Metodiku a omezení uvádí [audit](CATALOG_AUDIT.md).

### Odpovědnosti katalogového servisu

`server/catalog-store.mjs` je stabilní veřejné rozhraní pro administraci a GitHub distribuci. Implementace je rozdělená v `server/catalogs/`:

| Modul | Odpovědnost |
| --- | --- |
| `repository.mjs` | SQLite dotazy, synchronní transakce, revize, historie a rezervace příloh. |
| `validation.mjs` | Načtení společného validačního jádra, kontrola celé knihovny a závislostí. |
| `usage.mjs` | Odkazy z kampaní a kontrola zachovaných podkladů. |
| `queries.mjs` | Přehled, detail a přenositelný export katalogu. |
| `editor.mjs` | Vlastní katalogy, položky, kopie a nahrávání obrázků. |
| `imports.mjs` | Dočasné náhledy, porovnání a potvrzená instalace ZIP/GitHub balíčku. |
| `lifecycle.mjs` | Povolení, odebrání a návrat předchozí verze s kontrolou závislostí. |

Databázové callbacky jsou synchronní. Import nejprve rezervuje místo a uloží neměnné soubory, potom v konečné transakci znovu kontroluje revizi, kampaně a závislosti. Nepřesouvej síťové či souborové `await` dovnitř databázové transakce. Náhledy ZIP a GitHubu používají stejný modul a tutéž procesovou mapu, nejde o dvě nezávislé fronty.

Administrace používá společný `server/admin-dialog.js` a HTML `<dialog>` pro vstupy i potvrzení. Systémové `prompt()` a `confirm()` v zabudovaných prohlížečích nemusejí fungovat. Při změně klienta ověř kliknutí a zrušení v prohlížeči; samotný API test neověřuje dostupnost formuláře. `scripts/test-admin-client.mjs` navíc staticky odmítá návrat přímých volání nepodporovaných systémových dialogů a běží v administrační integrační sadě.

## Stabilizační kontroly

`npm run lint` ukazuje všechny nálezy včetně historických. `npm run lint:baseline` je CI brána: podle souboru, pravidla a závažnosti nedovolí zvýšit počty proti auditované verzi 1.2.1. Nový soubor nemá žádnou výjimku. Základ v `scripts/lint-baseline.json` se při běžné změně automaticky nepřegenerovává; případné změny vyžadují samostatnou věcnou revizi. Cílem zůstává postupné odstranění starých nálezů, nikoli jejich skrytí.

- `npm run test:stabilization` vyžaduje Node build a volné lokální porty 18096, 18098, 18099. Vytváří vlastní dočasné databáze; nepracuje s živou instalací.
- `npm run benchmark:polling` měří 150 dotazů osmi klientů proti vlastní Node instanci na 18097. Bez `STUL_REAL_POLL=1` jde o zrychlený ekvivalent přenosu pěti minut, nikoli reálný pětiminutový běh. Výsledky jsou v `/tmp/stul-poll-after.json`; cestu lze změnit pomocí `STUL_METRICS_FILE`.
- `node scripts/audit-maintainability.mjs` zaznamená statický graf importů a kandidáty k další revizi. Neodstraňuje UI soubory ani závislosti. Řetězcově generované/volitelné pluginové importy nejsou důkazem nepoužití.
- Pro cílené opakování integračních scénářů lze nastavit `STUL_TEST_CASES=message-replay,conditional-game,stabilization,public-admission-api`; neznámý název se odmítá a bez této proměnné běží celá sada. Nové API regresní scénáře běží také přes `npm run test:ci` a `npm run test:hosting`: hraniční záloha, opakované chaty/hody, výchozí globální omezení zakládání.

`app/page.tsx` skládá obrazovku, transport a identifikátory požadavků jsou v `components/game-table/game-client.ts`; polling zůstává samostatný hook. Definice nástrojů jsou v `components/dungeon-map/toolbox.ts`, geometrie a vstupy zůstávají ve stávajících modulech. Limity těla/zálohy, podmíněná odpověď, přijetí nové místnosti a zprávové operace mají malé samostatné moduly. Generátor V2 ani herní pravidla tato etapa nemění.

[Zpráva z ověření](STABILIZATION_AUDIT.md).
