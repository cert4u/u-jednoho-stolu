# Generátor V2: audit a technický plán

## Audit původní implementace

V1 rozděluje papír do slotů, umístí obdélníky, propojí jejich středy minimální kostrou a několika náhodnými hranami. Chodby ignorují cizí místnosti a jiné trasy. Do mapy se ukládá sjednocená podlaha s obvodovými stěnami; plánovaný graf ani semínko se nezachovávají. To dovoluje nechtěné zkratky a znemožňuje bezpečně odvozovat význam místností. Dosavadní geometrické testy kontrolují především sousednost podlahy, nikoli průchodnost přes konkrétní hrany.

Náhled běží v prohlížeči ze sdílené funkce. Server při potvrzení geometrii znovu vypočítá, ověří stamp/kapacitu a vloží nová patra bez přesunu družiny. PJ má skutečnou mapu, hráči filtrovanou mapu/paměť. Historie mapy ukládá celé Dungeon snapshoty; to určuje umístění nových metadat. Přenosná záloha používá validační schéma verze 1 s volitelnými novými poli.

## Plán před implementací

1. Zachovat algoritmus V1 a připnout jeho geometrické výstupy regresními otisky. Chybějící verze ve starém požadavku znamená V1, nové UI vybírá V2.
2. Přidat společné typy: verze, styl, varianta, stabilní identifikátory místností, jejich skutečná políčka, role, sousedé a plánované spojení s konkrétní trasou.
3. V2 vytvoří prostorově realizovatelný graf sousedních slotů, kostru s odbočkami a volitelné alternativy. A* vede každé spojení mimo cizí místnosti a jiné koridory. Samotný dotyk políček není automatickým průchodem: povolené jsou pouze vnitřní sousednosti místnosti a plánované kroky chodeb, ostatní dotyky oddělují stěny.
4. Umělé podzemí má pravidelné komnaty a dveře, důl protáhlé pracovní prostory a větvení, jeskyně nepravidelné propojené masky. Nezavádět zámky, klíče ani AI službu.
5. Každý kandidát musí projít tvrdou kontrolou průchodnosti a shody s grafem. Z platných kandidátů vybírat deterministickým skóre; počet kandidátů držet omezený pro synchronní náhled i server.
6. Ukládat původ generování i mapová metadata pouze do přípravy PJ. Strukturální ruční změna označí metadata za neaktuální; vrácení tahu vrátí předchozí snapshot. Otevření dveří či pohyb nejsou změnou struktury.
7. Doplnit nezávislé edge-aware testy tisíců konfigurací, integrace/zálohy/soukromí/replay, benchmark bez křehkého CI časového limitu a jednoduchý výběr stylu/verze/varianty.

Nejde o produkční nasazení ani nové vydání. Následující části popisují implementaci V2 v této větvi.

## Datové struktury a životní cyklus

`lib/generator-types.ts` je společný kontrakt. `GeneratorOptions` má explicitní `version`, `style` a `variant` (0–2) vedle původních parametrů. Pouze chybějící verze znamená V1; neznámá verze nebo explicitní `null` je chyba. V1 dovoluje původní styl a variantu 0. Jeho jádro je zmrazené v `lib/dungeon-generator-v1.ts`; normalizace nových parametrů nezasahuje do staré geometrie.

`Dungeon.generation` obsahuje pro V2:

- `options`, seed, verzi, styl, variantu, index patra a číslo zvoleného kandidáta.
- Místnosti s lokálním stabilním ID, obálkou, skutečnými políčky, středem, rolí, sousedy a označením hlavní trasy.
- Spojení s identifikátory obou místností, uspořádanou trasou včetně obou hraničních políček místností a klíči dveří.
- Cílovou místnost a metriky hodnocení.
- Stav `valid` nebo `modified`.

