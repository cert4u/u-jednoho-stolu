# Změny

## Příští vydání

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
