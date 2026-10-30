# U jednoho stolu

Jednoduchý český online herní stůl pro vlastní partu a společné fantasy dobrodružství. Čtverečkovaný papír, deníky, kostky a místo pro Pána jeskyně. **V jednoduchosti je síla.**

[Licence MIT](LICENSE) · [Vlastní hosting](docs/SELF_HOSTING.md) · [Změny ve verzích](CHANGELOG.md) · [Vývoj a architektura](docs/DEVELOPMENT.md) · [Plán další práce](docs/ROADMAP.md) · [Přispívání](CONTRIBUTING.md)

## Co už umí

- Herní místnosti, společný chat, šeptání a hody generované na serveru.
- Deníky s pěti vlastnostmi, bojovými hodnotami, výbavou a zkušenostmi přidělovanými PJ.
- Kreslení místností, chodeb, příček, dveří a schodišť na čtverečkovaném papíru. Překrývající se místnosti se spojí.
- Patra, propojení schodišti, posouvání a přibližování mapy.
- Společný pohyb družiny, vedoucí a pochodové pořadí. Dohled respektuje zdi a zavřené dveře; navštívená místa zůstávají v šedé paměti.
- Příšery připravované PJ: číslované značky, skryté údaje, životy a vratná archivace.
- Poznámky PJ ukotvené v políčkách mapy: tajná příprava a zvlášť zveřejňovaný popis místa, který hráči otevřou u odhaleného políčka. PJ dostane upozornění při přiblížení družiny (výchozí dosah 2 pole, nastavitelný na 1–6 nebo vypnutelný). Upozornění funguje i přes stěny, nic neodhaluje hráčům a během pobytu v okolí se neopakuje.
- Ručně posouvaný čas průzkumu a společná světla družiny: doba svícení, zhasnutí, vyhoření a vrácení posledního posunu.
- Odpočinek a léčení řízené PJ: obnova životů a magenergie jednotlivým postavám i družině, náhled změn a soukromý záznam výsledku.
- Vlastní kouzla a schopnosti v deníku, magenergie a použití s odečtením ceny. Seznam je soukromý pro hráče a PJ; oznámení družině je volitelné.
- Stavy hrdinů a příšer s vlastními názvy, poznámkami a ručně odečítanými koly. Tajné stavy vidí jen PJ.
- Soubojové pořadí s výběrem hrdinů a příšer, ručním řazením, aktuálním tahem a počítáním kol. Řídí ho PJ; skryté příšery se hráčům neprozradí.
- Hody na vlastnosti, útok a navazující obrana. Návrh zranění potvrzuje PJ. Rozpracované akce zůstávají dostupné i po ořezu chatu.
- Zkoušky a pasti: PJ vyzve konkrétního hráče k hodu na vlastnost, může skrýt nebezpečnost i celou výzvu před ostatními. Server provede jeden hod z uloženého deníku; následky potvrdí PJ. Výzvu lze připravit z poznámky na mapě, rozpracované zkoušky nezmizí s historií chatu.
- Kořist: tajné přípravy nálezů, zveřejnění družině, převzetí předmětů a mincí do deníku, přidělení PJ a rovné rozdělení mincí se zachováním zbytku. Historie zaznamenává, kdo co získal; souběžné převzetí nemůže kořist zdvojit.
- Osobní obnovovací klíče pro hráče i PJ, archivace postav a úplná záloha kampaně s obnovou do nové místnosti.
- Ochrana rozepsaných formulářů a souběžných změn: uložení poznámky nevrátí mezitím odečtené životy.
- Vlastní hosting přes Docker Compose s SQLite a správou instalace na `/admin`: aktualizace ze stabilních vydání, záloha databáze a návrat předchozí verze.

Jde o ranou verzi pro menší důvěryhodnou partu. Hlasový hovor si pusťte zvlášť.

## Vlastní server s Dockerem

Pro vlastní server je od verze **0.2.0** připravený Docker Compose. Aplikace běží na Node.js 22 a ukládá data do SQLite v trvalém Docker volume. Cloudflare účet není potřeba.

Potřebuješ Linux s **Docker Engine 28+ a Compose v2**, Git a OpenSSL. Pro sestavení počítej přibližně se 2 GB volné RAM a několika GB místa na disku.

