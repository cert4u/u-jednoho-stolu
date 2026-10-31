# Dokumentace U jednoho stolu

Dokumentace v této větvi popisuje její aktuální kód. Funkce uvedená zde nemusí být ve starším stabilním vydání. Při provozu vydané verze používej dokumentaci z jejího tagu; rozdíly popisuje [CHANGELOG](../CHANGELOG.md). Automatická aktualizace instalace vybírá stabilní GitHub Release, nikoli větev `main`.

| Pro koho | Návod |
| --- | --- |
| Zájemce o projekt | [Představení a první hra](../README.md) |
| Hráč a Pán jeskyně | [Herní příručka](PLAYING.md) |
| Návrh dalších mechanik | [Audit herního základu a priority](MECHANICS.md) |
| Správce serveru | [Docker, konfigurace, zálohy a aktualizace](SELF_HOSTING.md) |
| Správce hlasového hovoru | [LiveKit: lokální a veřejné nasazení](VOICE.md) |
| Uživatel, kterému něco nefunguje | [Řešení problémů](TROUBLESHOOTING.md) |
| Vývojář | [Runtime, architektura, data a testy](DEVELOPMENT.md) |
| Autor generátoru | [Generátor V2: audit, model, invarianty a benchmark](GENERATOR_V2.md) |
| Autor integrace | [Interní HTTP API a oprávnění](API.md) |
| Přispěvatel | [Jak přispívat](../CONTRIBUTING.md) |
| Správce vydání | [Příprava a ověření vydání](RELEASING.md) |

[Omezení současné verze](LIMITS.md) · [Plán projektu](ROADMAP.md) · [Bezpečnostní hlášení](../SECURITY.md) · [Licence](../LICENSE) · [Převzaté součásti](../THIRD_PARTY_NOTICES.md)

## Rychlá orientace

- **Chci si zahrát:** potřebuji adresu běžící instalace a pozvánku nebo obnovovací klíč. Nepotřebuji Git ani vývojové nástroje.
- **Chci mít vlastní instalaci:** začnu Dockerem. Herní data jsou ve volume, nastavení v `.env`, správa instalace na `/admin`.
- **Chci vyvíjet:** mohu použít Node/SQLite nebo původní lokální emulaci Cloudflare. Jejich buildy, databáze a příkazy se liší.
- **Chci hlásit chybu:** použiji smyšlený příklad a popíšu verzi, roli a postup. Klíče, tokeny a herní zálohy nepatří do veřejného issue.

## Co dokumentace rozlišuje

PJ spravuje konkrétní dobrodružství, správce instalace provozuje celý server. Jde o různé přístupy. Kód místnosti je pozvánka k připojení, osobní obnovovací klíč je přístup ke konkrétní postavě. Export kampaně JSON vytváří při obnově novou místnost; snapshot celé SQLite databáze zachovává také původní přístupy.

Dokumentaci měníme společně s funkcemi. Při změně rozhraní, limitu nebo konfigurace oprav odpovídající návod a ověř `npm run check:docs`.
