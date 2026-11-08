# Stabilizační a technický audit po 1.2.1

## 1. Výchozí verze a rozsah

Kontrola z 8. listopadu 2026 vychází z čistého `main`, verze **1.2.1**, commit `ef59634d1a5f7ff94d76201cc187dea99c73e0c3`. Opravy jsou v pracovní větvi `codex/stabilization`. Tato etapa nevytváří nové vydání, tag ani nasazení uživatelské instalace. Testy používají oddělené dočasné databáze.

Rozsah: obnovitelnost přenosných kampaní, synchronizace, provozní hranice, chat/hody, administrace, cílená údržba a regresní ověření. Herní pravidla, generátor V2, obsah katalogů a mechanismus serverové ZIP zálohy se nemění. Žádná nová externí služba, účet, telemetrie ani povinná síťová závislost.

Výchozí `npm run verify` prošel za **3,47 s**. Původní lint skončil za **7,38 s** s **15 chybami a 48 varováními**. Jde o měření tohoto stroje, nikoli SLA. Výchozí CI obsahovalo obě sestavení, integrace a samostatný Docker job, ale nebránilo nárůstu lint nálezů.

## 2. Nálezy a skutečná závažnost

| Nález | Klasifikace | Závažnost a výsledek |
| --- | --- | --- |
| Běžný zápis může zvětšit kampaň nad limit importu | Potvrzená chyba | P1, reprodukováno přes skutečné API, opraveno před uložením. |
| Odsazený soubor může přesáhnout limit formuláře | Potvrzené riziko transportu | P1, export nově používá kompaktní JSON stejně jako velikostní kontrola. |
| Přibližně 3MB import selže v D1 | Potvrzená provozní chyba | P1/P2, nový test odhalil 503; doplněna včasná 413 a vlastní test skutečné hranice D1. |
| Base64 portréty se přenášejí při každém pollingu | Změřené riziko | P2, podmíněný GET významně snižuje přenos nezměněného pohledu. |
| Anonymní create/restore nemají společný rozpočet | Reprodukovatelné provozní riziko | P2, atomická DB ochrana četnosti/kapacity a Node disková rezerva. |
| Chat a obyčejné kostky ignorují requestId | Potvrzená chyba při opakování | P2, původní API z pěti shodných požadavků vytvořilo pět zpráv. |
| Kategorie a editor místní položky se rozcházejí | Potvrzená chyba | P3, původní controller selže v cíleném behaviorálním testu. |
| Opuštění rozepsané položky / odpověď po odhlášení | Reprodukovatelné riziko | P3, potvrzení změny a generace administrátorské relace. |
| Dlouhé komponenty, CSS kaskáda, skryté scrollbary | Preventivní údržba | P3, cílené oddělení odpovědností a dostupné textové scrollbary. |
| Nativní prompt/confirm, konzistence katalogových kopií, CAS | Již řešeno ve výchozí verzi | Zachováno; existující testy znovu spuštěny. |

## 3. Reprodukce potvrzených chyb

### Přenosná záloha

Test obnoví platnou kampaň s obrázky demonstračního katalogu, přidá povolené záznamy zkušeností a doplní poznámku tak, aby kompaktní export měl přesně požadovaný počet UTF-8 bajtů. Na původním sestavení proběhl export → import pro 2 999 999 a 3 000 000 bajtů. Následná běžná úprava poznámky o jeden znak uspěla (200), export měl **3 000 001 bajtů**, jeho okamžitá obnova skončila **400**.

Po opravě stejná úprava vrací **413** a původní poznámka zůstává zachovaná. Na maximální podporované velikosti probíhá skutečný API round-trip a ověřuje se shodný snapshot katalogů včetně obrázků. Test zahrnuje odmítnutí nadlimitního HTTP těla. Unit test navíc prokazuje průběžné zastavení chunked vstupu bez Content-Length a správné dekódování UTF-8 rozděleného mezi chunky.

