# Herní příručka

[Dokumentace](README.md) · [Řešení problémů](TROUBLESHOOTING.md) · [Limity](LIMITS.md)

Tato příručka popisuje chování aplikace, nikoli úplná pravidla DrD. Pravidla vaší skupiny a rozhodnutí PJ určují následky situací. Aplikace eviduje mapu, postavy a výsledky; automaticky nepřepočítává povolání, vybavení ani účinky kouzel.

## Role a přístupy

| Role | Úloha |
| --- | --- |
| Hráč | Vlastní deník, výbava, kouzla, hody, chat, převzetí zveřejněné kořisti. |
| Vedoucí družiny | Hráč určený PJ; navíc pohyb společného žetonu, dveře a přechod po schodech. |
| Pán jeskyně (PJ) | Příprava mapy a příšer, dohled, zkoušky, souboj, potvrzení zranění, zkušenosti, léčení a přístupy hráčů. Může také přesouvat družinu. |
| Správce instalace | Provoz, heslo `/admin`, databázové zálohy a aktualizace. Heslo správce není přístupem k postavě PJ. |

1. PJ založí místnost a zkopíruje pozvánku z horního panelu.
2. Hráč se připojí se jménem postavy. Stejná pozvánka při novém připojení nezaručuje návrat ke staré postavě.
3. Každý přes avatar nahoře vpravo uloží svůj **obnovovací klíč**. Pro návrat z jiného prohlížeče použije **Vrátit se ke své postavě**. Použití klíče vydá nový klíč a odvolá předchozí herní přihlášení postavy.
4. PJ může hráči vydat nový klíč. Samotné vydání nahrazuje starý obnovovací klíč; přihlášení se mění až jeho použitím. Archivace hráče odpojí a uvolní místo, deník zachová. Vrácení postavy vydá nový klíč.

Opustit stůl v prohlížeči odstraní místní přihlášení, ne kampaň. Ztracený přístup PJ potřebuje jeho obnovovací klíč nebo obnovu kampaně/instalace ze zálohy. Neexistuje společné výchozí heslo pro PJ.

## Deník a soukromí

V **Můj deník** zapisuj jméno, rasu, povolání, úroveň, pět vlastností a hotové bojové hodnoty ÚČ, OČ a útočnost. Změna povolání či výbavy je sama nepřepočítá. Úroveň se zkušenostmi automaticky nezvyšuje; zkušenosti přiděluje PJ.

Výbava, měšec, vlastní kouzla, magenergie a soukromé poznámky jsou dostupné majiteli a PJ. Ostatní hráči nedostávají jejich obsah. Životy a veřejné stavy jsou společnou informací. PJ spravuje obnovu a další herní akce; základní formulář **Můj deník** upravuje vlastní postavu i v roli PJ.

Rozepsaný formulář chrání neuložené změny. Pokud mezitím někdo změní tentýž údaj, aplikace změnu odmítne jako konflikt. Poznamenej si rozepsaný text a načti aktuální stav; neopakuj starý požadavek naslepo.

## Příprava mapy

V **Příprava mapy** PJ kreslí na podlahu/příslušné hrany:

| Nástroj | Chování |
| --- | --- |
| Prozkoumat (i) | Jen PJ: detail značky nebo přehled obsahu místnosti. V přípravě i odkrývání; nemění herní stav. |
| Označit místo | Číslo, název, popis a tajná příprava; volitelné sdílení. |
| Místnost | Tažení mezi rohy vytvoří půdorys. Překryvy se spojí, společný obvod se upraví. |
| Chodba | Tažení přes políčka přidává podlahu a upraví obvod. |
| Příčka | Ruční zeď mezi průsečíky; zůstává i při spojování místností. |
| Dveře | Kliknutí na hranu vytvoří dveře; pokud hrana nebyla zdí, vznikne příčka s dveřmi. |
| Schody nahoru / dolů / oba směry | Kreslená značka na podlaze. Samotná značka nepropojí dvě patra. |
| Vchod / Východ | Jeden bod každého druhu na patře. Další kliknutí značku přesune; oba body musí být na různých políčkách podlahy. |
| Ubrat prostor | Odstraní podlahu i značky v odebraných políčkách a upraví obvod. |
| Guma | Maže ruční hrany; středem políčka maže značky schodů, vchodu a východu. Pro změnu půdorysu použij Ubrat prostor. |
| Zpět | Vrátí poslední uložený tah mapy z omezené historie, nikoli všechny herní akce. |

