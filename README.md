# U jednoho stolu

Jednoduchý český online herní stůl pro vlastní partu a společné fantasy dobrodružství. Čtverečkovaný papír, deníky, kostky a místo pro Pána jeskyně. **V jednoduchosti je síla.**

[Licence MIT](LICENSE) · [Vývoj a architektura](docs/DEVELOPMENT.md) · [Plán další práce](docs/ROADMAP.md) · [Přispívání](CONTRIBUTING.md)

## Co už umí

- Herní místnosti, společný chat, šeptání a hody generované na serveru.
- Deníky s pěti vlastnostmi, bojovými hodnotami, výbavou a zkušenostmi přidělovanými PJ.
- Kreslení místností, chodeb, příček, dveří a schodišť na čtverečkovaném papíru. Překrývající se místnosti se spojí.
- Patra, propojení schodišti, posouvání a přibližování mapy.
- Společný pohyb družiny, vedoucí a pochodové pořadí. Dohled respektuje zdi a zavřené dveře; navštívená místa zůstávají v šedé paměti.
- Příšery připravované PJ: číslované značky, skryté údaje, životy a vratná archivace.
- Hody na vlastnosti, útok a navazující obrana. Návrh zranění potvrzuje PJ. Rozpracované akce zůstávají dostupné i po ořezu chatu.
- Osobní obnovovací klíče pro hráče i PJ, archivace postav a úplná záloha kampaně s obnovou do nové místnosti.
- Ochrana rozepsaných formulářů a souběžných změn: uložení poznámky nevrátí mezitím odečtené životy.

Jde o ranou verzi pro menší důvěryhodnou partu. Hlasový hovor si pusťte zvlášť.

## Rychlé lokální spuštění

Pro trvalý provoz na vlastním serveru použij [Docker Compose a správu aktualizací](docs/SELF_HOSTING.md). Následující postup je vývojové prostředí s emulací Cloudflare.

Potřebuješ Git, npm a **Node.js 22.15 nebo novější**. Současný server používá Cloudflare Workers a D1; místní prostředí emuluje Wrangler, účet Cloudflare není pro lokální hraní potřeba.

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

Testy vytvářejí vlastní testovací místnosti. Míří na lokální testovací instanci; nepouštěj je proti své rozehrané produkční kampani. `npm run test:ci` spustí a po testech ukončí vlastní místní server. Předem vyžaduje sestavení a `npm run db:init`. Stejný postup provádí GitHub Actions.

## Současná omezení

- Mapa jednoho patra má 28 × 20 polí; okolní papír je prostor pro posouvání pohledu.
- Nejvýše 8 pater, 12 aktivních účastníků, 200 postav a 200 příšer včetně archivovaných.
- Chat uchovává posledních 500 zpráv. Soubojové akce se ukládají samostatně.
- Synchronizace probíhá přibližně každé dvě sekundy.
- Bojové hodnoty se zapisují ručně. Iniciativa, automatické schopnosti povolání a individuální světelné zdroje zatím nejsou implementované.
- Úplná záloha verze 1 dovoluje nejvýše 3 MB serializovaných dat. Starý částečný zápis chatu nenahrazuje plnou zálohu.
- Obnovovací klíč je přístup k postavě. Nepřidávej klíče, herní zálohy ani databáze do repozitáře či veřejného issue.

## Vlastní hosting

Tento repozitář lze sestavit a testovat samostatně. Současná infrastruktura používá Workers/D1; přechod na vlastní hosting je další plánovaná etapa. Není zde hotový Docker/VPS deployment ani automatické nasazování na cizí účet. [Vývojová dokumentace](docs/DEVELOPMENT.md) popisuje dnešní vazby na prostředí.

## Licence a původ

Vlastní kód a dokumentace projektu jsou pod [licencí MIT](LICENSE). Převzaté součásti si zachovávají své původní licence a oznámení, viz [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Projekt vznikl jako neoficiální pomůcka inspirovaná původním českým hraním DrD. Nejde o produkt ani schválenou aplikaci nakladatelství ALTAR. Repozitář neobsahuje text pravidlových příruček, bestiář ani převzaté ilustrace. Licence k aplikaci neuděluje práva k cizím značkám nebo pravidlovým textům.

Základ hodů vychází z veřejných [zjednodušených pravidel ALTAR](https://www.tpro.cz/ppk/DrD_Lite-PH.pdf), která jsou odvozena od verze 1.6. Úplnou shodu se všemi pravidly 1.5 ani 1.6 aplikace neslibuje; výjimky a situace vyhodnocuje PJ.

## Vlastní hosting a aktualizace

Pro vlastní server je připravený Docker Compose s SQLite a samostatnou správou na `/admin`. Správce může nainstalovat poslední stabilní GitHub Release; před výměnou vznikne záloha databáze a při chybném startu proběhne pokus o návrat. Podrobné spuštění, obnova a údržba jsou v [návodu pro Docker](docs/SELF_HOSTING.md).