Cloudflare při původním pokusu uložit téměř 3MB kampaň vrátil 503. D1 má podle [oficiálních limitů](https://developers.cloudflare.com/d1/platform/limits/) maximum 2 000 000 bajtů na řádek. Sdílený přenosný formát zůstává 3MB; Cloudflare nově kontroluje 1 999 900 bajtů uloženého JSON a ponechává 100 bajtů pro ostatní pevné sloupce a SQLite záznam. V testovací kampani odpovídá hranici export **1 999 859 bajtů**; po obnově má řádkový JSON přesně 1 999 900 bajtů. Není to univerzální limit exportního souboru, protože tokeny a obnovovací údaje se do něj nevkládají. Node zachovává plnou hranici 3 000 000 bajtů exportu.

### Opakované zprávy a hody

Proti samostatně sestavenému původnímu commitu byly odeslány čtyři paralelní a jeden následný chat se stejným ID a autorem: vzniklo pět zpráv. Opravený test očekává jedinou zprávu. Šest paralelních opakování hodu má shodný výsledek. Jiný autor může použít stejné ID; jiný obsah se stejným ID stejného autora je konflikt 409. Samostatný unit test simuluje odmítnutý CAS zápis a opakuje akci z původní revize se stejným připraveným výsledkem kostek.

### Editor katalogu

Behaviorální test spouští skutečný `admin-catalogs.js` v minimálním DOM a řízeně zdržuje fetch. Původní soubor z 1.2.1 při změně z příšer na stafáž nechá `editing.type === 'bestiary'`; test tím selže. Opravený controller přepne editor i kategorii. Zrušené potvrzení zachová přesný rozepsaný JSON i původní filtr.

## 4. Implementované opravy

- [Limity zálohy a průběžného HTTP vstupu](../lib/backup-limits.ts), [validace přenosného formátu](../lib/backup.ts), [hranice D1](../lib/room-storage-limit.ts) a [API](../app/api/game/route.ts): kontrola před insert/CAS update, validace exportu včetně simulace importní normalizace a délky přístupových údajů. Kontrolní otisky obrázků ověřuje stávající validátor. Žádné automatické krácení příběhových dat.
- [Podmíněný autorizovaný pohled](../app/api/game/conditional-view.ts), [klient](../components/game-table/game-client.ts) a [polling](../components/game-table/use-game-polling.ts): SHA-256 ETag, 304 bez těla, validátor pouze v životnosti jedné relace a patra. Autentizace před porovnáním, `Vary: Authorization`, nadále `no-store`. Změněný stav má stejný JSON tvar jako dřív.
- [Přijetí místnosti](../app/api/game/admission.ts), [migrace](../drizzle/0003_room_admission.sql), [Node server](../server/start.mjs): sdílená minuta, počet místností, součet UTF-8 dat a atomické kapacitní predikáty. Růst stávající kampaně se hlídá také; zmenšení dat funguje i po snížení kvóty. Node má navíc 16MB rezervu volného disku. Žádné spoléhání na IP hlavičky a žádné mazání kampaní.
- [Zprávové operace](../lib/message-operations.ts), [schéma](../lib/backup/campaign-schema.ts), [validace odkazů](../lib/backup/validate-campaign.ts): posledních 256 ID/fingerprintů, scoped na autora. Ledger obsahuje SHA-256 vstupu a ID zprávy, nikoli další kopie textů či obrázků. Klient při nejistém výsledku zachová ID pro opakování stejného vstupu. Připravený serverový hod se při CAS retry nepřehazuje.
- [Administrace katalogů](../server/admin-catalogs.js): baseline rozepsaného JSON, potvrzení opuštění včetně nových položek, konzistentní kategorie, zneplatnění staré validace a odpovědí předchozího přihlášení. Stávající serializace operací a read-only katalogy zůstávají zachované.
- [Definice mapových nástrojů](../components/dungeon-map/toolbox.ts) jsou oddělené od komponenty. Identifikátory mutací patří k transportu. Admin controller byl zpřehledněn ve zvoleném rozsahu; neproběhlo plošné formátování projektu. Textové panely mají dostupné scrollbary; mapový papír zachovává klidný vzhled, lze jej zaměřit klávesnicí a v režimu forced-colors má systémové scrollbary.
- [CI lint brána](../scripts/check-lint.mjs) porovnává počty podle souboru/pravidla/závažnosti s [auditovaným základem](../scripts/lint-baseline.json). Historické nálezy se neskrývají a nový soubor nemá výjimku.

## 5. Nové a upravené testy

| Test | Co skutečně ověřuje |
| --- | --- |
| [test-stabilization](../scripts/test-stabilization.mjs) | API hranice a export → import s obrázky, neměnnost odmítnuté mutace, HTTP limit; Node i Cloudflare. |
| [test-hardening-unit](../scripts/test-hardening-unit.mjs) | Chunked/UTF-8 vstup, přesný byte limit, stabilní připravený hod po CAS retry, omezená velikost ledgeru. |
| [test-conditional-game](../scripts/test-conditional-game.mjs) | ETag/304, invalidace mutací, autentizace před porovnáním, izolace rolí a nepodmíněný export; Node i Cloudflare. |
| [test-message-replay](../scripts/test-message-replay.mjs) | Paralelní opakování, různí autoři, konflikt obsahu, starý klient, soukromí a obnova zálohy. |
| [test-room-admission](../scripts/test-room-admission.mjs) | Souběh, nastavená četnost, počet/velikost, restart, spoofované IP, růst/zmenšení a neplatné nastavení. |
| [test-public-admission-api](../scripts/test-public-admission-api.mjs) | Skutečný výchozí limit 100/min na Node i D1. |
| [test-admin-behavior](../scripts/test-admin-behavior.mjs) | Kategorie, neuložené změny, zrušení, stránky, nová položka/uložení, import/update preview, dvojí klik, pomalá odpověď a odhlášení, read-only. |
| Stávající test-admin-client | Nadále zakazuje nefunkční nativní prompt/confirm; nenahrazuje behaviorální test. |
| test-catalog-migration | Stará data a opakovaný start s novou migrací, datum starých místností 0. |
| test-updater | Navíc zachování nových provozních proměnných při výměně a rollbacku kontejneru v simulaci. |

Skutečný browserový smoke test proběhl na izolovaném Node adminu: vytvoření vlastního katalogu, rozepsaná položka, změna kategorie, potvrzení/zrušení, zachování dat, read-only výchozí katalog a mobilní šířka **390 × 844**. Dialog byl vizuálně čitelný. VM test není plnohodnotný browser a netvrdíme, že automaticky ověřuje CSS layout. Import/GitHub update/ZIP a obnova mají samostatné skutečné API integrační testy; interaktivní GitHub instalace nebyla při tomto browserovém smoke publikována ani prováděna proti veřejnému repozitáři.

## 6. Výkon a přenos před/po

Měření proti produkčnímu Node buildu na localhostu, dekomprimovaná těla JSON. Nezapočítává HTTP/TLS hlavičky, kompresi proxy ani obrázky mimo API. Stejná data před/po: demonstrační kampaň, celkem **20 příšer**, z toho 17 s běžným připnutým portrétem kobolda. Test nevyžaduje původní instalovaný katalog ani GitHub.

| Situace | Před | Po |
| --- | ---: | ---: |
| Běžný prázdný stůl, PJ | 5 828 B | 5 828 B při prvním načtení |
| Běžný prázdný stůl, hráč | 1 287 B | 1 287 B při prvním načtení |
| Kampaň s 20 příšerami a 8 klienty, PJ | 507 554 B/dotaz | Stejný první pohled; při shodě 0 B těla |
| Táž kampaň s 8 klienty, hráč | 3 293 B/dotaz | Stejný první pohled; při shodě 0 B těla |
| 4 klienti × 150 dotazů | 76 762 950 B | 511 753 B |
| 8 klientů × 150 dotazů | 79 590 750 B | 530 605 B |

Při čtyřech klientech je úvodní pohled menší (PJ 505 351 B, hráč 2 134 B), protože obsahuje méně členů. Zrychlené porovnání znamená 150 skutečných dotazů na klienta, bez dvousekundových pauz; přenosově odpovídá pětiminutovému oknu. Dále proběhl skutečný intervalový test **8 klientů, 150 dotazů po 2 s**, první v čase 0 a poslední kolem 298 s. Trval **298,044 s**, měl **8 odpovědí 200 a 1 192 odpovědí 304**, celkem **530 605 B** těl. Úspora při nečinnosti je **99,33 %**. Původní pětiminutový intervalový běh nebyl opakován; jeho přenos je součet skutečně změřených 150 neměnných odpovědí na klienta.

Server nadále načítá řádek, připravuje autorizovanou projekci a počítá její otisk. Tato změna neodstraňuje D1 čtení ani opakovanou serializaci. Při každé skutečné změně se stále posílá celý pohled včetně Base64. Nejde o samostatný veřejný image endpoint; obrazy zůstávají v přenositelném snapshotu. To zachovává offline provoz, soukromí a Cloudflare cestu bez nové infrastruktury. Další rozdělení obrázků má smysl až při naměřeném problému během aktivní hry.

Celkový klientský JavaScript (všechny lazy chunky, samostatně gzipované, bez obrázků/CSS) byl ve výchozím buildu **1 270 891 B / 357 033 B gzip, 10 souborů**. Finální build má **1 271 458 B / 357 709 B gzip, 10 souborů** (nárůst 567 B, resp. 676 B gzip). Čísla a výstupy jsou v [naměřených datech](performance/stabilization.json). Přetrvává původní upozornění bundleru na chunk větší než 500 kB; neřešili jsme ho nesouvisejícím rozdělením UI.

## 7. Vědomě otevřená rizika

- Historický lint dluh: 15 chyb a po odstranění nepoužitého importu 47 varování. CI nově brání nárůstu počtů, ale není to důkaz, že jsou všechny staré nálezy bezvýznamné.
- [Statický audit](performance/maintainability.json) našel **61 obecných UI modulů**, žádný dosažitelný z kontrolovaných vstupů. Obsahuje i seznam 18 produkčních závislostí bez dosažitelného doslovného importu. Volitelné registry, generované importy a build hooky vyžadují další revizi. Moduly ani závislosti nebyly automaticky odstraněny.
- CSS má **58 použití `!important`** a opakované selektory v responsive/kaskádových vrstvách. Samotná shoda selektoru není důkaz zbytečnosti. Plošná konsolidace by vyžadovala samostatnou vizuální regresní sadu; nyní se mění jen prokazatelně problematické globální skrytí scrollbarů.
- Deduplikace zpráv má okno 256 operací; není neomezená a starý klient bez ID ji nemá. Paměť nepotvrzených ID klienta nepřežije reload stránky.
- Sdílený limit zakládání není plná ochrana proti DDoS nebo nákladným neplatným požadavkům. JSON kvóta nezahrnuje WAL, katalogové soubory a zálohy. Reverse proxy, kapacita disku a limity tarifu zůstávají odpovědností správce.
- Existující nadlimitní či neplatná kampaň se neopravuje mazáním dat. Použij úplnou serverovou zálohu, na Cloudflare nativní export D1, a explicitní opravu. Včasná chyba je záměrně bezpečnější než neobnovitelný export.
- Původní 3MB formát neznamená 3MB kapacitu řádku Cloudflare. Pro velké kampaně je podporovanou cestou Node/Docker.
- Není zde trvalý automatizovaný browserový CI runner. Máme behaviorální test controlleru a skutečný ruční browserový smoke; jejich rozsahy jsou uvedeny odděleně.

## 8. Kompatibilita Node/Docker a Cloudflare

Přenosný formát zůstává **verze 1**. Stará validní data bez operačního ledgeru fungují. Nové pole `messageOperations` je volitelné a není v hráčské ani PJ herní projekci. Změna databáze je aditivní `created_at` a index; staré místnosti se nemažou. D1 používá stejný atomický admission SQL, ETag i zprávové operace. Dynamická knihovna katalogů zůstává stejně jako dříve pouze pro Node/Docker; vestavěný a připnutý obsah funguje i na Cloudflare.

Node provozní proměnné jsou v [.env.example](../.env.example) a [Compose](../compose.yaml), Cloudflare je přijímá přes runtime bindingy. Updater prostředí zachovává. [Provozní návod](SELF_HOSTING.md#ochrany-stabilizační-větve) vysvětluje rozdíl JSON kvóty, fyzického disku a řádku D1. Žádná nová cloudová služba ani obrázkový token v URL.

Docker engine není v tomto prostředí nainstalovaný (`docker` nenalezen). Skutečná výměna kontejnerů, síť, volume a obnova image zde proto nejsou ověřené. Simulace updateru a skutečná Node obnova serverového ZIP toto nenahrazují. V CI zůstává samostatný skutečný Docker job, doplněná větev zatím nebyla publikována ani spuštěna v hostovaném CI.

## 9. Stav kontrol

Kontroly níže byly skutečně spuštěny lokálně. Kompletní Cloudflare sada prošla za 73,21 s, kompletní Node hosting včetně katalogů za 70,69 s. Po posledním doplnění exportní normalizace byly na Cloudflare znovu cíleně spuštěny hraniční zálohy, podmíněný GET, replay a provozní limit; na Node prošly také. Chybějící prostředí se nevykazuje jako úspěch.

| Kontrola | Stav |
| --- | --- |
| `npm run verify` | Prošlo: dokumentace, obsah, TypeScript a unit/regresní sada (3,92 s v závěrečném měření). |
| `npm run lint` | Spuštěno, návrat 1: 15 historických chyb a 47 varování; není čistý. |
| `npm run lint:baseline` | Prošlo, bez nového počtu nálezů. |
| `npm run build` + `npm run check:client-content` | Prošlo. |
| `npm run test:ci` | Prošlo včetně skutečné hranice D1, idempotence a výchozího limitu zakládání. |
| `npm run build:node` | Prošlo. |
| `npm run test:hosting` | Prošlo včetně soukromí, souběhu, záloh, katalogů a obnovy. |
| `npm run test:catalogs` | Prošlo jako součást hostingu: migrace, ZIP, store, GitHub, admin, audit a skutečná obnova. |
| `npm run test:stabilization` | Prošlo. |
| `npm run test:updater` | Prošlo se simulovaným Docker enginem. |
| Skutečný Docker upgrade/rollback | Neověřeno, Docker není nainstalovaný. |
| Veřejný Cloudflare deployment / limity tarifu | Neověřeno; použit místní Worker/D1 runtime. |
| Browser desktop + mobil | Prošlo v popsaném smoke rozsahu. |
| Skutečný pětiminutový polling | Prošlo, podrobnosti v části 6. |

## 10. Doporučení nejbližšího stabilního vydání

Po provedených dostupných kontrolách je změna vhodná pro další komunitní testování v důvěryhodných skupinách. Před označením stabilního vydání spusť skutečný Docker CI upgrade/rollback se zachováním nové konfigurace a dat, proveď krátký společný PJ/hráč smoke proti cílovému hostingu a připrav zálohu. Pro veřejnou instalaci nastav přiměřenou četnost a kvóty; 100/min je výchozí společný technický strop, nikoli doporučená kapacita každého stroje.

Nezvyšovat teď objem funkcí. Další samostatné úkoly: postupně odstranit historické React lint chyby, zavést opakovatelný browserový CI smoke a podle skutečného aktivního provozu zvážit další redukci obrazových dat. Kompletní přepis UI/CSS ani nová synchronizační infrastruktura nemají v tomto auditu oporu.

### Manažerské shrnutí

Skutečně rozbité bylo překročení obnovitelné velikosti běžnou mutací, opakované odesílání zpráv/hodů a nesoulad editoru při změně kategorie. Hraniční test navíc odhalil chybný předpoklad o kapacitě D1. Tyto případy nyní mají opravy a regresní testy. Četnost/kvóty, menší přenos při nečinnosti a lint brána jsou preventivní zlepšení. Pro reálné hraní důvěryhodné komunitní skupiny je výsledek vhodný; před stabilním veřejným vydáním zbývá skutečný Docker upgrade/rollback a společný smoke na cílovém hostingu. Historický lint dluh a širší CSS/UI úklid zůstávají samostatné úkoly. Žádný release ani tag nebyl vytvořen.
