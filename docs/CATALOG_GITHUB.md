# Distribuce katalogů přes GitHub

[Správa knihovny](CATALOG_LIBRARY.md) · [Publikování katalogu](CATALOG_AUTHOR.md) · [Technické vyhodnocení](CATALOG_REPORT.md)

GitHub je volitelný zdroj dat pro správce instalace Node/Docker. Herní server běžně používá vlastní SQLite a persistentní přílohy. Výpadek GitHubu neomezuje hraní, přípravu dobrodružství, místní editaci, ZIP import/export ani zálohování.

## Instalace a aktualizace

1. V existující administraci `/admin` otevři **Katalogy → Přidat katalog z GitHubu**.
2. Zadej veřejný repozitář `https://github.com/autor/repozitar`. Volitelná revize nebo tag se přeloží na konkrétní commit; prázdná hodnota znamená `HEAD`.
3. Prohlédni náhled: autora, licenci, verzi, commit, kontrolní otisk, položky a závislosti. Chybějící závislosti nejdříve samostatně nainstaluj. Katalog zatím není součástí knihovny.
4. Stiskni **Potvrdit instalaci**. Teprve tento krok uloží validovanou místní kopii.

U instalovaného zdroje použij **Zkontrolovat aktualizace**. Kontrola sama nic neinstaluje. Shodný datový otisk znamená **aktuální obsah**, i když autor vytvořil další commit bez změny katalogových dat. Tento stav nevytváří návrh k instalaci ani bod návratu; nainstalovaný commit zůstává původní.

Při změně se zobrazí současná a dostupná verze, současný a dostupný commit/otisk, konkrétní přidané, upravené a odstraněné položky, nové nebo změněné požadavky na závislosti a počet kampaní se zachovanými podklady. Změna obrázku nebo metadat může změnit otisk i při nulovém počtu změněných JSON položek. Stejné číslo verze není důkaz shodného obsahu.

**Aktualizovat katalog** potvrzuje konkrétní připravený balíček. **Zahodit návrh** jej odmítne. Náhled platí pět minut; restart služby jej zruší. Aktualizace znovu ověří revizi katalogu a závislosti před potvrzením transakce. Novější lokální úprava ani závislost vzniklá po náhledu se nesmějí potichu přepsat.

Přehled zobrazuje zdroj, datum poslední změny obsahu a poslední úspěšné kontroly. Detail obsahuje také datum první instalace a přesný nainstalovaný commit. U starších instalovaných katalogů nová migrace doplní datum změny datem původní instalace; přesný dřívější čas aktualizace zpětně neznáme.

V detailu jsou potvrzované **body návratu**. Návrat ověřuje současné závislosti, zachovává připnuté podklady kampaní a nevyžaduje GitHub. Odebrání či zakázání katalogu také vyžaduje potvrzení. Závislý katalog nebo neúplné podklady kampaně mohou akci zablokovat.

## Demonstrační důl

Pro samostatný katalog **Opuštěný trpasličí důl 1.0.0** zadej repozitář `https://github.com/cert4u/u-jednoho-stolu` a revizi `catalog-dwarf-mine-v1.0.0`. Datový tag obsahuje pouze balíček s manifestem v kořeni. Větev `main` tohoto repozitáře je aplikace a jako katalog se neinstaluje. Katalog vyžaduje aplikaci 1.2.0 nebo novější.

## Jeden importér a lokální úložiště

`server/catalog-github.mjs` zajišťuje pouze distribuci: přeložení revize, omezené stažení a předání bajtů do `prepareCatalogImport`. Veškerá kontrola ZIP, manifestu, obrázků, schémat a odkazů je společná s místním importem v `catalog-pack.mjs`, `catalog-zip.mjs` a `lib/catalogs`. Potvrzení, historie i návrat používají stávající `catalog-store.mjs`.

Kopie komunitního originálu je pouze pro čtení. Vlastní variantu položky vytvoř přes **Vlastní kopie** do vlastního katalogu. Import ani aktualizace nikdy nenahrazují vlastní katalog stejným ID. Ochranu rozehraných kampaní popisuje [provozní návod](CATALOG_LIBRARY.md#použití-ve-hře-a-stabilita-kampaní).

## Bezpečnostní omezení

- Pouze veřejné repozitáře `github.com`, bez přístupových údajů, parametrů a dalších cest. Není podporovaný OAuth ani soukromý GitHub.
- Server používá pouze pevné cesty pro commit na `api.github.com` a ZIP konkrétního 40znakového commitu na `codeload.github.com`. Doporučený seznam má vlastní pevnou cestu v repozitáři projektu. Libovolná URL a přesměrování se odmítají.
- Každý požadavek má limit 18 sekund; metadata commitu nejvýše 2 MB, archiv 40 MB. Kontrolují se také skutečně přečtené bajty, přerušený stream a další [limity importéru](CATALOG_LIBRARY.md#limity-a-bezpečnost).
- ZIP se nikdy nespouští ani nerozbaluje do pracovního adresáře. Platí stejné ochrany cest, komprese, CRC, SVG a WebP jako při ručním importu.
- Operace vyžadují existující administrační relaci, správný původ a dostupnost zápisu mimo údržbu. Herní token PJ ani hráče nestačí.

Pokud GitHub vrátí chybu, neexistující revizi, neplatná metadata nebo přeruší stahování, platná místní knihovna zůstává zachovaná. Neprobíhá pravidelné síťové dotazování ani automatická instalace aktualizací. GitHub může u anonymních požadavků uplatnit vlastní omezení četnosti.

## Ověření

`scripts/test-catalog-github.mjs` používá řízené odpovědi místo skutečného GitHubu. Pokrývá instalaci konkrétního commitu, opakovanou instalaci, shodný obsah v jiném commitu, aktualizaci při stejném čísle verze, seznam změn/závislostí, chybějící manifest, neplatný obsah, neexistující repozitář/revizi, přerušený stream, limit, přesměrování, chybnou cestu, návrat i zachování místních kopií a uloženého stavu kampaně. Místní čtení a exporty se navíc ověřují s nedostupným síťovým transportem.

`scripts/test-catalog-admin.mjs` ověřuje odmítnutí přístupu bez administrátorské relace a s cizím původem na skutečné Node službě. Migrační test ověřuje přechod existující SQLite s katalogy na nové pole `updated_at` bez ztráty herních dat. Souhrn dalších provedených kontrol a omezení je v [technickém vyhodnocení](CATALOG_REPORT.md).
