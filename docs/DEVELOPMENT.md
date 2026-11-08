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

Oba buildy používají adresář `dist`. Nespouštěj je současně a před startem zvol správný build. Také vývojové Node a Cloudflare procesy ve stejném checkoutu sdílejí optimalizační Vite cache v `node_modules/.vite`: prohlížečový smoke a `test:ci` spouštěj postupně, případně použij oddělený checkout. Souběžné přepnutí runtime může běžícímu procesu odstranit optimalizovanou závislost. `npm run db:init` vyžaduje konfiguraci vytvořenou Cloudflare buildem; pro Node se nepoužívá.

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
| [app/page.tsx](../app/page.tsx) | Stav relace, návaznost akcí, výběr mapy a otevírání dialogů. Hlavičku, postranní panel a mobilní ovládání skládá ze samostatných prezentačních komponent. |
| [components/dungeon-map.tsx](../components/dungeon-map.tsx) | Editor mapy: režimy, lišta nástrojů, posun, přiblížení a dialogy. [Plátno SVG](../components/dungeon-map/canvas.tsx) vykresluje mapu a značky. [Obsluha vstupu](../components/dungeon-map/use-map-input.ts) zpracovává myš a klávesnici, sestavuje tahy a spravuje jejich opakování. |
| [components/game-table/](../components/game-table) | Lobby, chat, deník, odměny, registr dialogů a klientská komunikace. `game-client.ts` volá API a `use-game-polling.ts` načítá stav každé dvě sekundy. |
| [app/api/game/route.ts](../app/api/game/route.ts) | HTTP, ověření člena, vstup do kampaně a zápis s kontrolou revize. |
| [app/api/game/actions.ts](../app/api/game/actions.ts) | Vstupní směrování mutací. [Doménové akce](../app/api/game/actions/domain.ts) sdružují oprávnění a převod chyb, [mapové akce](../app/api/game/actions/map.ts) hlídají úpravy geometrie a průzkum, [správa členů](../app/api/game/actions/members.ts) řeší archivaci a obnovovací klíče. Pravidla zůstávají v `lib/`. |
| [app/api/game/view.ts](../app/api/game/view.ts) | Výslovný výběr polí herního pohledu podle příjemce. Klient používá typ `GameView` z tohoto modulu. |
| `app/api/voice/route.ts`, `lib/voice.ts` | Ověření členství a krátkodobá hlasová vstupenka pouze pro mikrofon. |
| `lib/game.ts`, `db/schema.ts` | Vnitřní stav hry a tabulka místností. |
| `lib/scenery.ts`, `components/scenery/` | Komunitní JSON katalog, organické plochy (`lib/surfaces.ts`, `lib/surface-drawing.ts`), deterministické doplnění podlahy, paleta, editor a veřejná paměť; [model a regrese](SCENERY.md). |
| `lib/dungeon.ts`, [lib/exploration.ts](../lib/exploration.ts), [lib/exploration/](../lib/exploration) | Geometrie mapy a stabilní vstupní modul průzkumu. Vnitřní moduly oddělují atlas, hledání cest, dohled, paměť, veřejný pohled a herní akce. |
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

## Hranice odpovědností při údržbě

Směrování API a oprávnění jsou výslovné a oddělené od pravidel hry:

