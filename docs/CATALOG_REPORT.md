# Vyhodnocení decentralizované knihovny

[Správa instalace](CATALOG_LIBRARY.md) · [Autor katalogu](CATALOG_AUTHOR.md) · [Vývoj](DEVELOPMENT.md) · [GitHub distribuce](CATALOG_GITHUB.md) · [Integrační audit](CATALOG_AUDIT.md)

Tento přehled popisuje implementaci ve vývojové větvi po vydání 1.1.0. Nejde o oznámení již vydané verze.

## Architektura a kompatibilita

`lib/catalogs` obsahuje společná schémata, vestavěný adaptér a resolver. Výchozí JSON soubory zůstávají součástí sestavení; jejich kontrolní otisk generuje stávající synchronizační skript. Resolver kombinuje distribuovaný obsah, aktivní instalované katalogy a předlohy připnuté ke konkrétní kampani. Nepoužívá měnitelný globální stav jednotlivých kampaní.

Klíč tvoří typ a odkaz `katalog:polozka`. Původní herní ID se dál překládají na `builtin`; neoznačené odkazy uvnitř přenositelné předlohy jsou naopak místní. Zobrazovaný název lze měnit bez změny identity. Kolize uvnitř katalogu se odmítají, stejné lokální ID v různých katalozích je přípustné. Cizí odkazy vyžadují deklarovanou dostupnou závislost.

Node adaptér používá existující SQLite a novou migraci `0001_catalog_library.sql`. Navazující migrace `0002_catalog_updated_at.sql` odděluje čas změny obsahu od času síťové kontroly, původní migrace se nemění. Tabulka `catalogs` uchovává validovaný datový balíček a metadata, `catalog_versions` předchozí stavy a `catalog_assets` metadata neměnných souborů. Obrázky leží v persistentním datovém adresáři podle SHA-256, nikoli ve zdrojových souborech. Identitu obsahu neurčuje jen číslo verze; instalace si uchovává i otisk a případně konkrétní GitHub commit.

Administrační Node moduly jsou oddělené od sdíleného runtime. Cloudflare dál sestaví a obslouží vestavěný obsah i podklady obsažené v přenesené kampani. Dynamická serverová knihovna na Cloudflare v této etapě podporovaná není.

## Aktualizace a rozehrané kampaně

ZIP a veřejný GitHub používají stejný formát. Příprava instalace ověří celý balíček a zobrazí rozdíl; potvrzení kontroluje aktuální revizi i závislosti znovu. Metadata a obsah katalogu se mění transakčně. Uložené obrázky jsou neměnné; neúspěšný import může zanechat nepoužitý soubor, nikoli částečně instalovaný katalog. Historie zachovává deset předchozích stavů pro návrat. Shodný otisk nevytváří návrh nové instalace ani bod návratu; změněný balíček ukazuje konkrétní položky, nové nebo změněné závislosti a oba commity/otisky.

Kampaň při prvním použití zachová verzi potřebné předlohy, navazující předlohy a potřebné obrazové podklady. Existující příšery mají vlastní bojové údaje. Další použití stejné předlohy ve stejné kampani vychází z připnuté verze, nová kampaň z aktuální knihovny. Odebrání knihovny kontroluje závislosti a úplnost zachovaných kopií. Aktualizace sama nepřepisuje vlastní katalog ani rozehranou mapu.

Kampaň JSON přenáší použité podklady; úplná serverová záloha ZIP obsahuje konzistentní SQLite snapshot a katalogové obrázky. Samotný starší SQLite download zůstává kompatibilní, ale není úplnou obrazovou zálohou. Obnova celé instalace je ruční při zastavené službě, podle provozního návodu.

## Ochrana vstupů a soukromí

