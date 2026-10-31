# Interní HTTP API

[Dokumentace](README.md) · [Architektura](DEVELOPMENT.md)

Toto je přehled aktuálního interního API pro přispěvatele, nikoli verzované veřejné integrační rozhraní se zaručenou stabilitou. Přesná povinná pole a validace jsou v [herní route](../app/api/game/route.ts) a odpovídajících modulech `lib/`; příklady pro jednotlivé operace jsou v integračních testech.

## Přístupy a společné konvence

Herní požadavky používají `Authorization: Bearer <token-postavy>`. Nejde o heslo `/admin` ani o token updateru. Identifikátor místnosti má 10 velkých hexadecimálních znaků. Kód místnosti sám neopravňuje číst existující soukromý stav; akce `join` s ním ale umožňuje přidat novou postavu, dokud je kapacita.

Mapové souřadnice jsou od nuly, x 0–27 a y 0–19. Hrany mají klíče `h:x:y` a `v:x:y`; vodorovná hrana spojuje `(x,y)` s `(x+1,y)`, svislá `(x,y)` s `(x,y+1)`. UI mřížka je číslovaná od 1. Výchozí patro má ID `ground`, další patra vlastní identifikátory.

Při opakování podporované mutace zachovej její `requestId` (běžně UUID; validace přijímá 16–80 alfanumerických znaků a pomlček). Nový identifikátor znamená novou akci. Historie opakování je omezená a různě scoped podle modulu; zejména `chat`, obyčejný `roll`, `character`, `notes`, přidání hráče a archivace nejsou univerzálně idempotentní.

## Čtení a export

| Požadavek | Výsledek |
| --- | --- |
| `GET /api/game?room=<code>` | Filtrovaný herní pohled pro držitele tokenu; `revision`, `me`, mapa, dostupní členové, chat a další panely. |
| `GET /api/game?room=<code>&level=<id>` | PJ může číst připravované patro; hráčský průzkumný pohled se řídí družinou, ne libovolnou požadovanou úrovní. |
| `GET /api/game?room=<code>&download=backup` | Jen PJ: úplný JSON export formátu 1. Vynechá herní tokeny/otisky klíčů, nikoli tajné herní texty. |

Pohled **není** vnitřní `Game`: tajná data se filtrují, některé hodnoty se dopočítávají a operační historie je odstraněná. Nepoužívej filtrovanou odpověď jako úplnou zálohu nebo náhradu databázového řádku.

## Zápis hry

`POST /api/game` přijímá JSON. Běžný požadavek obsahuje `action`, `room` a údaje akce, případně `levelId`. Úspěch většinou vrací `{game: <pohled>}`; přihlášení/obnova navíc `token`, `room` a nový `recoveryCode`. Vložení generované mapy vrací také `generatedLevels`.

| `action` | Oprávnění a význam |
| --- | --- |
| `create` | Bez tokenu: vytvoření místnosti a PJ, pole `name`. |
| `join` | Bez tokenu: `room`, `name`; vytvoří novou hráčskou postavu. |
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
| `monster` | PJ: vytvoření, kopie, údaje, poloha, životy a archivace příšer. |
| `mechanics` | Vlastní hody hráče, PJ i za ostatní; obrana podle cíle a viditelnosti akce, potvrzení/rušení jen PJ. |
| `initiative`, `condition` | Jen PJ: soubojové pořadí a stavy. |
| `power` | Majitel/PJ: vlastní kouzla, magenergie a použití. |
| `recovery`, `journey`, `life` | Jen PJ: obnova životů/magenergie, čas/světlo a vyřazení. |
| `map-note` | Jen PJ: pracovní a zveřejněný popis místa, volitelné `roomNumber` (1–999, unikátní na patře; `null` odstraní označení). Operace `move` přesune značku na `toX`/`toY` ve stejném patře, vyžaduje původní kotvu, `noteId` a `expectedRevision`. Přesun zachová ID a vazby na kořist/zkoušky. |
| `challenge` | Příprava/následky/rušení PJ; hod cílový hráč nebo PJ. |
| `loot` | Příprava/uzavření/dělení PJ; převzetí hráč pro sebe nebo PJ pro hráče. |
| `equipment` | Majitel/PJ: položky a měšec konkrétního člena. |
| `generate` | PJ: `options`, `expectedState` a `requestId`; server regeneruje geometrii z parametrů. `options.version` je `v1`/`v2`, chybějící znamená V1; V2 má `style` (`castle`, `mine`, `cave`) a `variant` 0–2. Nové UI volí V2. |

`cell` je odmítnutý starý způsob kreslení, nikoli alternativní zapisovací API.

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

Admin relace má nejvýše osm hodin a po restartu aplikace přestane platit. Interní endpointy slouží pouze provoznímu updateru; nepoužívej jeho token v herním klientu ani veřejných ukázkách.

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

## Mechaniky ve vývojové větvi po 0.3.0

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