- Novou běžnou akci přidej do `app/api/game/actions/domain.ts`: vlastní doménová funkce v `lib/`, případné `deny` pro oprávnění, náhradní text chyby a `conflicts: true`, pokud `EditConflict` znamená HTTP 409. Doménové funkce musí nadále kontrolovat vlastní platnost vstupů a revize. `mechanics` a `experience` zachovávají původní mapování chyb na 400.
- Operace měnící mapu patří do `actions/map.ts`. Upravená mapa se při obsazení políčka odmítne před přiřazením náhledu do patra; aktualizace paměti a dohledu následuje až po přijetí tahu. Kontroly společného pohybu a vedení družiny zachovej.
- Archivace, rotace tokenů a vydání obnovovacích klíčů patří do `actions/members.ts`. Vstup/join, obnova relace, databázový zápis a CAS retry zůstávají v `route.ts`; nepřesouvej je do pravidel.
- Hlavička, seznam družiny a mobilní panely jsou v [table-header.tsx](../components/game-table/table-header.tsx), [party-sidebar.tsx](../components/game-table/party-sidebar.tsx) a [journal-shortcuts.tsx](../components/game-table/journal-shortcuts.tsx). Přebírají stav a události; samy nenačítají API ani nespravují relaci. Navigace a ochrana otevřených formulářů zůstává v nadřazeném stole.
- [Katalogová vizuální projekce](../lib/catalogs/visuals.ts) je čistý modul bez databáze, souborového systému a Cloudflare bindingů. Čte pouze resolver a připnuté podklady kampaně. `runtime.ts` načítá instalovanou knihovnu; `game-content.ts` připíná použité položky před mutací. Do veřejné projekce nikdy nepřidávej načítání celé soukromé knihovny.

Refaktor po 1.2.2 nemění kontrakt HTTP, číslo uloženého formátu, migrace, herní mechaniky ani algoritmus generátoru. Kontroluj zvlášť odmítnuté operace: nejen stavový kód, ale i to, že nedošlo k nechtěné změně stavu.

[Test směrování akcí](../scripts/test-action-dispatch.mjs) ověřuje role, vlastnictví postavy, chybové kódy, obsazenou mapu a obnovovací přístupy. [Test rozložení stolu](../scripts/test-table-layout.mjs) vykresluje skutečné React komponenty pro PJ i hráče včetně mobilních ovládacích prvků. Oba běží v `npm test`; sdílený JSX loader v `scripts/test-support/react-loader.mjs` používá také test náhledu generátoru. Vykreslení HTML nenahrazuje vizuální kontrolu v prohlížeči ani integrační test herního API.

### Editor mapy a průzkum

- [use-map-viewport.ts](../components/dungeon-map/use-map-viewport.ts) vlastní zoom, DOM refs papíru, posun, vycentrování, ResizeObserver a klávesové/modifikátorové události. Posluchače při odpojení uklízí; doménové herní operace neposílá.
- [use-map-scenery.ts](../components/dungeon-map/use-map-scenery.ts) spravuje štětec, výběr/přesun značky a návrh rozmístění se stampem a stabilním requestId. [scenery-tools.tsx](../components/dungeon-map/scenery-tools.tsx) vykresluje paletu a editor. Kliknutí do mapy nadále používá `sendMap` z `use-map-input.ts`, aby zachovalo opakování nepotvrzeného tahu.
- [use-panel-navigation.ts](../components/game-table/use-panel-navigation.ts) vlastní výběry dialogů a společnou cestu přes `DialogHandle.run`; ochrana rozepsaného formuláře se kontroluje před změnou výběru. Přímé přechody z již otevřeného setkání zachovávají dosavadní obsluhu nadřazeného stolu. Relace a polling zůstávají oddělené.
- `lib/exploration.ts` zachovává původní exporty. `model.ts` obsahuje typy, `atlas.ts` výběr/normalizaci pater, `geometry.ts` hledání známé cesty a přímý výhled, `memory.ts` zapamatování pozorovaného, `visibility.ts` světla a přepočet dohledu, `view.ts` veřejný pohled a `actions.ts` změny průzkumu. Při přesunu se po každém kroku stále volá přepočet světlem omezeného dohledu. Sdílené hledání cesty nemění pořadí sousedů ani rozdílné chybové texty skupinového a bojového pohybu.

[Test jádra průzkumu](../scripts/test-exploration-core.mjs) ověřuje původní vstupní modul, známé cesty, průchodnost/viditelnost dveří, diagonální zakrytí a přesun ve tmě bez odhalení okolí. API test `scripts/test-lighting.mjs` dále pokrývá dohoření, nosiče, bojové postavení a světelné režimy. Nativní TS testovací loader rozlišuje soubor `exploration.ts` od stejnojmenného adresáře stejně jako bundler.