Katalog je datový balíček bez spustitelného kódu. ZIP se nerozbaluje na disk: kontrolují se cesty, duplicity, typy souborů, CRC, komprese a limity. Obrázky procházejí kontrolou statické WebP struktury, velikosti a rozměrů. Stafáž používá stávající omezené SVG příkazy, žádné HTML či skripty. GitHub stahování používá pevné veřejné HTTPS endpointy bez přesměrování a tokenu, s limitem času a odpovědi.

Správa využívá stávající administrační relaci a kontrolu původu; herní role PJ ji neopravňuje. Herní odpověď hráče neobsahuje soukromou knihovnu, připnuté předlohy ani poznámky PJ. Přenáší jen potřebné bezpečné vizuální definice známé mapy. Obrázky podle otisku jsou veřejné datové přílohy, ne úložiště tajných informací.

## Skutečně provedené ověření

| Příkaz / kontrola | Rozsah |
| --- | --- |
| `npm run verify` | Dokumentace, obsah, TypeScript, základní a regresní testy včetně katalogového resolveru. |
| `npm run build:node` | Produkční Node sestavení a samostatné validační jádro administrace. |
| `npm run build` | Cloudflare sestavení bez zavlečení Node filesystemu do sdílených modulů. |
| `npm run test:ci` | Kompletní herní integrační sada nad izolovanou Cloudflare/D1 testovací databází. |
| `npm run test:hosting` | Node herní a administrační integrace, ochrany relace/původu, údržba, snapshoty, restart a katalogová sada. |
| `npm run test:catalogs` | Migrace původní databáze, ZIP, lokální CRUD, export/import, GitHub aktualizace a skutečné Node API. |
| `npm run test:updater` | Simulované aktualizace, chyby sestavení a zdraví, rollback, přerušené úlohy, retence a obnova SQLite. |
| `npm run check:client-content` | Kontrola, že sestavený klient neobsahuje soukromé texty předloh PJ. |
| Ruční prohlídka `/admin` | Vytvoření katalogu a příšery, odmítnutí neplatného prostředí, oprava, uložení a čitelnost přehledu. |

Katalogové testy používají skutečné dočasné soubory, SQLite a restart Node služby. GitHub odpovědi jsou záměrně simulované: ověřují neměnnou revizi, odlišný otisk při stejné verzi, výpadek, přerušený stream, neexistující manifest, chybnou distribuční cestu, shodný obsah bez nové instalace, přesměrování, velikostní limit i změnu závislosti mezi náhledem a potvrzením. Nebyl proveden živý download cizího repozitáře ani skutečná výměna Docker kontejneru. Test updateru tyto operace simuluje.

Herní scénáře ověřují stejné lokální ID dvou katalogů, vlastní příšeru, předlohu, dobrodružství, stafáž a materiál; ochranu soukromí hráče; zachování statistik a ilustrace po změně katalogu; novou kampaň s aktuální verzí; bezpečné odebrání; obnovu kampaně bez původního katalogu; odmítnutí pozměněného obrázku; úplný serverový ZIP s přílohami.

## Zbývající omezení

- Dynamická knihovna vyžaduje Node/Docker. Budoucí Cloudflare adaptér potřebuje vlastní skutečné persistentní úložiště.
- Editor složitějších položek je validovaný JSON s náhledem, nikoli samostatný grafický editor každého typu obsahu.
- Podporované jsou veřejné GitHub repozitáře, stabilní číselné verze a omezený ZIP32/WebP formát. Instalace ani závislosti se nestahují automaticky.
- Podklady mají úmyslné kapacitní limity, popsané v provozním návodu. Starší neměnné obrázky se automaticky nemažou; případný budoucí úklid musí respektovat historii a zálohy.
- Již ztracenou historickou ilustraci staré kampaně nelze zpětně rekonstruovat. Nové použití zachovává potřebné podklady od této implementace.
- Návrat aplikace na starší verzi, která nové pole zálohy nezná, není cestou pro obnovu nové kampaně. Před upgradem zůstává nutná úplná záloha instalace.