```bash
git clone https://github.com/cert4u/u-jednoho-stolu.git
cd u-jednoho-stolu
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

Do `.env` vlož dvě různé vygenerované hodnoty jako `STUL_ADMIN_PASSWORD` a `STUL_UPDATER_TOKEN`. Nastav `PUBLIC_ORIGIN` na adresu své instalace; pro místní vyzkoušení použij `http://localhost:8080`.

```bash
chmod 600 .env
./deploy/stul.sh up -d --build
./deploy/stul.sh logs --tail=50
```

Pro místní vyzkoušení otevři [http://localhost:8080](http://localhost:8080). Na veřejném serveru nastav HTTPS reverzní proxy před výchozí adresu `127.0.0.1:8080`.

**[Podrobný návod pro Docker, HTTPS, zálohování a obnovu](docs/SELF_HOSTING.md)** popisuje také podporované prostředí a údržbu instalace.

### Aktualizace z administrace

Na adrese **`/admin`** se přihlas heslem správce instalace. Tento přístup je oddělený od role PJ a hráčů.

- Administrace nabídne poslední stabilní GitHub Release a odkaz na poznámky k vydání.
- Po potvrzení se sestaví image z přesného commitu vydání. Během sestavování lze dál hrát.
- Před výměnou se pozastaví změny a uloží záloha celé databáze. Pokud nová verze nenastartuje, updater se pokusí obnovit původní verzi i databázi.
- Ruční návrat předchozí verze obnovuje také její databázi; novější změny se před návratem uloží do další zálohy.

Pro další spouštění používej `./deploy/stul.sh up -d` nebo `./deploy/stul.sh restart`. Wrapper zachovává aktivní image po aktualizaci. Ze starého checkoutu znovu nespouštěj `up --build`. Samotný updater a zdrojový checkout se udržují ručně podle [návodu](docs/SELF_HOSTING.md#další-spouštění-compose).

## Lokální vývoj s Cloudflare

Vývojová varianta používá Workers a D1 emulované Wranglerem. Potřebuješ Git, npm a **Node.js 22.15 nebo novější**; Cloudflare účet pro místní vývoj není nutný.

```bash
git clone https://github.com/cert4u/u-jednoho-stolu.git
cd u-jednoho-stolu
npm run install:ci
npm run build
npm run db:init
npm run dev
```

Otevři [http://127.0.0.1:5173](http://127.0.0.1:5173). Databázové migrace se aplikují pouze na místní databázi a `db:init` lze opakovat. Data se ukládají do ignorovaného adresáře `.wrangler/state`.

Sestavenou verzi lze lokálně spustit přes `npm start` na portu 8787. Pro vývoj a integrační testy používáme `npm run dev` na portu 5173.

## Jak začít hrát

1. PJ založí místnost a pošle odkaz vlastní partě. Hráči se připojí se jmény postav.
2. Přes avatar nahoře vpravo si každý uloží svůj **obnovovací klíč**. Jeho použití obnoví přístup ke stejné postavě, odpojí starý token a vydá nový klíč.
3. PJ připraví mapu, určí vedoucího, nastaví dohled a umístí družinu na podlahu.
4. Vedoucí kliknutím posouvá společnou družinu. Ctrl + levé tažení nebo nástroj Ruka posouvají papír; Ctrl + kolečko mění měřítko.
5. V deníku nebo nabídce **Hody a souboj** se hází na vlastnosti a útok. Obránce nebo PJ odpoví v chatu; zranění se odečte až po potvrzení PJ.

6. V levém panelu otevři **Připravit souboj**, vyber účastníky a uprav jejich pořadí šipkami. Po uložení PJ zahájí souboj a tlačítkem **Další na řadě** posouvá tahy a kola. Na mobilu je souboj v rozbalovacím panelu u mapy.

7. Přes ikonu štítků **Spravovat stavy** v hlavičce souboje PJ přidává, upravuje a odebírá stavy. Počet kol odečítá ručně; nula stav sama neodstraní. Stavy automaticky nemění hody ani životy.

8. V **Můj deník → Kouzla a schopnosti** nastav magenergii a přidej vlastní záznamy s cenou. **Použít** odečte cenu a zapíše použití do chatu pro hráče a PJ. Oznámení celé družině je volitelné; účinek a potřebné hody řešte zvlášť.

9. PJ v **Hody a souboj → Odpočinek a léčení** vybere postavy a určí počet obnovovaných životů či magenergie, případně doplnění do maxima. Zkontroluje náhled a potvrdí obnovu. Stavy a kola souboje se tím nemění.

10. V levém panelu otevři **Čas a světlo**; na mobilu přes **Družina, čas a patra**. PJ eviduje světla a posouvá průzkumný čas. Odpočítávají se pouze rozsvícené zdroje se zadanou dobou. Poslední posun lze vrátit, dokud světla dál neupravíš. Dohled na mapě se nastavuje samostatně.

11. Nástrojem **Poznámka** klikne PJ na podlahu mapy a připraví místo. **Uložit přípravu** zachová vše u PJ; **Uložit a sdílet popis** zveřejní nadpis a popis po odhalení políčka. Tajná příprava zůstává soukromá. Pozdější běžné úpravy nemění již sdílenou verzi. Hráči otevřou popis přes malou značku „i“ v mapě.

PJ může vydat hráči nový obnovovací klíč a archivovat nebo vrátit postavu. Úplná záloha obsahuje všechna patra a tajnou přípravu; stahuje ji jen PJ. Obnova vždy vytvoří novou místnost a nové přístupy, původní kampaň nepřepíše.

## Testování

```bash
npm run check
npm test
```

Pro všechny integrační testy spusť nejprve místní server:

```bash
npm run test:integration
# Volitelně jiná testovací instance:
npm run test:integration -- http://127.0.0.1:8787
```

Testy vytvářejí vlastní testovací místnosti. Míří na lokální testovací instanci; nepouštěj je proti své rozehrané produkční kampani. `npm run test:ci` spustí a po testech ukončí vlastní místní server. Předem vyžaduje sestavení a `npm run db:init`. GitHub Actions navíc ověřuje Node/SQLite variantu, přihlášení do administrace a skutečnou výměnu Docker kontejnerů včetně obnovy kampaně. Samostatné testy aktualizační logiky spustíš pomocí `npm run test:updater`; testy Node serveru a administrace pomocí `npm run build:node` a `npm run test:hosting`.

## Současná omezení

- Mapa jednoho patra má 28 × 20 polí; okolní papír je prostor pro posouvání pohledu.
- Nejvýše 8 pater, 12 aktivních účastníků, 200 postav a 200 příšer včetně archivovaných.
- Nejvýše 200 poznámek na mapě v celém dobrodružství; jedna poznámka na políčko a patro.
- Nejvýše 50 připravených/otevřených nálezů a 100 uzavřených, po 24 položkách a 200 záznamech převzetí. Získaná výbava má nejvýše 200 názvů na postavu.
- Nejvýše 50 rozpracovaných zkoušek a historie posledních 100 uzavřených.
- Chat uchovává posledních 500 zpráv. Soubojové akce se ukládají samostatně.
- Synchronizace probíhá přibližně každé dvě sekundy.
- Bojové hodnoty se zapisují ručně. Automatické určování iniciativy podle pravidel, vyhodnocování účinků kouzel a schopností povolání ani individuální světelné zdroje zatím nejsou implementované.
- Úplná záloha verze 1 dovoluje nejvýše 3 MB serializovaných dat. Starý částečný zápis chatu nenahrazuje plnou zálohu.
- Obnovovací klíč je přístup k postavě. Nepřidávej klíče, herní zálohy ani databáze do repozitáře či veřejného issue.

## Licence a původ

Vlastní kód a dokumentace projektu jsou pod [licencí MIT](LICENSE). Převzaté součásti si zachovávají své původní licence a oznámení, viz [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Projekt vznikl jako neoficiální pomůcka inspirovaná původním českým hraním DrD. Nejde o produkt ani schválenou aplikaci nakladatelství ALTAR. Repozitář neobsahuje text pravidlových příruček, bestiář ani převzaté ilustrace. Licence k aplikaci neuděluje práva k cizím značkám nebo pravidlovým textům.

Základ hodů vychází z veřejných [zjednodušených pravidel ALTAR](https://www.tpro.cz/ppk/DrD_Lite-PH.pdf), která jsou odvozena od verze 1.6. Úplnou shodu se všemi pravidly 1.5 ani 1.6 aplikace neslibuje; výjimky a situace vyhodnocuje PJ.