Identita po uložení je dvojice `(levelId, roomId)`. Lokální ID se smí opakovat při vložení stejného seedu do jiné sady pater; uložené `levelId` je odliší. `Game.generationRuns` zaznamenává identifikátor vložení, úplné parametry a uložená ID pater pro všechny nové V1 i V2 jeskyně. Starším kampaním bez původu jej nedopočítáváme ani nevymýšlíme.

Strukturální změny podlahy, hran a značek ponechají stabilní ID jako historické kotvy, ale označí mapový graf `modified`. Odstranění původního propojení schodů zneplatní metadata přilehlých generovaných pater. Návrat mapového snapshotu nemůže obnovit platnost, pokud původní schodiště stále chybí. Ruční úpravy jsou nadále dovoleny, neznamenají automatickou rekonstrukci grafu. Pohyb, odkrytí a otevření/zavření dveří graf nezneplatňují.

Mapová historie obsahuje metadata jako součást snapshotu. Export verze 1 má nová pole volitelná: staré zálohy lze importovat; nové zachovají původ a graf. Při importu se platná metadata znovu geometricky ověří, změněná se přijmou jako neaktuální historie. Schéma odmítá neplatné grafové a původové odkazy/duplicity a skrytá metadata v hráčské paměti. Původní propojení pater s platnými metadaty musí odpovídat uloženému atlasu.

PJ dostává skutečnou mapu s metadaty a historii původu. Hráčský pohled obojí vynechává, včetně již odkrytých map. Paměť mapy se skládá pouze z povolené geometrie a značek.

## Generování a styly

V2 nejprve vybere souvislou množinu sousedních prostorových slotů a naplánuje kostru grafu s volitelnými dalšími sousedními hranami. Křížení není automatickým spojením: každá chodba má vlastní buňky a průchody. Doplňkové hrany jsou horní mez, nikoli požadavek použít vždy stejný počet.

- **Hrad:** pravidelné obdélníkové komnaty, větvená kostra, dveře na obou koncích každé chodby.
- **Důl:** DFS orientovaný růst, protáhlé a tenčí pracovní prostory, jiný poměr dveří a otevřených průchodů.
- **Jeskyně:** kompaktnější růst, nepravidelná propojená maska komnat a členitější trasy bez umělých dveří.

Velikost je přibližná charakteristika prostoru; důl ji realizuje odlišným poměrem stran. Počet místností zůstává přesný. A* pracuje se směrem posledního kroku, cenou zatáček a deterministickým prostorovým šumem. Trasy jsou omezené prostorem plánované sousední dvojice, nesmí pronikat jinými místnostmi ani sdílet již obsazenou chodbu. Povolené kroky vytvoří průchody; všechny ostatní dotyky podlah se zazdí.

Cílová komnata leží v maximální BFS vzdálenosti od vstupu. Hlavní trasa vede po nalezené nejkratší cestě v plánovaném grafu, vedlejší role vycházejí z větvení a velikosti. Slepé větve představují místnosti/pracovní komory, nikoli zvláštní samostatné uzly slepých štol.

## Tvrdá validace

Produkční validátor `lib/generator-validation.ts` kontroluje:

1. Rozměry, duplicity, nepřekrývající se vlastnictví a souvislost každé místnosti.
2. Jedinečné, krokově sousední trasy s konci ve správných místnostech, bez sdílení s cizím interiérem nebo chodbou.
3. Přesnou shodu povolených hran: naplánovaný průchod nesmí být zdí a nenaplánovaný dotyk musí být zdí. Obvod nesmí zůstat otevřený.
4. Deklarované dveře pouze ve skutečných vstupních hranách, s návazností podlahy z obou stran. Dveře jsou zavřené, ale otevíratelné existující mechanikou, nikdy automaticky zamčené.
5. Souvislost logického grafu, sousedy, hlavní trasu a její hrany, nejvzdálenější cíl a odvozené metriky.
6. Skutečnou dosažitelnost všech podlah při použití otevíratelných dveří. Ověření neignoruje stěny jako obyčejný flood-fill podlahy.
7. Vchod ve vstupní místnosti, bezpečný samostatný východ v cílové místnosti mimo schody a příslušné značky schodiště.

