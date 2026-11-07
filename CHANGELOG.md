# Změny

## Příští vydání

Vývojová větev `main` používá označení `0.9.0-alpha.1`. Pro běžné hraní použij poslední stabilní vydání.

- Družina na hlavní obrazovce zobrazuje miniatury povolání ze stejných ilustrací jako deník.

## 0.6.0 — 2026-11-06

- **Správa instalace.** Přehled ukazuje služby, velikost databáze, volné místo a snapshoty. Správce může vytvořit a stáhnout ruční zálohu nebo po potvrzení obnovit databázi. Automatická retence je volitelná.
- **Kanály aktualizací.** Stable je výchozí. Stable a Preview nabízejí vyšší verze. Development vyžaduje potvrzení konkrétního commitu. U vydání jsou vidět poznámky, deklarované požadavky a dostupný výsledek CI.
- **Ověření před návratem do hry.** Updater ověřuje kompatibilitu před výměnou a pak kontroluje databázi, herní API a správu instalace. Pokud selže kontrola nové verze, obnoví původní kontejner a databázi.

Při přechodu z 0.5.3 nejdřív [aktualizuj samotný updater a Compose](docs/SELF_HOSTING.md#přechod-z-053-na-060). Stávající kampaně a zálohy formátu 1 lze používat i po přechodu.

## 0.5.3 — 2026-11-06

- **Soukromí u stolu.** Bestiář a rady k příšerám načítá z herního serveru pouze PJ. Schopnosti a bojové hodnoty deníku dostává jeho majitel a PJ. Klient po opuštění stolu ignoruje zpožděné odpovědi z původní relace.
- **Příprava dobrodružství.** Autor může podle ID připravit libovolnou místnost V2. Příšery se rozmísťují na volnou podlahu uvnitř místnosti. Ty, pro které není místo, může PJ umístit ručně ze seznamu.
- **Komunitní předlohy.** Každá příšera, předloha jeskyně a výprava má vlastní soubor JSON. Kontrola označí vadný soubor a pole. Postup ukazuje [návod pro autory](docs/OBSAH.md).
- **Ověření.** Integrační testy Cloudflare pracují s dočasnou databází D1. CI kontroluje soukromí předloh v obou buildech.

Aktualizace z 0.5.2 podporuje stávající kampaně a zálohy formátu 1. Vlastní instalaci aktualizuj podle [provozního návodu](docs/SELF_HOSTING.md#aktualizace-z-administrace).

## 0.5.2 — 2026-11-06

- Editor mapy odděluje vykreslení od obsluhy myši a klávesnice, včetně odesílání a opakování tahů.
- Formulář a oba generátory jeskyní sdílejí validaci parametrů. Stejné semínko a nastavení dávají stejnou mapu jako dřív.
- Validace záloh je rozdělena podle oblastí hry: mapa, postavy, souboj a příprava PJ. Formát záloh 1, konfigurace a SQL migrace zůstávají stejné.

## 0.5.1 — 2026-11-06

Formát záloh 1, konfigurace a SQL migrace zůstávají stejné.

- Katalog příšer, předlohy jeskyní a dobrodružství jsou samostatná validovaná data. Dvě ukázkové výpravy lze založit přímo v lobby.
- Generátor umí načíst předlohu parametrů. Výpočty hodů a zranění jsou oddělené od správy souboje.

- Vývojový stůl přes `npm run dev:node` používá vlastní SQLite databázi a běží bez Dockeru. Herní API, klientské dialogy a komunikace mají oddělené moduly popsané v příručce pro přispěvatele.

- Bestiář pro PJ má 30 ilustrovaných předloh. Nabízí filtr podle šesti prostředí a hledání podle názvu. Každá karta má větu **Jak ji hrát**, která se při přidání předlohy zkopíruje do soukromé poznámky příšery.

## 0.5.0 — 2026-11-06

- **Ilustrovaný deník.** Pět povolání má mužskou i ženskou kresbu. Obrázek se mění při výběru povolání. Nabídka vždy ukáže celý seznam a dovoluje zadat i vlastní název.
- **Bestiář pro PJ.** Dvanáct ilustrovaných předloh od skřeta po vodníka. Přidáním vznikne samostatná příšera pro aktuální patro s upravitelnými životy, bojovými hodnotami a popisem. Obrázek zůstává u kopie i po obnově ze zálohy.
- **Jednotný vzhled ilustrací.** Dokumentace obsahuje referenční kresby a prompty pro přípravu dalších postav a příšer.

SQL migrace, konfigurace a formát záloh 1 zůstávají stejné. Starší kampaně a zálohy fungují i bez údajů o předlohách bestiáře. Při obnově zálohy z 0.5.0 ve starší verzi se údaje o předlohách zahodí.

## 0.4.0 — 2026-11-05

- **Situace nad mapou.** PJ připraví popis, který se při prvním vstupu družiny rozvine nad mapou, nebo ho ukáže ručně. Více situací se zobrazí postupně a přečtené texty zůstanou v chatu.
- **Připravená setkání.** Soukromé upozornění PJ odkazuje přímo na rozpracovanou zkoušku, příšeru, přípravu souboje a kořist v daném prostoru.
- **Kde jsme skončili.** Družina vidí poslední shrnutí, otevřené stopy a uložené místo, které lze zvýraznit na mapě.
- **Dohled podle světla.** Dosah světla závisí na zdroji, nosiči a překážkách. PJ může nastavit dohled bez světla nebo přepnout na ruční řízení. Při přesunu každý krok respektuje osvětlení před zápisem do paměti mapy.
- **Souboj.** Jednotliví hrdinové se mohou rozestavit a pak znovu seskupit. PJ může zapnout odpočet stavů po kole a u léčivého předmětu společně potvrdit spotřebu a obnovu životů.
- **Zámky, tajné dveře a výbava.** PJ spravuje dveře přes inspekci. Hráči mohou předávat předměty a mince spoluhráčům.
- **Vzhled a pravidla.** Ovládací prvky mají sjednocenou teplou paletu. Příručka rozlišuje inspiraci hraním DrD 1.5, referenci hodů ze zjednodušených pravidel odvozených z 1.6 a vlastní úpravy.

SQL migrace a požadavky na konfiguraci jsou stejné jako v 0.3.0. Úplné zálohy zůstávají ve formátu 1 a starší zálohy lze obnovit. Automatický dohled podle světel a odpočet stavů zapíná PJ. Případné dřívější chybné odhalení lze ručně zakrýt.

## 0.3.0 — 2026-10-31

- Audit základních herních mechanik, doporučené priority a aktualizované návody pro označování a inspekci místností.

- Inspekce mapy pro PJ: (i) přepínač, přímé otevření značek a přehled obsahu místnosti/propojeného prostoru bez změny herního stavu.

- Číslované místnosti s názvy, přesouváním značek, seznamem míst a odděleně sdíleným číslem/popisem. Nově generovaná patra dostanou soukromé značky automaticky; čísla v náhledu se nepřekrývají se schodištěm či vstupy.

Generátor V2 byl začleněn přes [PR #1](https://github.com/cert4u/u-jednoho-stolu/pull/1). Vydání zachovává formát záloh 1 a nepřegenerovává existující mapy. SQL migrace se proti 0.2.0 nezměnily; staré zálohy nové volitelné údaje nepotřebují. Hlas je volitelný a vyžaduje vlastní konfiguraci LiveKitu.

- Generátor V2: logický graf a skutečně oddělené průchody, A* chodby, dveře, odlišné styly hradu/dolu/jeskyně, šest hodnocených kandidátů na patro a tři opakovatelné varianty. Zmrazené V1 výstupy, soukromý původ generování, životní cyklus metadat, kompatibilní zálohy, nezávislé edge-aware testy a benchmark.

- Sjednocená komunitní dokumentace: příručka hráče/PJ, dva runtime, interní API, provoz, hlas, limity, řešení problémů a vydávání. Kontrola místních odkazů, kotev a npm příkazů jako `check:docs` v CI.

- Čistě hlasový hovor družiny přes volitelný vlastní LiveKit: připojení se ztlumeným mikrofonem, mikrofon, poslech, výběr zařízení a účastníci/mluvící. Oddělené místnosti, krátkodobé serverem podepsané tokeny pouze pro mikrofon, úklid připojení při odchodu a lokální/veřejná Docker konfigurace s návodem.

- Trvalé značky vchodu a samostatného východu, ruční umístění na podlahu a zahájení průzkumu u vchodu. Generátor vytváří přízemí s vchodem, volitelný východ a podzemní patra; značky respektují odkrývání, paměť mapy, mazání, vrácení tahu a úplné zálohy.

- Generátor jeskyně s náhledem a opakovatelnými variantami: parametry pater, místností a chodeb, propojená kresba a schodiště. Vkládá nová patra nebo využije prázdné výchozí; ochrana souběhu, soukromí, limitu a opakování žádosti. Vygenerované mapy lze ručně upravit a zahrnují se do úplné zálohy.

- Vyřazení a návrat postav: automatické označení při 0 životech, rozhodnutí PJ o vyřazení/bezvědomí/smrti, soukromá poznámka, označení v družině a iniciativě. Léčení vybrané postavy přímo z rozhodnutí, ochrana souběhu a úplná záloha.

- Výbava a měšec: vlastní položky, úprava počtu a názvu, použití kusu, příjem a platby mincí s důvodem. Oprávnění majitele/PJ, soukromé záznamy, společná revize s kořistí a načtení aktuálního stavu s ochranou rozepsaných formulářů.

- Kořist družiny: soukromá příprava a zveřejnění nálezů, převzetí předmětů a mincí, přidělování PJ a rovné dělení se zbytkem. Měšec a získané předměty v deníku, historie rozdělení, ochrana souběhu a úplné zálohy. Nález lze připravit z poznámky na mapě.

- Zkoušky a pasti: výzva PJ konkrétnímu hráči, volitelně tajná nebezpečnost a soukromá viditelnost, jeden serverový hod na uloženou vlastnost, ruční následky a zrušení. Výzva může vycházet z poznámky na mapě; rozpracované zkoušky a historie se zachovají i v úplné záloze.

- Čitelnější herní stůl a dialogy bez viditelných posuvníků: kompaktní zkratky, nestlačované bloky levého panelu, větší a kontrastnější popisky, pevné záhlaví dialogů se zavíráním a dostupné posouvání obsahu. Odstraněn překryv nápovědy se soubojem na úzkých obrazovkách.

- Soukromé upozornění PJ při přiblížení družiny k poznámce: výchozí vzdálenost 2 pole, nastavení 1–6 nebo vypnutí, zachycení průchodu kolem místa i přechodu mezi patry. Otevření přípravy z upozornění chrání rozepsaný formulář.

- Poznámky k místům na mapě: tajná příprava PJ, samostatný zveřejněný popis, značky u odhalených políček, odvolání sdílení a ochrana souběžných úprav. Hráčům se neposílají tajné ani dosud nezveřejněné texty; poznámky jsou v úplné záloze.

- Čas a světlo: ruční posun průzkumu, společná evidence světel, odpočet pouze při rozsvícení, vyhoření a vrácení posledního posunu včetně spotřeby. Read-only přehled pro hráče, ochrana souběhu a zahrnutí do záloh. Dohled zůstává v pravomoci PJ.

- Odpočinek a léčení řízené PJ: jednotlivá i hromadná obnova životů a magenergie, doplnění do maxima, náhled a soukromé výsledky. Ochrana proti dvojímu provedení a souběžným změnám celé vybrané skupiny.

- Soukromý seznam vlastních kouzel a schopností v deníku, magenergie, použití s odečtením uložené ceny a volitelné oznámení družině. Oprávnění hráče/PJ, ochrana proti dvojímu použití a uchování v zálohách.

- Stavy hrdinů a příšer: vlastní název a poznámka, tajný stav pro PJ, ruční odečítání kol a označení doběhlého stavu. Stavy se zobrazují v družině a pořadí souboje a přenášejí se v záloze.

- Soubojové pořadí oddělené od pochodového: PJ vybírá hrdiny a příšery, upravuje pořadí a posouvá tahy a kola.
- Sdílený přehled v levém panelu a rozbalovací panel na mobilu. Skryté příšery zůstávají pouze u PJ.
- Ochrana proti dvojímu posunutí a souběžným úpravám; pořadí i rozehraný souboj se přenáší v úplné záloze.
- Administrace se otevře i při nedostupném Docker updateru a zobrazí vysvětlení.

## 0.2.0

- Vlastní hosting přes Docker Compose, Node.js a SQLite; původní Cloudflare varianta zůstává dostupná.
- Samostatná správa instalace na `/admin` s vlastním heslem.
- Ručně potvrzovaná aktualizace na poslední stabilní GitHub Release, sestavená z přesného commitu.
- Konzistentní záloha celé databáze, údržba při výměně, kontrola startu, automatický pokus o návrat při neúspěchu a ruční návrat k předchozí verzi.
- Oddělený updater, trvalý stav rozpracované aktualizace a návod pro provoz a obnovu.
- Testy autentizace, oprávnění a selhání aktualizace; CI ověřuje i skutečné kontejnery a zachování kampaně.

První spuštění vlastní instalace vyžaduje nastavení `.env` podle [návodu](docs/SELF_HOSTING.md). Starší hostovaná instance se tímto vydáním automaticky nemění. Kampaně lze přenést exportem a obnovou v zápisníku PJ.

## 0.1.0

První veřejná verze pod licencí MIT: herní místnosti, deníky, chat, čtverečkovaná mapa, průzkum, patra, příšery, bojové hody a zálohy kampaní.