**Generátor V2** vytvoří náhled podle stylu, počtu pater a místností, velikosti a složitosti. Hradní podzemí má pravidelné komnaty a dveře, důl protáhlé pracovní prostory a větvení, jeskyně nepravidelné půdorysy. Stejná verze, nastavení, semínko a varianta dávají stejný návrh. Tři varianty se vybírají jednotlivě, nové semínko vytvoří novou sadu. Pokročilá část nabízí i původní V1 pro opakování starých seedů. Změníš-li nastavení nebo se změní kapacita pater, vytvoř nový náhled před vložením.

Potvrzená patra se přidají ke stávajícím. Jen skutečně prázdné výchozí patro lze využít znovu. Generátor vytvoří propojenou podlahu, obvodové zdi, schodiště mezi novými patry a vchod na jejich přízemí, volitelně samostatný východ. V2 přidává otevíratelné dveře, nikoli zámky; nepřidává příšery, pasti ani kořist a neodhalí mapu. Družinu nepřesouvá. Přípravu lze ručně upravit; propojení ke starší mapě nastavuje PJ. V2 ukládá původ generování a soukromý graf. Změna podlahy, hran nebo značek označí graf za neaktuální; otevření dveří nebo odkrytí mapy jej nezneplatní. Zpět obnovuje mapové snapshoty včetně metadat, pokud stále odpovídá navazující propojení schodů.

## Průzkum, dohled a patra

PJ v **Nastavení a schodiště** určí vedoucího a dohled, potom umístí družinu na podlahu. Existuje-li vchod zobrazeného patra, tlačítko **Umístit družinu u vchodu** nastaví začátek přímo tam. Východ je orientační značka, automatický přechod do venkovní mapy není implementovaný.

Vedoucí nebo PJ klikne na známé průchozí místo. Pohyb vede známou podlahou a neprojde zavřenými dveřmi. Pokud je cíl nedostupný, postupuj blíž nebo nejprve otevři dveře. Dveře hráč ovládá až u družiny stojící vedle jejich hrany. Zdi, rohy a zavřené dveře omezují výhled. Dříve objevená mapa zůstává šedá; skryté pozdější úpravy se do její paměti nepromítnou, dokud se místo znovu neobjeví.

Pochodové pořadí mění hráči nebo PJ v levém panelu, na mobilu přes **Družina, čas a patra**. Slouží jako informace pro popis a útoky; neurčuje automaticky iniciativu nebo cíl přepadu.

Patra PJ připravuje nezávisle na poloze družiny. Pro funkční schodiště propojí v nastavení dva body podlahy na různých patrech. Jakmile družina stojí na propojeném bodu, vedoucí nebo PJ potvrdí přechod v levém panelu. Generátor propojuje svá nová patra automaticky.

**Pohled družiny** je náhled pro PJ. Režimy kreslení a odkrývání hráči nemají. Bez společného průzkumu lze odhalovat obdélníky ručně; po jeho zahájení se aktuální výhled řídí polohou družiny. Příšery mimo aktuální dohled nezůstávají jako známé živé žetony v šedé paměti.

### Ovládání mapy

- **Ctrl + levé tažení**, **Mezerník + tažení** nebo **Ruka**: posun papíru.
- **Ctrl + kolečko**, tlačítka plus/minus: změna měřítka.
- **Přizpůsobit mapu oknu**, případně **Najít družinu**: návrat do užitečného pohledu.
- Po zaměření mapy **šipky** volí políčko, **Enter** potvrzuje; místnost/oblast se potvrzuje dvěma body. **Escape** zruší rozpracovanou volbu. Ruční stěna pracuje s průsečíky mřížky.

## Poznámky, příšery a pasti

