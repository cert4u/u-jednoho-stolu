# Dokumentace U jednoho stolu

> „U jednoho stolu vzniklo pro všechny, kteří kdysi sedávali s kamarády nad čtverečkovaným papírem, házeli kostkami a společně prožívali dobrodružství. Dnes nás možná dělí stovky kilometrů, ale příběhy mohou pokračovat. Nechceme nahradit Pána jeskyně ani představivost hráčů. Chceme jim jen vrátit společný stůl.“

Dokumentace v této větvi popisuje její aktuální kód. Funkce uvedená zde nemusí být ve starším stabilním vydání. Při provozu vydané verze používej dokumentaci z jejího tagu; rozdíly popisuje [CHANGELOG](../CHANGELOG.md). Automatická aktualizace instalace vybírá stabilní GitHub Release, nikoli větev `main`.

| Pro koho | Návod |
| --- | --- |
| Zájemce o projekt | [Představení a první hra](../README.md) |
| Hráč a Pán jeskyně | [Herní příručka](PLAYING.md) |
| Výzdoba mapy | [Stafáž: paleta, úpravy a viditelnost](SCENERY.md) |
| Příprava příběhu | [Příběhová osnova a komunitní ukázka](STORY_OUTLINE.md) |
| Návrh dalších mechanik | [Audit herního základu a priority](MECHANICS.md) |
| Správce serveru | [Docker, konfigurace, zálohy a aktualizace](SELF_HOSTING.md) |
| Správce hlasového hovoru | [LiveKit: lokální a veřejné nasazení](VOICE.md) |
| Uživatel, kterému něco nefunguje | [Řešení problémů](TROUBLESHOOTING.md) |
| Vývojář | [Runtime, architektura, data a testy](DEVELOPMENT.md) |
| Autor generátoru | [Generátor V2: audit, model, invarianty a benchmark](GENERATOR_V2.md) |
| Autor vzhledu mapy | [Renderery, deterministická kresba a srovnání](MAP_APPEARANCE.md) |
| Autor integrace | [Interní HTTP API a oprávnění](API.md) |
| Správce projektu | [Audit komunitní připravenosti](COMMUNITY_AUDIT.md) |
| Přispěvatel | [Jak přispívat](../CONTRIBUTING.md) |
| Autor dobrodružství a příšer | [Přidávání herního obsahu](OBSAH.md) |
| Autor ilustrací | [Postavy a bestiář](ILUSTRACE.md) |
| Správce vydání | [Příprava a ověření vydání](RELEASING.md) |

[Omezení současné verze](LIMITS.md) · [Plán projektu](ROADMAP.md) · [Bezpečnostní hlášení](../SECURITY.md) · [Licence](../LICENSE) · [Převzaté součásti](../THIRD_PARTY_NOTICES.md)

## Rychlá orientace

- **Chci si zahrát:** potřebuji adresu běžící instalace a pozvánku nebo obnovovací klíč. Nepotřebuji Git ani vývojové nástroje.
- **Chci mít vlastní instalaci:** začnu Dockerem. Herní data jsou ve volume, nastavení v `.env`, správa instalace na `/admin`.
- **Chci vyvíjet:** začnu příkazem `npm run dev:node` podle [průvodce první změnou](DEVELOPMENT.md#první-změna-na-místním-stole). Pro původní Cloudflare variantu jsou v návodu samostatné příkazy.
- **Chci hlásit chybu:** použiji smyšlený příklad a popíšu verzi, roli a postup. Klíče, tokeny a herní zálohy nepatří do veřejného issue.

## Co dokumentace rozlišuje

PJ spravuje konkrétní dobrodružství, správce instalace provozuje celý server. Jde o různé přístupy. Kód místnosti je pozvánka k připojení, osobní obnovovací klíč je přístup ke konkrétní postavě. Export kampaně JSON vytváří při obnově novou místnost; snapshot celé SQLite databáze zachovává také původní přístupy.

Dokumentaci měníme společně s funkcemi. Při změně rozhraní, limitu nebo konfigurace oprav odpovídající návod a ověř `npm run check:docs`.

- [Místní a komunitní katalogy](CATALOG_LIBRARY.md) — administrace, aktualizace, offline provoz a zálohy.
- [Jak vytvořit a zveřejnit katalog](CATALOG_AUTHOR.md) — manifest, ZIP, závislosti a licence.
- [Technické vyhodnocení knihovny](CATALOG_REPORT.md) — architektura, provedené testy a zbývající omezení.
- [Distribuce katalogů přes GitHub](CATALOG_GITHUB.md) — instalace, potvrzené aktualizace, změny a bezpečnost stahování.
- [Integrační audit katalogů](CATALOG_AUDIT.md) — přenosný demonstrační důl, skutečná obnova, výkon a připravenost vydání.

Administrace od 1.2.1 používá vlastní stránkové dialogy, dvoupanelový detail katalogu a seznam po osmi položkách. [Návod knihovny](CATALOG_LIBRARY.md) · [Aktualizace z 1.2.0](SELF_HOSTING.md#přechod-z-120-na-121).

- [Stabilizační audit po 1.2.1](STABILIZATION_AUDIT.md) — reprodukce, obnovitelnost, synchronizace, kapacita, idempotence a skutečně provedené kontroly.

- [Finální stabilizace a připravenost vydání](FINAL_STABILIZATION.md) — identita klientských operací, React lifecycle, migrace/rollback a skutečné Docker CI.

Vydání **1.2.2** zahrnuje ochrany záloh, kapacitní limity, úsporný polling, bezpečné opakování zpráv a hodů a ochranu rozepsaných katalogových položek. Obsahuje jednu novou SQL migraci; provozní proměnné jsou volitelné. [Přechod z 1.2.1 a rollback](SELF_HOSTING.md#přechod-z-121-na-122).

Vydání **1.2.3**: [úklid nepoužívaného kódu a maska skic](CLEANUP.md), [architektura pro přispěvatele](DEVELOPMENT.md) a [přechod z 1.2.2](SELF_HOSTING.md#přechod-z-122-na-123).

Vydání **1.2.4**: [údržba stylů a kontrola v CI](DEVELOPMENT.md#postupný-úklid-css) · [přechod z 1.2.3](SELF_HOSTING.md#přechod-z-123-na-124).

Vydání **1.2.7** přináší [opravy chatu a souběžných akcí](../CHANGELOG.md#127--2026-11-09). [Přechod z 1.2.6](SELF_HOSTING.md#přechod-z-126-na-127).