### Dekorace pod mapou

[table-atmosphere.tsx](../components/table-atmosphere.tsx) drží skici ve fixním rohu a maskuje je pod podlahou a hranami mapy. [keepsake-mask.ts](../components/dungeon-map/keepsake-mask.ts) vytváří půdorys pouze ze `shown` pohledu a převádí souřadnice papíru do SVG skici. Nikdy mu nepředávej soukromý atlas místo hráčské projekce. Posun a ResizeObserver aktualizují SVG transformaci přes jeden requestAnimationFrame bez herních mutací; při odpojení se posluchače i observer uklidí. Měkké okraje a radiální zeslabení původní skici zůstávají zachované.

[Test masky](../scripts/test-keepsake-mask.mjs) ověřuje projekci, posun a změnu velikosti, prázdnou mapu, unikátní SVG identifikátory a skutečné zapojení hráčského editoru bez úniku neprozkoumaných místností. Vzhled překrytí ověř také v prohlížeči.

### Stavové přechody a čistý lint

[interaction-state.ts](../components/dungeon-map/interaction-state.ts) popisuje reakce na změnu patra, generování, souboje a výběru. [use-map-interaction.ts](../components/dungeon-map/use-map-interaction.ts) upraví vlastní stav pouze při změně uloženého snímku těchto signálů, ještě před commitem. Nezměněný polling proto neruší ručně zvolený nástroj. `use-map-input.ts` ve stejném přechodu zruší rozpracovaný začátek; pointer ref se uvolní v layout efektu. Běžné efekty mají úplné závislosti a slouží pro posun papíru a DOM, nikoli pro dodatečné přepínání nástrojů.

[use-browser-entry.ts](../components/game-table/use-browser-entry.ts) načte vstupní relaci líně a používá hydratační signál přes `useSyncExternalStore`. Server a první hydratační render zobrazují stejný načítací stav. Nedostupné úložiště nebo poškozený JSON neblokují vstupní obrazovku.

[omitFields](../lib/objects.ts) ponechává výslovné vyřazení přístupových údajů ze zálohy i soukromých nastavení dveří z veřejné mapy. Odstranění nepoužité destrukturované proměnné nesmí vrátit tajná pole do exportu. Obrázky používají `next/image` s `unoptimized`, protože už jde o připravené WebP nebo připnuté obrázky kampaně; žádný nový image endpoint není potřeba. Nativní test vykreslení používá stejný Vinext image shim jako build.

[Test stavů a projekcí](../scripts/test-clean-state.mjs) ověřuje jednorázové přechody, pořadí souběžných výběrů, zachování ručního nastavení při pollingu, načtení relace, chybějící soukromá pole a povolenou konfiguraci náhradního Docker kontejneru.

### Postupné jednotné formátování

Projekt používá přesně uzamčený vývojový Prettier a sdílenou konfiguraci `.prettierrc.json`. Formátujeme postupně vybrané vlastní moduly; seznam je v [scripts/format-scope.json](../scripts/format-scope.json). Při přidání nebo zásadní úpravě dalšího modulu rozšiř tento seznam v témže PR. Automatická CI kontrola se vztahuje na tento rozsah; zbytek repozitáře tím není prohlášený za přeformátovaný. Generované soubory, katalogová data, podklady a lockfile se touto kontrolou nepřepisují.

```bash
npm run format
npm run format:check
```

První příkaz upraví soubory ze seznamu, druhý pouze ověří formát a při rozdílu selže. Pro individuální soubor lze použít `npx --no-install prettier --write cesta/k/souboru.ts`. Formátování nenahrazuje lint. `npm run lint` nyní vyžaduje nulu chyb i varování a je povinnou součástí CI; `lint:baseline` zůstává kompatibilní kontrolou s prázdnou historickou baseline. Další změny nesmějí znovu přidat dříve tolerované nálezy.

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

