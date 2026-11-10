# Interní HTTP API

[Dokumentace](README.md) · [Architektura](DEVELOPMENT.md)

Toto je přehled aktuálního interního API pro přispěvatele, nikoli verzované veřejné integrační rozhraní se zaručenou stabilitou. Vstupní bod je [herní route](../app/api/game/route.ts). Ověření člena, připojení a obnova přístupu jsou v [room-access.ts](../app/api/game/room-access.ts). Oprávnění a směrování jednotlivých akcí najdeš v [actions.ts](../app/api/game/actions.ts), validaci hodnot v odpovídajících modulech `lib/` a tvar odpovědi v [herním pohledu](../app/api/game/view.ts). Příklady požadavků jsou v integračních testech.

## Přístupy a společné konvence

Herní požadavky používají `Authorization: Bearer <token-postavy>`. Nejde o heslo `/admin` ani o token updateru. Identifikátor místnosti má 10 velkých hexadecimálních znaků. Kód místnosti sám neopravňuje číst existující soukromý stav; akce `join` s ním ale umožňuje přidat novou postavu, dokud je kapacita.

Mapová políčka mají souřadnice od nuly v rozsahu x 0–55 a y 0–39. Hrana na pravém okraji může mít x = 56 a hrana na spodním okraji y = 40. Hrany mají klíče `h:x:y` a `v:x:y`; vodorovná hrana spojuje `(x,y)` s `(x+1,y)`, svislá `(x,y)` s `(x,y+1)`. UI mřížka je číslovaná od 1. Výchozí patro má ID `ground`, další patra vlastní identifikátory.

Při opakování podporované mutace zachovej její `requestId` (běžně UUID; validace přijímá 16–80 alfanumerických znaků a pomlček). Nový identifikátor znamená novou akci. Historie opakování je omezená a různě scoped podle modulu; `chat` a obyčejný `roll` nově přijímají volitelný `requestId` (1–100 znaků A–Z, a–z, 0–9, `_`, `-`), scoped na autora. Opakování se stejnými normalizovanými vstupy vrátí aktuální pohled bez dalšího zápisu; jiný obsah se stejným ID vrátí 409. Kampaň uchovává posledních 256 těchto operací (ID zprávy a SHA-256 normalizovaného vstupu, bez další kopie textu nebo obrázků) v soukromém poli `messageOperations`. Starší klient bez ID funguje bez deduplikace. `character`, `notes`, přidání hráče a archivace nejsou univerzálně idempotentní.

Odměna `experience` přijímá ID aktivní hráčské postavy nebo `all` pro celou aktivní družinu. Obnovení archivované postavy během rozestavení ji umístí na jeho výchozí políčko. Záloha zachová historické odměny a jejich zprávy i tehdy, pokud dřívější verze zahrnula archivované postavy.

## Čtení a export

| Požadavek | Výsledek |
| --- | --- |
| `GET /api/game?room=<code>` | Filtrovaný herní pohled pro držitele tokenu; `revision`, `me`, mapa, dostupní členové, chat a další panely. |
| `GET /api/game?room=<code>&level=<id>` | PJ může číst připravované patro. Neznámé patro vrátí PJ chybu 400. Hráčský pohled se řídí polohou družiny. |
| `GET /api/game?room=<code>&download=backup` | Jen PJ: úplný JSON export formátu 1. Vynechá herní tokeny/otisky klíčů, nikoli tajné herní texty. |

Pohled **není** vnitřní `Game`: tajná data se filtrují, některé hodnoty se dopočítávají a operační historie je odstraněná. Nepoužívej filtrovanou odpověď jako úplnou zálohu nebo náhradu databázového řádku.

Běžné čtení vrací `ETag` z autorizovaného pohledu. Klient může poslat `If-None-Match`; při shodě dostane **304 bez JSON těla**. Autentizace probíhá před porovnáním, odpověď má `Vary: Authorization` a `Cache-Control: no-store`. Klient drží validátor pouze pro konkrétní relaci a patro. Změny přítomnosti se promítají také do otisku. Katalogové a zálohové GET nejsou součástí této optimalizace.

## Zápis hry

`POST /api/game` přijímá JSON. Běžný požadavek obsahuje `action`, `room` a údaje akce, případně `levelId`. Úspěch většinou vrací `{game: <pohled>}`; přihlášení/obnova navíc `token`, `room` a nový `recoveryCode`. Vložení generované mapy vrací také `generatedLevels`. Pokud zadané patro pro pohled PJ neexistuje, nový zápis vrátí 400 a stav ani revize se neuloží. Potvrzení už uloženého chatu nebo hodu se stejným `requestId` může při neplatném patře vrátit výchozí pohled.

