# Příprava vydání

[Dokumentace](README.md) · [Vývoj](DEVELOPMENT.md) · [CHANGELOG](../CHANGELOG.md)

Tento postup je pro správce projektu. Repozitář má CI, ale nemá automatický release workflow. Publikace stabilního vydání je ruční krok.

## Větev, verze a instalace

- `main` obsahuje průběžný vývoj. Dokumentace této větve může popisovat více funkcí než poslední stabilní vydání.
- `package.json` obsahuje verzi sestavení; samotná změna souboru ani push nevytvoří GitHub Release.
- Výchozí kanál Stable vybírá poslední **stabilní GitHub Release** s tagem `vX.Y.Z`. Další kanály a pravidla pro potvrzení commitu popisuje [provozní návod](SELF_HOSTING.md#aktualizace-z-administrace).
- Runtime `/healthz` vrací `version`, `revision` a `builtAt`. Sleduj i commit, zejména u vývojové instalace se stejným číslem verze.

Pokud má provozovatel novější vývojový commit než zveřejněný release, automatická aktualizace není bezpečnou zkratkou k „nejnovějším funkcím“. Vždy zkontroluj nabízený release a jeho změny.

## Stabilní řada 1.x

První vydání této řady je `v1.0.0`. Obsahuje kreslené mapy, sjednocený generátor a soukromou příběhovou osnovu. Původně plánovaný kandidát `0.9.0-alpha.1` nebyl publikovaný; výsledkem je stabilní 1.0.0. Další opravy mají nové patch číslo, rozšíření nové minor číslo. Již publikovaný tag se nemění.

Verze `v1.1.0` přidává ruční stafáž, komunitní katalog, náhodný návrh podlahových značek a organické plochy. Přechod z 1.0.0 nevyžaduje novou infrastrukturu; zálohy formátu 1 rozšiřují volitelná pole mapy.

Verze `v1.2.0` přidává dynamickou knihovnu katalogů na Node/Docker, potvrzené ZIP/GitHub instalace a přenosné podklady kampaní. Při přechodu proběhnou dvě SQL migrace a v datovém volume přibude adresář obrázků; [postup](SELF_HOSTING.md#přechod-z-110-na-120).

Verze `v1.2.1` opravuje administrační dialogy a zpřehledňuje práci s katalogy. Interní servis je rozdělený za stejným veřejným rozhraním; přechod z 1.2.0 nevyžaduje migraci ani změnu infrastruktury. [Postup](SELF_HOSTING.md#přechod-z-120-na-121).

Před každým vydáním ověř katalogy, generování a založení dobrodružství s PJ i hráčem, export a obnovu existující kampaně a průchod CI přesného commitu. Při zkušebním hraní projdi přechod mezi patry a odhalení připravené Situace. Poznatky zapisuj do issues s označením testované verze. Pokud další vývoj potřebuje předběžné vydání, použij nový prerelease tag; kanál Stable jej nenabídne.

## Kontrolní postup před vydáním

1. Vyber a zkontroluj finální commit, změny dokumentace a související issues. Projdi [limity](LIMITS.md) a odliš, co je implementované, pouze lokálně ověřené a stále plánované.
2. Aktualizuj verzi v `package.json` i odpovídající metadata `package-lock.json`. Přesuň relevantní položky z **Příští vydání** do nové sekce `CHANGELOG.md`.
3. Projdi změny migrací, backup formátu a požadavků na konfiguraci. Změny aplikovaných migrací nejsou přípustné. Pokud nový kód mění provozní postup, Compose, updater nebo externí službu, napiš ruční kroky do release notes.
4. Spusť kontroly podle [vývojového návodu](DEVELOPMENT.md#ověření-a-ci). CI musí projít na vydávaném commitu včetně Docker výměny a obnovy dat. Samotný úspěšný build není upgrade test.
5. Ověř čistou instalaci i existující testovací kampaň po upgradu, přihlášení hráče/PJ, zálohu JSON, konzistentní SQLite snapshot a návrat předchozí verze. U UI zkontroluj oba role pohledy a mobil. U hlasu proveď zkoušku se skutečnými mikrofony a sítěmi.
6. Zkontroluj licence nových závislostí a oznámení. Do archivu/repozitáře nepatří testovací přístupy ani skutečné kampaně.

Před prvním vydáním dynamické knihovny projdi [integrační audit katalogů](CATALOG_AUDIT.md). Vedle úspěšné Node sady musí na přesném vydávaném commitu projít také Docker CI; lokální prostředí auditu Docker nemělo. Ověř první instalaci demonstračního katalogu přes skutečný veřejný GitHub zdroj po jeho samostatném schváleném zveřejnění. Automatické síťové testy používají řízené odpovědi. Skutečné zveřejnění a instalační zkoušku zaznamenej samostatně v release notes; nepřepisuj tím historické výsledky lokálního auditu. Při určení nové verze slaď také `minAppVersion` veřejně vydávaných katalogů s prvním vydáním podporujícím knihovnu.

## Publikace

Po schválení vytvoř neměnný tag `vX.Y.Z` na přesném ověřeném commitu a k němu GitHub Release. Prerelease slouží pro zkoušení, updater ho nenabízí jako stabilní vydání. Již vydaný tag nepřesouvej na jiný kód; opravné změny vydávej pod novou verzí.

Release notes mají obsahovat:

- Konkrétní nové chování a opravy z pohledu hráčů/PJ.
- Požadavky a kroky pro správce, nové proměnné a služby, kompatibilitu exportů/migrací.
- Co aktualizátor provede a co je ruční: checkout, updater a LiveKit se automaticky nemění s app kontejnerem.
- Skutečně provedené testy a známá omezení včetně dosud neověřených prostředí.
- Upozornění, že rollback vrací i databázi do doby před upgradem; novější změny zůstanou v samostatném snapshotu pro ruční obnovu.

Ověř, že Release API vrací zamýšlený stabilní tag a že testovací administrace ukazuje jeho správný commit. Neprováděj první zkoušku proti rozehrané družině. Archiv vydání obsahuje jeho vlastní dokumentaci; odkazy na vývojový README nejsou náhradou release notes.

Pro stručný přehled požadavků v administraci může správce přidat na vlastní řádek poznámek vydání značku.

```html
<!-- stul-release {"migrations":false,"updater":true,"config":true} -->
```

Hodnoty jsou příklad. Správce vyplní skutečný stav. Vynechané pole se zobrazí jako „neuvedeno“. Kompatibilitu při instalaci určuje kontrakt image v Dockerfile. Stav CI se čte ze stejného commitu přes GitHub Actions. Záznam vydání má obsahovat ruční postup, pokud je potřeba nejdřív [aktualizovat infrastrukturu](SELF_HOSTING.md#aktualizace-updateru-a-konfigurace-hostingu).

## Vydání 1.2.2

Stabilizační opravy navazující na 1.2.1 se vydávají jako 1.2.2. Nová migrace `0003_room_admission.sql` je aditivní; formát přenositelné zálohy zůstává 1. Kapacitní proměnné jsou volitelné, jejich vlastní hodnoty přes `.env` vyžadují odpovídající Compose konfiguraci a znovuvytvoření kontejneru. Updater se nemusí přestavovat. Release marker proto uvádí `migrations: true`, `updater: false`, `config: true`; poznámky musí vysvětlit, že konfigurace je volitelná.

Před tagováním musí projít úplné CI přesného vydávaného commitu, včetně obou Docker scénářů. Poznámky vydání odkazují na tento běh, uvádějí známou lint baseline a odlišují ověřený lokální Cloudflare runtime od veřejného deploymentu. [Migrační návod](SELF_HOSTING.md#přechod-z-121-na-122) · [Historický report stabilizace](FINAL_STABILIZATION.md).

## Vydání 1.2.3

Refaktor, čistý lint, odebrání prověřených nepoužívaných šablon/závislostí a maska dekorací nevyžadují proti 1.2.2 migraci, nové nastavení ani přestavbu updateru. Release marker uvádí `migrations: false`, `updater: false`, `config: false`. Ověř čistou instalaci, oba buildy, striktní lint, úplné CI přesného vydávaného commitu včetně Dockeru a skutečné překrytí při posunu/zoomu. [Rozsah úklidu](CLEANUP.md) · [Migrační návod](SELF_HOSTING.md#přechod-z-122-na-123).

Mapy v 1.2.3 lze ručně rozšířit na 56 × 40 polí. Generátor ponechává 28 × 20. Zálohy mají stále formát 1, ale starší aplikace mapu s novými souřadnicemi mimo 28 × 20 odmítne; pro návrat použij původní předaktualizační zálohu.

## Vydání 1.2.4

Refaktor aplikace a dokončení úklidu CSS nevyžadují proti 1.2.3 migraci, změnu konfigurace ani přestavbu updateru. Release marker uvádí `migrations: false`, `updater: false`, `config: false`. K běžným kontrolám patří `npm run check:css`, posun mapy a dialogů bez viditelných lišt a skrytí administračních prvků podle jejich stavu. [Postup přechodu](SELF_HOSTING.md#přechod-z-123-na-124).

## Vydání 1.2.5

Rozdělení CSS, generátoru V2, hostingu a katalogové administrace nevyžaduje proti 1.2.4 migraci, změnu konfigurace ani přestavbu updateru. Release marker uvádí `migrations: false`, `updater: false`, `config: false`. Před publikací ověř referenční výstupy generátoru, prohlížeč pro PJ i hráče, načtení modulů administrace a CI přesného commitu. [Postup přechodu](SELF_HOSTING.md#přechod-z-124-na-125).

## Vydání 1.2.6

Při vydání ověř opožděné odpovědi při přepínání pater a přístupu do kampaně, shodu mapových příkazů z myši a klávesnice a opakování úpravy mapy se stejným ID. Marker vydání má hodnoty `migrations: false`, `updater: false`, `config: false`. [Postup přechodu](SELF_HOSTING.md#přechod-z-125-na-126).

## Vydání 1.2.7

Při ověřování podrž potvrzení odeslané zprávy, napiš druhou a zkontroluj, že po potvrzení zůstala v poli. Dvě souběžné operace musí držet ovládání ve stavu načítání až do dokončení poslední. Marker vydání má hodnoty `migrations: false`, `updater: false`, `config: false`. [Postup přechodu](SELF_HOSTING.md#přechod-z-126-na-127).

## Vydání 1.2.8

Ověř skupinovou odměnu s archivovanými postavami, obnovení postavy během boje a export s opětovnou obnovou obou kampaní. Integrační sada ověřuje také přenos historických odměn. Přechod nevyžaduje SQL migraci ani novou konfiguraci nebo updater. Marker vydání má hodnoty `migrations: false`, `updater: false`, `config: false`. [Postup přechodu](SELF_HOSTING.md#přechod-z-127-na-128).