CI provádí striktní `npm run lint` s nulou povolených varování, kontrolu formátu vybraných modulů, TypeScript, dokumentační odkazy/příkazy, geometrii, oba buildy, integrační sady, Node hosting a Docker upgrade.

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

`npm run lint` používá `--max-warnings 0`: chyby i varování způsobí neúspěch. Původních 6 chyb a 45 varování bylo odstraněno opravou vlastního kódu a generátoru indexů, bez dalších vypnutí pravidel. `scripts/lint-baseline.json` je prázdný; starší příkaz `npm run lint:baseline` proto také toleruje pouze nulu nálezů. Po odstranění nepoužívaných UI šablon byly odebrány i jejich zvláštní lint výjimky. Zachované tlačítko pro konektorový panel prochází stejnými pravidly jako ostatní kód.

- `npm run test:stabilization` vyžaduje Node build a volné lokální porty 18096, 18098, 18099. Vytváří vlastní dočasné databáze; nepracuje s živou instalací.
- `npm run benchmark:polling` měří 150 dotazů osmi klientů proti vlastní Node instanci na 18097. Bez `STUL_REAL_POLL=1` jde o zrychlený ekvivalent přenosu pěti minut, nikoli reálný pětiminutový běh. Výsledky jsou v `/tmp/stul-poll-after.json`; cestu lze změnit pomocí `STUL_METRICS_FILE`.
- `node scripts/audit-maintainability.mjs` zapíše aktuální konzervativní graf do `docs/performance/maintainability-current.json`; volitelný argument určí jiný výstup. Zahrnuje vývojové/testovací vstupy, výslovné konektorové kořeny, TypeScript `.mts` protějšky a soubor kopírovaný do updater image. Nic nemaže automaticky. Kandidáty vždy porovnej s konfigurací, CSS a dynamickými importy. [Provedený úklid](CLEANUP.md) zachovává samostatný historický snímek.
- Pro cílené opakování integračních scénářů lze nastavit `STUL_TEST_CASES=message-replay,conditional-game,stabilization,public-admission-api`; neznámý název se odmítá a bez této proměnné běží celá sada. Nové API regresní scénáře běží také přes `npm run test:ci` a `npm run test:hosting`: hraniční záloha, opakované chaty/hody, výchozí globální omezení zakládání.

`app/page.tsx` skládá obrazovku, transport a identifikátory požadavků jsou v `components/game-table/game-client.ts`; polling zůstává samostatný hook. Definice nástrojů jsou v `components/dungeon-map/toolbox.ts`, geometrie a vstupy zůstávají ve stávajících modulech. Limity těla/zálohy, podmíněná odpověď, přijetí nové místnosti a zprávové operace mají malé samostatné moduly. Generátor V2 ani herní pravidla tato etapa nemění.

[Zpráva z ověření](STABILIZATION_AUDIT.md).

### Opakování upgradu z 1.2.1

Pro `node scripts/test-stable-upgrade.mjs /cesta/ke/1.2.1` připrav oddělený adresář ze zdrojů commitu `ef59634d1a5f7ff94d76201cc187dea99c73e0c3`, v něm nainstaluj uzamčené závislosti a spusť `npm run build:node`. Potom sestav aktuální pracovní větev také přes `npm run build:node`. Test sám použije vlastní dočasná data a port 18104; neukazuj ho na provozní datový adresář.

Hromadné herní integrace zakládají více stolů než běžná parta. Jejich testovací instance používají konfigurační limit 1000/min; výchozí 100/min ověřuje samostatná čistá instance s přesně 100 úspěchy a odmítnutím dalšího požadavku. Cloudflare `npm run test:ci` obě instance spravuje automaticky, Node default ověřuje `npm run test:stabilization`. Produkční výchozí hodnoty se nemění.