| `action` | Oprávnění a význam |
| --- | --- |
| `create` | Bez tokenu: vytvoření místnosti a PJ, pole `name`. |
| `join` | Bez tokenu: `room`, `name`; vytvoří novou hráčskou postavu u umístěné družiny. Bez umístěné družiny se výchozí políčko určí podle aktivních účastníků. |
| `recover` | Osobní `recoveryCode` a `requestId`; rotuje přístup ke stejné postavě. |
| `restore` | Bez tokenu: úplný `backup`; založí novou místnost a přístup PJ. |
| `chat`, `roll` | Člen: `text`, `to` (`all` nebo ID adresáta). `roll` přijímá např. `2k6+1`, ne klientský výsledek. |
| `character` | Vlastní deník; změněná pole a jejich původní hodnoty v `expected`. |
| `notes` | PJ: `title`, `scene`, `notes` a `expected` pro měněná pole. |
| `access-key` | Vlastní klíč, nebo PJ pro hráče; `memberId`. |
| `member-archive`, `member-restore` | PJ pro hráčskou postavu; `memberId`. |
| `experience` | Jen PJ; přidělení zkušeností. |
| `map` | Jen PJ; `tool`, geometrie tahu a `requestId`, případně patro. |
| `explore` | Oprávnění podle operace, viz níže. |
| `move` | Historický přesun jednotlivého člena: majitel/PJ. Při umístěném společném žetonu je odmítnut; použij `explore`. |
| `monster` | PJ: ruční vytvoření nebo přidání z bestiáře, kopie, údaje, poloha, životy a archivace příšer. |
| `mechanics` | Vlastní hody hráče, PJ i za ostatní; obrana podle cíle a viditelnosti akce, potvrzení/rušení jen PJ. |
| `initiative`, `condition` | Jen PJ: soubojové pořadí a stavy. |
| `power` | Majitel/PJ: vlastní kouzla, magenergie a použití. |
| `recovery`, `journey`, `life` | Jen PJ: obnova životů/magenergie, čas/světlo a vyřazení. |
| `map-note` | Jen PJ: pracovní a zveřejněný popis místa, volitelné `roomNumber` (1–999, unikátní na patře; `null` odstraní označení). Operace `move` přesune značku na `toX`/`toY` ve stejném patře, vyžaduje původní kotvu, `noteId` a `expectedRevision`. Přesun zachová ID a vazby na kořist/zkoušky. |
| `story-outline` | Jen PJ: `requestId`, `expectedRevision` (poprvé `null`) a `phases`. Dodané fáze nahradí svou přípravu; ostatní zůstanou. Odkazy jsou unikátní existující `noteIds`. Souběh vrací 409. [Datový model a projekce](STORY_OUTLINE.md#data-soukromí-a-rozšiřování). |
| `challenge` | Příprava/následky/rušení PJ; hod cílový hráč nebo PJ. |
| `loot` | Příprava/uzavření/dělení PJ; převzetí hráč pro sebe nebo PJ pro hráče. |
| `equipment` | Majitel/PJ: položky a měšec konkrétního člena. |
| `generate` | PJ: `options`, `expectedState` a `requestId`; server regeneruje geometrii z parametrů. `options.version` je `v1`/`v2`, chybějící znamená V1; V2 má `style` (`castle`, `mine`, `cave`) a `variant` 0–2. Nové UI volí V2. |

`cell` je odmítnutý starý způsob kreslení, nikoli alternativní zapisovací API.

### Stafáž mapy

Organické plochy: jen PJ, `map`, `tool: "surface"`, `kind` (ID plošné definice), `op: "add" | "remove"`, `points: [[x,y], ...]` (1–2048 celočíselných bodů), volitelné `hidden` (výchozí false), `levelId`, `requestId`. Rychlé tahy se interpolují. Přidání jen na podlahu; ubrání jen vybraného materiálu. Celý tah je jeden krok historie, opakovaný request nezapisuje znovu. Plochy ukládá `Dungeon.surfaces`; hráči dostávají jen známé veřejné buňky bez pole `hidden`. Staré zálohy mohou pole vynechat.

Jen PJ: `map` s `tool: "scenery"`, `op: "save"` a poli `kind`, `x`, `y`, `rotation` (0/90/180/270), `size` (`small`/`medium`/`large`), volitelně `note` a `hidden`. Vložení má `expectedRevision: null`, úprava existující `sceneryId` a jeho `expectedRevision`. `op: "remove"` vyžaduje stejné ID a revizi. `requestId` a Zpět používají běžnou mapovou historii. Konflikt vrací 409, neplatný vstup 400, hráč 403. [Projekce, paměť a datový model](SCENERY.md#data-a-vývoj).

Hromadné doplnění: `map`, `tool: "scenery-fill"`, `levelId`, `options: {seed, environment, density, hidden}`, `expectedStamp`, `requestId`. Prostředí: `auto/castle/mine/cave`; hustota: `sparse/balanced/rich`; semínko 1–80 znaků. Otisk sestavuje `sceneryFillStamp(map, blocked)`; rezervace pro náhled odpovídají `sceneryFillBlocked`. Server použije vlastní aktuální rezervace a návrh znovu vypočítá; klientská pole `fillBlocked` či seznam navržených prvků nemají autoritu. Změna podkladů vrací 409, prázdný návrh 400. Sada je jeden krok historie.

### Operace průzkumu a mapy

`explore.op`: `enable`, `level-add`, `level-rename`, `settings`, `place`, `stairs-add`, `stairs-remove` jsou jen pro PJ. `move`, `door`, `travel` ovládá PJ nebo určený vedoucí. `order` mohou měnit aktivní hráči/PJ; musí obsahovat úplné pochodové pořadí bez duplicit.

`map.tool`: `door-settings`, `room`, `floor`, `subtract`, `wall`, `door`, `erase`, `reveal`, `hide`, `stairsUp`, `stairsDown`, `stairsBoth`, `entrance`, `exit`, `undo`. Obdélníky používají `from` a `to`, tahy `points`, hrany `edges`, guma případně `cells`. Mapové značky a skutečné propojení schodišť jsou různé údaje.

Inspekce **Prozkoumat** je klientské čtení již filtrovaného pohledu PJ. Neexistuje `map.tool=inspect` ani nový zapisovací endpoint. Číslované značky jsou `mapNotes`, nikoli hrany nebo podlaha; číslo není identifikátor poznámky ani ID logické místnosti. `published.roomNumber` uchovává samostatně sdílené číslo. Nové generování V1/V2 vytvoří soukromé poznámky pro místnosti, s vypnutým upozorněním.

### Ochrana souběžných změn

- `expected` porovnává původní hodnoty jen změněných polí formuláře, typicky jako řetězce.
- `expectedRevision` má význam konkrétního objektu/modulu, ne globální `game.revision`. Výbava sdílí revizi s převzetím kořisti.
- Hromadné léčení ověřuje náhled všech zvolených postav před změnou; vyřazení navíc očekávané životy. Nepřepisuj nový stav starým náhledem.
- `generate.expectedState` je serverový stamp aktuálního seznamu pater a možnosti využít prázdné patro, ne libovolný klientský JSON.

Zdrojové příklady najdeš například v [testu mapy](../scripts/test-map.mjs), [výbavy](../scripts/test-equipment.mjs), [generátoru](../scripts/test-generator.mjs) a [obnovy](../scripts/test-repairs.mjs).


PJ načte bestiář pomocí `GET /api/game?room=KÓD&catalog=bestiary` s herním tokenem. Server vrací katalog pouze aktivnímu PJ. Požadavek hráče dostane 403, požadavek bez platného tokenu 401. Údaje o instanci příšery včetně jména a životů se nadále čtou z kampaně. Ilustrace jsou veřejné.

Při akci `monster` s `op: "create"` lze poslat `templateId` z [katalogu bestiáře](../content/bestiary). Server podle něj doplní výchozí jméno, životy, popis, bojové hodnoty a soukromou poznámku pro PJ. Vazbu na ilustraci zachovává kopie i úplná záloha. Identifikátor předlohy se posílá pouze v pohledu PJ.


`GET /api/adventures` vrací jen `id`, `title` a `summary` vestavěných dobrodružství. Volitelný `adventureId` při `create` vytvoří novou kampaň s mapou, přípravou místností a příšerami z předlohy. Při neplatném ID se kampaň neuloží. Bez `adventureId` vznikne vlastní kampaň s prázdnou mapou.

## Hlas

`GET /api/voice?room=<code>` vyžaduje herní token a vrací `{enabled: boolean}`. `POST /api/voice` se stejným přístupem a `{room}` vrací `{url, token}` nebo 503, není-li služba nastavená. Klient nesmí určovat identitu, jméno, cílový hlasový prostor ani práva; route je odvodí z ověřeného členství.

JWT povoluje pouze publikaci zdroje `microphone`, odběr zvuku a vstup do `stul-<code>`. Nepovoluje kameru, screen share, data, správu ani nahrávání. Platnost pro nové připojení je 120 sekund, odpovědi jsou `no-store`. Vypršení tokenu neruší již navázaný hovor. Viz [zdroj](../lib/voice.ts) a [provozní omezení](VOICE.md).

## Správa instalace (pouze Node)

| Endpoint | Přístup |
| --- | --- |
| `GET /healthz` | Bez přihlášení: `ok`, `version`, `revision`, `builtAt`, `maintenance`. |
| `POST /admin/api/login` | `{password}`, odpovídající `Origin`; nastaví HttpOnly/SameSite cookie. |
| `GET /admin/api/status` | Admin cookie; verze, release a dostupnost updateru. |
| `POST /admin/api/update`, `/admin/api/rollback` | Admin cookie, odpovídající `Origin`, identifikátor požadavku dle admin klienta; přijme úlohu se stavem 202. |
| `POST /admin/api/logout` | Admin cookie a `Origin`. |
| `POST /internal/maintenance` | Interní Bearer token updateru, `{enabled: boolean}`. |
| `POST /internal/backup` | Interní token; klidový režim a dokončené požadavky, vrací jméno SQLite snapshotu. |

Admin relace má nejvýše osm hodin. Odhlášení zneplatní konkrétní relaci i na serveru a restart ukončí všechny. Interní endpointy slouží pouze provoznímu updateru; nepoužívej jeho token v herním klientu ani veřejných ukázkách.

## Chyby a přenos

Obvyklý tvar chyby je `{error: "zpráva"}`. Zprávy jsou pro uživatele, nestav integraci na přesné shodě jejich znění.

- `400`: neplatná data/akce, případně nesplněná herní podmínka.
- `401` / `403`: neplatný přístup nebo chybějící oprávnění. Některé modulové kontroly vracejí 400, i když jde o nedostupný cíl.
- `404`: místnost nebo route neexistuje.
- `409`: konflikt hodnot/revize/stavu nebo vyčerpané opakování zápisu. Znovu načti aktuální stav a chraň rozepsaný formulář.
- `413`: překročení limitu požadavku. Herní POST omezuje tělo na 3 100 000 bytů; v něm je export JSON omezen samostatně. Hlasový POST má limit 1024 bytů.
- `429`: příliš mnoho neúspěšných přihlášení do administrace.
- `503`: služba/databáze nedostupná nebo údržba; údržba přidává `Retry-After`. `502` z Node proxy může znamenat start vnitřního serveru.

Čtení hry a hlasové odpovědi nepoužívej z cache; klient má sám hlídat revize a životnost session. HTTPS je požadovaný způsob veřejného přenosu. Herní role, administrátorská cookie a interní token jsou tři různé mechanismy přístupu.

## Soukromá metadata generátoru

V2 má `dungeon.generation` se stavem `valid` nebo `modified`, grafem místností, konkrétními trasami a parametry. `generationRuns` uchovává původ všech nových vložení včetně V1 a mapuje pořadí generovaných pater na uložená ID. Obě pole jsou pouze pro PJ a úplné zálohy; nikdy nepatří do hráčské paměti. Identita místnosti je dvojice `(levelId, roomId)`, nikoli samotné lokální ID. Souběžné stejné vložení nevytváří nový záznam. Pouze `valid` lze použít jako živý logický graf; `modified` zachovává historické identifikátory a původ. Viz [schéma a životní cyklus](GENERATOR_V2.md).

## Mechaniky přidané ve vydání 0.4.0

- `map` / `tool=door-settings`: PJ předá `edge`, tři booleany `locked`, `secret`, `discovered` a `expected` se třemi původními hodnotami. Změna patří do mapové historie. `dungeon.doorSettings` je pouze pro PJ; hráčská geometrie nahrazuje neodhalené tajné dveře zdí, paměť nikdy neukládá tajná nastavení.
- `equipment` / `op=transfer`: `memberId` odesílatele, `recipientId` aktivního hráče, `expectedRevision` výbavy odesílatele, `kind=item` s `itemId`/`quantity` nebo `kind=coins` s `coins`. Obě výbavy/měšce a jejich revize se mění atomicky v řádku kampaně. Nepotřebuje ani neodhaluje soukromou revizi příjemce.
- `explore` / `battle-start`: pouze PJ, vyžaduje umístěnou družinu; vytvoří `exploration.battle` (`id`, `levelId`, `origin`, `revision`).
- `explore` / `battle-move`: `battleId`, `memberId`, cílové `x`/`y`, `expected={x,y}` původní pozice; vlastník postavy nebo PJ. Známá průchozí cesta, společný výhled všech aktivních hrdinů; žádný rozpočet akcí.
- `explore` / `battle-end`: pouze PJ, `battleId`, `expectedRevision` rozestavení, známé cílové `x`/`y` pro seskupení na stejném patře. `move`, `place` a `travel` pro společnou družinu jsou během rozestavení blokované.

Nová pole jsou volitelná ve formátu záloh 1. Import ověřuje dveřní nastavení proti existujícím dveřím, soukromí paměti a platné patro/polohy aktivního rozestavení.

### Dohled podle světel

`explore` / `op=lighting` je pouze pro PJ. Přijímá `enabled`, `darkRadius` (celé 0–12) a `expected={enabled,darkRadius}` původního nastavení. Výchozí chybějící nastavení je `{enabled:false,darkRadius:1}`. Stav je v `atlas.lighting`; pohled `exploration.lighting` navíc vrací odvozené `activeLights`. `exploration.radius` zůstává horní hranicí dohledu (1–12).

`journey` / `add` a `update` mohou obsahovat `radius` (1–12) a `carrierId` hráčské postavy; `null` zruší konkrétního nosiče. Vynechané údaje při úpravě zachovají předchozí nastavení. Starý zdroj bez dosahu používá 4 pole. Společný zdroj v boji následuje vedoucího/prvního aktivního hráče, jinak bod družiny; zdroj archivovaného nosiče se ignoruje. Backup formát 1 zachovává nová volitelná pole včetně historie světel a validuje odkazy na nosiče.

Při zapnuté automatice se výhled přepočítá po změnách hry i při obnovení zálohy: přímý dohled hrdinů omezený `radius` se protne s osvětlenými políčky, navíc platí dohled bez světla. Každý světelný zdroj respektuje stejné zdi/dveře jako pohled. Přepočet paměť nemaže. Oprávnění měnit čas/světla zůstává jen PJ.

Při `explore` / `move` se stejný výpočet dohledu provádí na každém kroku známé cesty. Paměť neukládá samotný maximální dohled před omezením světlem. Viditelné mezilehlé oblasti zůstávají zapamatované i mimo konečný výhled.

### Situace v místnostech

Při `map-note` / `save` lze volitelným booleanem `parchmentOnEntry` nastavit automatické zobrazení situace. `showParchment: true` uloží přípravu a hned zobrazí situaci a uloží ji do chatu. Oprávnění PJ a kontrola `expectedRevision` zůstávají stejné. `publish` řídí samostatný popis pod značkou na mapě.

`explore` / `move` kontroluje přechod zvenčí dovnitř při každém kroku. `travel` vyhodnotí vstup na cílovém patře. Akce odešle pouze popis pro družinu jako zprávu s `parchment: {title, roomNumber?}` a uloží příznak `parchmentRevealed` přímo na poznámku. Díky tomu se situace neopakuje ani po ořezu historie chatu. Nastavení situace je ve zobrazení poznámky dostupné pouze PJ. Historie a příznak zveřejnění zůstávají v úplné záloze.

### Odpočet stavů a léčivé předměty

Při `initiative` / `roster` může PJ předat volitelný boolean `autoTick`. Vynechaná hodnota ponechá dosavadní nastavení. S aktivním odpočtem odečte `next` při přechodu do dalšího kola jeden krok u každého kladného trvání stavů účastníků. Kolo i stavy se uloží společně. Ochrana proti opakování požadavku platí pro obě změny.

Operace `equipment` / `use-healing` je dostupná PJ. Vyžaduje `memberId`, `itemId`, kladné celé `hpAmount`, revizi výbavy `expectedRevision` a hodnoty z náhledu `expectedHp` a `expectedMaxHp`. Server ověří náhled, odečte jeden kus a přičte životy nejvýše do maxima. Při plných životech operaci odmítne. Záznam v chatu vidí postava a PJ.

## Runtime katalogy

`GET /api/adventures` vrací pouze souhrny dostupných předloh. Autorizovaný PJ používá `GET /api/game?room=...&catalog=bestiary` a `catalog=preparation` (stafáž a předlohy generátoru); hráč dostává 403. Standardní herní odpověď přidává `contentVisuals` jen pro známou vizuální stafáž, nikdy soukromou `contentLibrary`.

Node administrace používá `/admin/api/catalogs`, `/view`, `/export`, POST `/create`, `/manifest`, `/entry`, `/copy`, `/image`, `/preview`, `/install`, `/discard`, `/enable`, `/remove`, `/rollback`, `/github` a `/recommend`. Je chráněna administrační cookie, kontrolou původu POST a údržbou; herní Bearer token nestačí. Úpravy vyžadují `expectedRevision`. ZIP a WebP endpointy přijímají přímo binární tělo; GitHub a ostatní operace JSON. Náhled importu vrací dočasný token pro následné potvrzení konkrétního ověřeného obsahu. POST `/github` přijímá `repository`, volitelné `ref` a při aktualizaci `updateId`; vrací také seznamy `items`, `newDependencies`, současný i dostupný otisk/zdroj. Je-li obsah shodný, vrátí `upToDate: true` bez tokenu a katalog nemění. Podrobnosti a povolené síťové cesty popisuje [GitHub distribuce](CATALOG_GITHUB.md).

`GET /admin/api/backup?name=...&bundle=1` vrací úplnou ZIP zálohu databáze s katalogovými obrázky; bez `bundle=1` zůstává původní SQLite export. Přesné limity a datový model popisuje [knihovna](CATALOG_LIBRARY.md).

### Administrace katalogů v 1.2.1

Rozdělení `catalog-store.mjs` je interní změna; katalogové HTTP cesty, ochrana administrační relací, kontroly původu i `expectedRevision` zůstávají součástí stejného kontraktu. Veřejné klientské soubory `/admin/app.js`, `/admin/catalogs.js` a `/admin/dialogs.js` neobsahují herní tajemství; přístup k datům nadále vyžaduje autorizované API. Dialogy používají HTML formulář uvnitř stránky, ne nativní `prompt()` či `confirm()`.

## Provozní hranice stabilizační větve

Následující ochrany jsou dostupné od vydání **1.2.2**.

- HTTP JSON tělo má nejvýše **3 100 000 UTF-8 bajtů**; server počítá průběžně i chunked vstup. Překročení vrací 413.
- Přenositelná záloha formátu 1 má nejvýše **3 000 000 bajtů kompaktního JSON**. Zápisy kontrolují výsledný export před atomickým uložením; překročení vrací 413 a původní kampaň zůstává zachovaná. Export před úspěchem znovu ověří schéma, odkazy a kontrolní otisky obrázků. Neobnovitelná starší kampaň dostane při exportu 409, nikoli zdánlivě úspěšný soubor.
- `create` a `restore` sdílejí limit zakládání všech stolů instalace: výchozích 100 za klouzavou minutu. Vyčerpání vrací 429 a `Retry-After: 60`. Limit se opírá o SQLite/D1 a přetrvá restart; nečte klientské IP hlavičky.
- Výchozí kapacita je 1 000 místností a 256 000 000 bajtů JSON dat místností. Překročení při založení vrací 503. Růst existující kampaně hlídá stejný atomický kapacitní predikát; při nedostatku kapacity vrací 503. Čtení a zmenšení existujících dat zůstávají možné. Nikdo automaticky nemaže kampaně.
- Návrat po ztracené HTTP odpovědi u chatu/hodu používá stejné ID. Každé samostatné vyvolání klientského odeslání má nové ID, i když má stejný obsah. Při síťové chybě, nečitelném potvrzení nebo 5xx provede klient nejvýše jeden automatický opakovaný přenos se stejným ID a totožným tělem. Pro explicitní další přenos téže operace musí volající uchovat její `requestId`. Po vyčerpání obou přenosů je výsledek nejistý: před novým uživatelským úkonem ověř historii; obnova stránky nezajišťuje trvalou frontu odesílání. Deduplikace není neomezený auditní archiv.

Konfiguraci a rozdíly hostingu popisuje [provozní návod](SELF_HOSTING.md#ochrany-stabilizační-větve). Měření a omezení jsou v [auditu](STABILIZATION_AUDIT.md).