PJ zapne nástroj **Prozkoumat** s ikonou **(i)** v přípravě i odkrývání. Kliknutí na poznámku nebo příšeru otevře její detail; kliknutí na podlahu zobrazí místa a tajnou přípravu, příšery, navázanou kořist/zkoušky, dveře, schodiště, vstupy a postavy v daném prostoru. Kliknutí těsně na hranu ukáže zeď či stav dveří. Klávesnicí vyber políčko šipkami a potvrď Enterem. Inspekce nic nekreslí, neposouvá ani neodhaluje hráčům.

U nezměněné V2 mapy odpovídá přehled logické místnosti generátoru. U ruční či strukturálně upravené mapy vychází z podlahy propojené bez zdí a dveří; dveře tvoří hranici i otevřené. Volně průchozí chodby mohou propojit více místností do jednoho přehledu. Kořist a zkoušky jsou zahrnuté podle vazby na poznámky uvnitř prostoru.

Nově vložené generované jeskyně dostanou číslované soukromé značky automaticky. Čísla se při přesunu nemění a jsou oddělená od čísel příšer. Automatické značky mají upozornění při přiblížení vypnuté; PJ je může zapnout pro vybraná místa. Čísla v náhledu se umísťují mimo schodiště, vchod a východ. Dříve uložené mapy se zpětně nepřepisují.

Nástrojem **Označit místo** PJ klikne na podlahu a otevře přípravu místa. Volba **Označit jako místnost v mapě** přidá číslo (1–999, unikátní na patře) a název přímo do mapy. Bez této volby zůstane malá značka „i“. Značku lze v nástroji **Označit místo** nebo **Postavy/Družina** přetáhnout na jiné volné políčko podlahy; kliknutí otevře přípravu. Tlačítko **Místa** zobrazí seznam číslovaných místností na aktuálním patře, umožní najít značku nebo otevřít přípravu/popisek. **Uložit přípravu** nic nesdílí; **Uložit a sdílet popis** publikuje samostatnou verzi čísla, nadpisu a popisu, dostupnou hráčům u odhaleného políčka přes značku v mapě. Tajný text zůstane u PJ. Běžná úprava pracovní verze nezmění již zveřejněný text; sdílení lze odvolat.

Upozornění při přiblížení má výchozí dosah 2 pole, nastavení 1–6 nebo vypnutí. Funguje i přes stěny a sleduje průchod družiny kolem místa. Během pobytu v okolí se neopakuje. Je soukromou připomínkou PJ, nic automaticky neodhaluje ani nespouští hod či poškození.

Příšeru PJ vytvoří v **Příšery** a umístí na podlahu. Má vlastní číslo, životy a bojové hodnoty. Ručně skrytá příšera zůstává skrytá i na viditelném místě. Hráči nedostanou její tajné statistiky a poznámky. Nula životů ji označí za poraženou; archivace a odebrání z mapy jsou samostatné operace.

Past lze popsat poznámkou a připravit z ní zkoušku. PJ vybere postavu a vlastnost, nastaví opravu a nebezpečnost, její zveřejnění a soukromou či společnou výzvu. Hod provede hráč nebo PJ, následky a případnou změnu životů potvrdí PJ samostatně.

## Hody a souboj

Běžné kostky jsou v chatu; například `/hod 2k6+1`. Příjemce určuje, kdo výsledek uvidí. Šeptání mezi hráči není automaticky viditelné PJ, pokud není jeho účastníkem.

Implementovaná mechanika v **Hody a souboj**:

- Vlastnost: `1k10 + bonus vlastnosti + oprava`. Při uvedené nebezpečnosti uspěje výsledek větší nebo rovný. Bonusy vlastností jsou: 1 → −5; 2–3 → −4; 4–5 → −3; 6–7 → −2; 8–9 → −1; 10–12 → 0; 13–14 → +1; 15–16 → +2; 17–18 → +3; 19–20 → +4; 21 → +5.
- Útok: `1k6+ + ÚČ + oprava`; obrana: `1k6+ + OČ + oprava`. Znak `+` za kostkou znamená opakování šestky a přičtení dalšího hodu. Běžné `/hod 1k6` tuto vlastnost nemá.
- Při `útok > obrana` je návrh zranění `max(1, útok − obrana + útočnost)`. Rovnost znamená minutí. PJ může potvrdit jinou výši podle situace; teprve potvrzení odečte životy.