Neplatný kandidát se odmítne. Pokud nevyhoví žádný z omezené sady, generátor vrátí srozumitelnou chybu, nikoli částečný nebo neplatný návrh. Při potvrzení server stejný výpočet provede znovu; důvěryhodnou geometrii nepřebírá od klienta.

## Hodnocení kandidátů a varianty

Na každém patře vznikne šest kandidátů se samostatnými deterministickými podseedy. Platní kandidáti dostanou skóre podle exportovaných `QUALITY_WEIGHTS`: hlavní cesta 24, odbočky 14, smyčky 14, využití plochy 12, variabilita místností 20 a charakter chodeb 16. Vyšší skóre vyhraje, při shodě rozhodne původní pořadí. Hlavní délka v metrikách je počet místností, nikoli počet kroků hráče.

Tři tlačítka variant zachovávají seed a mění index varianty; návrhy se počítají jednotlivě. Nemáme formální párovou metriku minimální odlišnosti těchto tří variant. Větší sada seedů a variant se liší skutečným půdorysem i topologií, ale neslibujeme unikátní mapu pro každý možný seed. Počet kandidátů, PRNG, routing a váhy jsou součástí verze algoritmu; změna výstupu vyžaduje nové verzování nebo vědomé řešení kompatibility.

## Budoucí obsah bez AI závislosti

`LogicalRoom.content` připravuje volitelné pole pro název, hráčský text, tajný text, ID příšer/zkoušek/kořisti a popsané vazby na další místnosti. V této etapě jej generátor automaticky nenaplňuje ani nevytváří příběh. Stabilní dvojice ID a explicitní stav platnosti umožní budoucímu nástroji propojit přípravu s místem a odmítnout použití zastaralé geometrie.

Nejsou přidané žádné AI služby, internetové požadavky, placené API ani mechaniky zámků/klíčů. Existující poznámky, příšery, pasti a kořist nadále připravuje PJ.

## Ověření a měření

Nezávislý testovací validátor v `scripts/generator-v2-test-validator.mjs` nepoužívá generátorové routování ani jeho kontrolní pomocné funkce. Skládá fyzický graf z výsledných hran a porovnává jej s deklarovanými spojeními. Matice zahrnuje 2160 konfigurací a 6318 pater, tři styly, velikosti, krajní počty místností, 1–8 pater, varianty, dodatečná spojení a oba druhy chodeb. Doplňuje ji determinismus, připnuté výstupy V1/V2 a úmyslné poškození metadat, dveří a dělicích stěn.

Integrační sada ověřuje všechny styly, náhled/server, původ, utajení po odkrytí, opakování a souběh, přidávání pater, dveře, ruční úpravy/undo, schody a nové i staré zálohy. Zachované původní sady ověřují další mechaniky stolu.

Informativní benchmark: `npm run benchmark:generator`, počet měření lze určit `STUL_GENERATOR_BENCH_RUNS` (5–500). Měření na Node 22.23.2, Linux x64, Ryzen 7700X, 30 opakování po pěti zahřívacích bězích:

| Návrh | Medián | p95 |
| --- | ---: | ---: |
| V1, 3 patra × 6 místností | 0,960 ms | 1,402 ms |
| V2 hrad, 3 × 6 | 20,961 ms | 26,877 ms |
| V2 důl, 3 × 6 | 16,422 ms | 18,822 ms |
| V2 jeskyně, 3 × 6 | 18,245 ms | 18,739 ms |
| V2 hrad, 8 × 12 | 73,500 ms | 75,998 ms |

Časy platí pouze pro tento stroj; CI nemá časový práh. Jádro zůstává synchronní a omezené počtem kandidátů. Slabší mobilní zařízení mohou náhled počítat déle; rozhraní před výpočtem vykreslí stav přípravy.

## Etapy a omezení

