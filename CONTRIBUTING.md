# Přispívání

Cílem U jednoho stolu je malý a přehledný nástroj pro vlastní partu. Nová funkce má usnadnit konkrétní situaci při hraní a zachovat jednoduchost. Vítáme také opravy návodů, přístupnosti a chybových zpráv.

[Dokumentace](docs/README.md) · [Vývoj a testy](docs/DEVELOPMENT.md) · [Plán](docs/ROADMAP.md) · [Bezpečnost](SECURITY.md)

## Hlášení chyby a návrh funkce

Nejprve se podívej do existujících issues a [řešení problémů](docs/TROUBLESHOOTING.md). Popiš konkrétní herní situaci, roli, verzi/commit, způsob spuštění, očekávaný výsledek a opakovatelné kroky. Použij smyšlenou kampaň. Nepřikládej skutečné herní zálohy, tokeny, obnovovací klíče nebo tajné poznámky PJ.

U větší funkce nejdřív otevři issue a domluv rozsah. Rozliš funkci, která usnadní hraní, od automatizace celých pravidel. Kamera, pravidlový bestiář nebo hlasové šeptání nejsou hotové schopnosti jen proto, že je podporuje některá použitá knihovna.

## Změna kódu

1. Forkni repozitář a pracuj ve vlastní větvi; běžným přispěvatelům nepředpokládáme přímý zápis do `main`.
2. Postupuj podle [DEVELOPMENT.md](docs/DEVELOPMENT.md). Vyber Node/SQLite nebo lokální Cloudflare variantu a nemíchej jejich buildy a databáze.
3. Rozhraní a srozumitelné chybové zprávy zachovej česky. Dlouhé názvy a mobilní obrazovka musí být použitelné.
4. Oprávnění a skrytá data kontroluj na serveru. Ověř majitele, PJ, jiného hráče, archivovanou postavu a případné veřejné/soukromé varianty. Rozhraní nesmí pouze CSS skrýt tajný údaj, který už server poslal.
5. U akcí měnících zdroje nebo sdílený stav ošetři souběh, opakování žádosti a starý formulář. Klientské výpočty nejsou autoritativním stavem.
6. Nová databázová změna patří do nové migrace. Zachovej kompatibilitu starších podporovaných dat nebo popiš nutný postup; neměň již aplikované SQL.
7. Oprav odpovídající příručku, konfiguraci příkladu a položku **Příští vydání** v `CHANGELOG.md`. Verzi/tag neměň bez dohody o vydání.

## Ověření před pull requestem

```bash
npm run check:docs
npm run check
npm test
```

U změny chování doplň smysluplný regresní/integranční test. Pro Node spusť `npm run build:node` a `npm run test:hosting`; pro zásah do sdíleného runtime ověř i Cloudflare build a `test:ci` podle vývojového návodu. Pro změnu updateru patří `npm run test:updater` a skutečný Docker test v CI. U samotné dokumentace není nutné opakovat herní integrační sady, pokud jsi neměnil jejich postupy či kód; ověř příkazy a odkazy přiměřeně změně.

Do PR napiš problém, výsledné chování a přesně to, co jsi ověřil. U UI přidej anonymizovaný snímek a ověření hráčského/PJ pohledu i mobilu. Uveď, co jsi nemohl vyzkoušet, například Docker nebo veřejný TURN. Netvrď, že simulovaný test prokázal chování fyzických zařízení.

## Dokumentace a komunikace

Piš konkrétně, s přesnými názvy tlačítek a funkčními relativními odkazy. Použij [rozcestník](docs/README.md), aby nová příručka byla dohledatelná. `npm run check:docs` kontroluje místní odkazy, fragmenty a názvy uvedených npm skriptů, ne dostupnost externích služeb nebo správnost každého příkazu v cizím prostředí.

Drž diskusi věcnou a respektující. Sděl kontext a důvod návrhu, reaguj na připomínky a rozděl nesouvisející změny do samostatných PR.

## Licence a obsah

Příspěvky se poskytují pod stejnou [licencí MIT](LICENSE) jako projekt. Zachovej licence a autorství převzatých součástí; viz [oznámení](THIRD_PARTY_NOTICES.md). Nevkládej texty cizích pravidel, ilustrace ani bestiáře bez odpovídajícího oprávnění. Testovací příklady musí být smyšlené a nesmějí obsahovat skutečné přístupy.