Útok s cílem čeká na obranu v chatu nebo mezi rozpracovanými akcemi. Skrytá příšera způsobí soukromé vyhodnocení. Rozpracované souboje přežijí ořez historie chatu. Starší akci může PJ zrušit.

V **Připravit souboj** PJ vybere účastníky a ručně určí pořadí. **Další na řadě** mění tah, po oběhu zvyšuje kolo. Pořadí není odvozené od vlastností ani od pochodového pořadí. Samo nerozestavuje hrdiny na jednotlivá bojová políčka a nevynucuje pořadí všech ostatních akcí.

## Stavy, nula životů, léčení a kouzla

**Spravovat stavy** přidává názvy, poznámky, tajnost a dobu v kolech. PJ kola odečítá ručně; nula stav sama neodstraní. Stav není automatickým postihem k hodům.

Nula životů označí dosud aktivní postavu jako čekající na rozhodnutí PJ. PJ potvrdí vyřazení, bezvědomí či smrt a může přidat poznámku viditelnou jen jemu a majiteli. Léčení samo potvrzený stav neruší; návrat do hry musí potvrdit PJ a vyžaduje alespoň jeden život. Smrt nastaví životy na nulu. Soubojové pořadí tím automaticky nemažeš.

V **Kouzla a schopnosti** majitel nebo PJ spravuje vlastní záznamy a magenergii. Použití odečte uloženou cenu, oznámení celé družině je volitelné. Účinek ani hod se neprovedou automaticky. V **Odpočinek a léčení** PJ vybere postavy, životy/magenergii, ověří náhled a potvrdí obnovu.

## Kořist, výbava a měšec

PJ nález připraví tajně, může ho propojit s poznámkou a zveřejnit. Z otevřeného nálezu hráč přebírá předměty/mince pro sebe, PJ je může přidělit hráči. Získané věci se připíšou do výbavy, mince do měšce. Rovné dělení rozděluje jednotlivé druhy mincí a zbytek ponechá v nálezu. Historie zachová, kdo co získal.

V deníku lze přidat a přejmenovat položku, změnit počet nebo použít kusy. Počet nula při editaci položku odstraní. Platba/příjem eviduje konkrétní mince a důvod, neprovádí automatickou směnu měn. Použití lektvaru samo neléčí. Přímé předávání výbavy mezi hráči zatím není samostatná funkce; domluvte se s PJ a upravte evidenci.

## Čas, světlo, hlas a uložení

PJ v **Čas a světlo** posouvá čas a spravuje zdroje světla. Ubývá pouze doba rozsvícených zdrojů; vyhořelé zhasnou. Poslední posun lze vrátit, pokud se mezitím nezměnila evidence světel. Pohyb po mapě, kolo souboje ani léčení čas automaticky neposouvají. Světlo automaticky nepřepočítá dohled.

[Hlas družiny](VOICE.md) je volitelná služba správce instalace. Začíná s vypnutým mikrofonem, umožní ztlumit poslech a vybrat mikrofon. Chatové šeptání nepřepíná hlas do soukromého hovoru. Kamera ani sdílení obrazovky se nepoužívají.

Běžné změny se ukládají na server. PJ navíc přes nabídku přístupu stáhne **úplnou zálohu kampaně**. Obnova vytvoří novou místnost, převezmeš PJ a hráčům vydáš nové klíče. Obnova nevrací původní přístupové tokeny. JSON je soukromý i bez tokenů, obsahuje tajnou přípravu a chat. Snapshot celé instalace je jiný druh zálohy; viz [hosting](SELF_HOSTING.md#data-a-zálohy).

## Co aplikace nevyhodnotí sama

[Audit herního základu](MECHANICS.md) shrnuje zejména bojové rozestavení, předávání výbavy, světlo/dohled, zámky a návaznost stavů či spotřebních předmětů. Pro současnou hru rozhoduje o těchto situacích PJ.