A–E mají implementovaný audit, model, geometrii, styly/topologii a výběr kandidátů. F zahrnuje jednoduché UI, kompatibilitu, dokumentaci a regresní ověření. Dokončení a přesně spuštěné kontroly jsou zaznamenané v závěrečném reportu této změny.

Zůstávají omezení 28 × 20 polí a 8 pater, prostorová slotová struktura, jen sousední plánovaná spojení, žádné mosty/podchody a žádné sdílené buňky nezávislých chodeb. Přednost dostává bezpečná topologie před volností rozmístění. Struktura je různorodá, nikoli simulací historické stavby nebo geologie. Samostatné slepé štoly, zámky/tajné průchody a automatická příběhová náplň zůstávají možným pokračováním.

## Závěrečný report ověření

| Etapa | Stav a dokončený rozsah |
| --- | --- |
| A | Hotovo: audit toku náhled → potvrzení → atlas → průzkum → export a technický plán. |
| B | Hotovo: graf, stabilní dvojice ID, úplný původ, soukromá metadata, schéma a životní cyklus. |
| C | Hotovo: plánované vstupy, směrové A*, oddělené trasy, dveře a tvrdá geometrická validace. |
| D | Hotovo v popsaném rozsahu: hrad/důl/jeskyně mají rozdílné strategie, hlavní cestu, cílovou komnatu, větve a volitelné smyčky. Samostatné slepé koridorové uzly nejsou přidané. |
| E | Hotovo: deterministický výběr nejlepšího ze šesti kandidátů na patro a tři samostatně počítané varianty. Formální minimální podobnost mezi variantami není garantovaná. |
| F | Hotovo: UI, dokumentace, kompatibilita, automatické a vizuální ověření v uvedených prostředích. |

Skutečně provedené lokální kontroly:

- `npm run check`, `npm run check:docs`, `npm test`, `npm run test:updater`: prošly.
- Node: `npm run build:node` a `npm run test:hosting`: prošly všechny stávající i nové sady, celkem 23, navíc admin/údržba/SQLite snapshoty a restart.
- Cloudflare: `npm run build`, `npm run db:init`, `npm run test:ci`: prošly všechny 23 sady proti oddělené lokální emulaci.
- V2 matice v každém úplném běhu: 2160 různých nastavení, 6318 pater. Čas samotné matice byl přibližně 37 sekund při prvním Node běhu; nejde o výkonnostní podmínku. Připnuté V1 a V2 výstupy i regresní poškození prošly.
- Integrační testy ověřily staré kampaně a zálohy, chybějící/poškozený původ, validní i ručně změněná metadata, schodiště a jejich odstranění/undo, souběh a opakování, neveřejný graf i budoucí tajný obsah a skutečné otevření dveří před pohybem.
- V prohlížeči: náhled všech tří stylů, změna varianty a patra, přepnutí V1/V2, potvrzení přírodní jeskyně, umístění u vchodu a oddělený hráčský pohled. Mobil 390 × 844: šířka dokumentu 390 px, dialog 366 px, obsah 364 px, bez vodorovného přetékání.

Buildy a databáze pro ověření vznikly v oddělených dočasných kopiích; nešlo o produkční nasazení nebo vydání releasu. GitHub Actions workflow zůstává zachované. Výše uvedené jsou skutečné lokální běhy jeho příkazů, nikoli tvrzení o výsledku vzdáleného CI. Skutečný Docker engine v tomto prostředí nebyl dostupný, takže vzdálený Docker job je nutné posoudit podle kontrol pull requestu.

Ve vyjmenovaných konfiguracích nebyla zjištěna kritická geometrická chyba. Nejde o důkaz pro každý možný seed; další nepodporované či neřešitelné konfigurace mohou bezpečně skončit chybou. Rozměry, prostorová slotová strategie, synchronní výpočet a výše uvedené neimplementované mechaniky zůstávají přiznanými hranicemi řešení.
