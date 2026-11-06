# Audit komunitní připravenosti

Výchozí stav je commit `d024b7c` hlavní větve ověřený na GitHubu. Výchozí stabilní vydání je 0.5.2. Audit rozlišuje závady doložené kódem nebo reprodukcí od návrhů, které čekají na zkušenost z provozu.

| Priorita | Potvrzený výchozí stav | Úprava a důsledek |
| --- | --- | --- |
| P0 | Rady bestiáře určené PJ byly v klientském JavaScriptu. Přímý import v panelu i nepřímý import přes modul souboje vtahovaly celý katalog. | Bestiář dostane pouze aktivní PJ přes [herní API](../app/api/game/route.ts). Panel hodů používá čisté bojové výpočty. [Kontrola buildu](../scripts/check-content.mjs) hledá texty předloh pro PJ v klientských souborech obou runtime. Zdrojové předlohy zůstávají součástí veřejného repozitáře. |
| P0 | [Herní pohled](../app/api/game/view.ts) vybíral soukromé údaje deníku výčtem zakázaných polí a zbývající pole kopíroval. Cizím hráčům tak posílal schopnosti a bojové hodnoty. | Pohled má výslovný seznam sdílených polí. Vlastník a PJ dostávají plný herní deník bez přístupových údajů. Hranici ověřuje [test mechanik](../scripts/test-mechanics.mjs). |
| P1 | V jednom souboru na celý katalog se těžko kontrolovala samostatná změna a při souběžném přispívání vznikaly konflikty. Chyby ilustrací a některých odkazů neukazovaly přímo zdroj příspěvku. | [Katalogy](../content) mají jeden JSON na předlohu a generované statické indexy pro Vite i Node. Stejná Zod schémata používá runtime a kontrola obsahu. Chyba uvádí soubor a pole. |
| P1 | [Založení dobrodružství](../lib/start-adventure.ts) umělo připravit pouze vstup nebo cíl a všechny příšery pokládalo na značku poznámky. | Volitelný cíl přes ID místnosti V2 a autorská fáze. Příšery obsazují volnou podlahu podle tvaru místnosti. Přebytek čeká v seznamu PJ. |
| P1 | [Integrační běh D1](../scripts/test-ci.mjs) používal vývojová data. | Test si aplikuje migrace v dočasném úložišti, použije vlastní lokální port a úložiště po ukončení odstraní. |
| P1 | Zpožděná odpověď mutace mohla po opuštění stolu znovu propsat stav a obnovovací dialog do [klienta](../app/page.tsx). | Opuštění zneplatní místní odkaz na relaci. Odpověď operace zahájené pod jinou relací se nepoužije. |
| P2 | Chyběly krátké šablony pro herní obsah a jedno místo pro postup přidání předlohy. | Přibyly dvě issue šablony, údaje o původu v PR a [praktický návod](OBSAH.md#první-příšera-nebo-dobrodružství-za-15-minut). |
| P3 | Vykreslení mapy má pevnou paletu a symboly přímo v SVG. | Budoucí kresbu lze řešit uvnitř [plátna](../components/dungeon-map/canvas.tsx). Pro druhý styl by dávalo smysl vytáhnout jeho paletu a značky, jakmile bude existovat druhý konkrétní návrh. |

## Co drží architekturu pohromadě

- **Klient.** `app/page.tsx` ještě spojuje stav stolu, navigaci a operace. Dialogy, chat, síťový klient a polling už mají vlastní moduly. Další rozdělení má smysl s konkrétní změnou jedné z těchto oblastí. Statický rozbor lokálních runtime importů v `app`, `components`, `db` a `lib` nenašel cykly. Dynamický import a závislosti třetích stran tento rozbor nepokrývá.
- **Server.** Autentizace a zápis zůstávají v route, akce v [rozcestníku](../app/api/game/actions.ts), pohled v samostatné projekci. Zápis používá podmínku nad revizí a při kolizi načte novější stav. Zálohové schéma vynechává přístupy a ověřuje vazby napříč kampaní. Formát exportu je 1.
- **Mapa a generátor.** Herní geometrie a dohled jsou v `lib/`. Vstup a vykreslení mají vlastní komponenty. Autor vybírá místnost podle ID ve výsledku V2. Při založení se obsah zkopíruje do existujících herních poznámek a příšer. Kvůli této přípravě stačí současný formát kampaně. Matice generátoru a jeho kontrolní otisky pokrývají reprodukovatelnost.
- **Synchronizace.** [Polling](../components/game-table/use-game-polling.ts) běží po dvou sekundách a požadavky jedné smyčky se nepřekrývají. Běžný dotaz vždy načte a deserializuje stav a sestaví pohled znovu, i když se revize nezměnila. Při dvanácti otevřených kartách to v klidu znamená zhruba šest čtení za sekundu. Lokální D1 sada při běžných požadavcích ukázala odezvy v řádu jednotek až desítek milisekund. To je pozorování ze syntetických kampaní, nikoli kapacitní test. Další měření má smysl na dlouhé skutečné kampani. Pokud bude dominantní přenos, první kandidát je podmíněný GET podle člena, revize a zobrazeného patra.
- **Testy.** API sady kontrolují oprávnění, obnovu, souběh a průzkum. Pro budoucí Playwright sadu má největší přínos dvojice izolovaných prohlížečových kontextů PJ a hráče, kreslení myší a klávesnicí, obnova spojení a jeden úzký viewport. Vstupní podmínkou je samostatná lokální SQLite databáze a čekání na stav rozhraní nebo odpověď API bez pevných časovačů.

## Výsledek ověření

- Čistý klon prošel instalací, nastartoval vývojový server a vytvořil vlastní SQLite databázi. V prohlížeči prošlo založení výpravy Co hlídají kořeny, kontrola dvou samostatných značek krys a načtení, vyhledání i přidání kobolda z bestiáře.
- Prošly `npm run verify`, Cloudflare a Node build, kontrola klientských souborů v obou buildech, D1 integrační sada, `npm run test:hosting` a testy updateru. Matice V2 prověřila 2 160 nastavení a 6 318 pater včetně kontrolních otisků V1/V2. Cílený test potvrdil opakovatelné rozmístění i přebytek bez pozice.
- Porovnání se stabilní verzí 0.5.2 ověřilo přesnou shodu všech předloh příšer a jeskyní podle ID. Nový čteč načetl zálohu ze stabilní verze a starý čteč načetl zálohu nově založeného dobrodružství. V obou směrech se shodla mapa s propojeními, poznámky, příšery a původ generování.
- Reálnou výměnu kontejnerů ověřuje úloha CI pro Docker. Na místním stroji nebyl příkaz `docker` dostupný.

## Licence obsahu

MIT pokrývá zdrojový kód. Při posuzování nového obsahu eviduj texty a ilustrace zvlášť a u převzatých materiálů zachovej doložené podmínky. Před sjednocením politiky musí správce ověřit původ a oprávnění ke každé položce, které se rozhodnutí týká.

- **Doporučení pro nové původní texty a ilustrace.** Zvážit CC BY 4.0 s uvedením autora, zdroje, licence a provedených změn. Přijetí politiky a souhlas autorů patří správci. [Podmínky CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Varianta pro různorodé zdroje.** Evidovat podmínky u každého díla a přijímat položky jednotlivě. Výhodou je možnost dodržet konkrétní svolení, cenou je evidence a kontrola slučitelnosti pro další přispěvatele. [Doporučení Creative Commons pro poskytovatele a uživatele licencí](https://creativecommons.org/share-your-work/licensing-considerations/version4/)

## Co ověřit při další změně

- Autor změny parametrů jeskyně má znovu projít návaznost na ID místností. Platné ID může po změně semínka označovat jinou místnost.
- Kontrola WebP ověřuje hlavičku kontejneru a délky. Vizuální kontrola PR má zachytit poškozený obrázek nebo nevhodný obsah.
- Při přidávání dalších tajných polí používej výslovnou projekci a rozšiř testy PJ a hráče. Ve veřejném repozitáři může kdokoli číst zdrojové předlohy.
- Pro rozšíření veřejného provozu nejprve změř největší reálnou kampaň a vyzkoušej ji s celou družinou.
