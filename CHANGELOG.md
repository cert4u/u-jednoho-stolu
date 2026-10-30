# Změny

## Příští vydání

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
