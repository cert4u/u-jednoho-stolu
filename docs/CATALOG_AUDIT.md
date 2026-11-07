# Integrační audit katalogů před prvním vydáním

[Správa knihovny](CATALOG_LIBRARY.md) · [Distribuce GitHub](CATALOG_GITHUB.md) · [Demonstrační důl](../examples/catalogs/abandoned-dwarf-mine/README.md) · [Postup vydání](RELEASING.md)

## Závěr

Node implementace prošla níže uvedenými integračními scénáři včetně skutečné obnovy do nové instalace. Prokazatelná chyba úplnosti serverových záloh byla reprodukována a opravena. Nebyla nalezena další chyba, která by v testovaných scénářích měnila rozehranou kampaň při aktualizaci nebo odebrání katalogu. To není důkaz absence všech chyb.

**Výsledek lokálního auditu před vydáním byl podmíněný:** Node a Cloudflare kontroly prošly; zbývalo Docker CI na přesném vydávaném commitu a skutečná GitHub instalace dema. Lokální prostředí nemá příkaz `docker`. Tato zpráva zachovává původní rozsah lokálních testů; následné ověření při publikaci aplikace 1.2.0 uvádějí [poznámky k vydání](https://github.com/cert4u/u-jednoho-stolu/releases/tag/v1.2.0) a připojené výsledky CI. Demo se distribuuje také datovým tagem `catalog-dwarf-mine-v1.0.0`.

## Rozsah kontroly implementace

| Oblast | Skutečně ověřený mechanismus |
| --- | --- |
| Runtime | `loadCatalogs` načítá aktivní databázové balíčky bez rebuildu; resolver kombinuje vestavěné, instalované a připnuté definice. Bestiář, příprava, start dobrodružství a běžné herní API běží přes produkční Node sestavení. |
| Migrace | Test aplikuje nové migrace na existující SQLite s kampaní a již založeným katalogem, zachovává revizi a data, ověřuje idempotentní restart. Již aplikované SQL se nemění; server kontroluje jejich otisky. |
| Obrázky a soubory | Tři skutečné statické WebP přílohy se ukládají podle otisku do datového adresáře, přežijí restart a obnovu, HTTP bajty po obnově odpovídají původnímu SHA-256. |
| Import/export | ZIP a GitHub procházejí společným importérem a Zod schématy. Export/import zachovává datový otisk, odkazy, dokumenty a obrázky; import funguje i v druhé čisté instalaci. |
| GitHub | Řízené odpovědi ověřují konkrétní commit, náhled, potvrzení, změny při stejném čísle verze, aktualizaci, návrat, chyby sítě, limity a změnu závislostí mezi náhledem a potvrzením. |
| Identita a závislosti | Jmenné prostory rozlišují stejné ID různých katalogů, stará ID nadále znamenají vestavěný obsah. Cizí předlohy vyžadují deklarované dostupné závislosti. Testy odmítají chybějící a nekompatibilní odkazy i kolize. |
| Oprávnění | Skutečná Node služba odmítá chybějící administrační cookie, herní token místo správce a cizí původ zápisu. Hráč nedostává knihovnu ani tajné poznámky PJ. |
| Kampaně | Předlohy, statistiky, SVG definice a obrázky se připínají při použití. Aktualizace i odstranění katalogu zachovávají původní herní data. Vlastní upravená kopie se neaktualizuje se zdrojem. |
| Vestavěný obsah | Původní testy obsahu, bestiáře, dobrodružství, záloh, map a generátoru běží beze změny herních mechanik a algoritmu V2. |
| Runtime varianty | Produkční Node build a jeho integrace; Cloudflare build a integrační sada nad D1. Přímý test obnovuje kampaň s vlastními obrazy a definicemi přes skutečné API obou runtime bez instalovaného zdroje a ověřuje také nové použití připnuté příšery. Dynamická administrace je nadále pouze Node/Docker, nikoli nová Cloudflare funkce. Dockerfile a persistentní volume byly zkontrolovány v kódu, kontejner lokálně neběžel. |

## Demonstrační balíček

[Adresář Opuštěného trpasličího dolu](../examples/catalogs/abandoned-dwarf-mine) lze samostatně vložit do kořene veřejného repozitáře. Má vlastní manifest a MIT licenci, tři původní příšery s jednoduchými schematickými portréty, pět značek, dvě plochy, jednu předlohu V2 a krátké dobrodružství se všemi pěti dramaturgickými fázemi. Nemá obsahové závislosti. Příšery i místa mají původní texty; nepřebírá pravidlové tabulky. Polohy stafáže připravuje PJ, formát dobrodružství je automaticky neumisťuje.

```bash
npm run catalog:demo -- /tmp/opusteny-trpaslici-dul.zip
```

Výstupní soubor musí být nový. Generátor ZIP obsah adresáře jen zabalí; nic nepublikuje. Balíček používá stávající schémata, nikoli zvláštní výjimky pro demo.

## Integrační scénáře

Nový [auditní test](../scripts/test-catalog-audit.mjs) běží nad dvěma oddělenými dočasnými instalacemi. Node server má při celém scénáři blokované `fetch` mimo loopback; případný pokus se zaznamená a test jej odmítne. Simulovaný GitHub transport je předán pouze distribuční funkci testovacího procesu. Není to nová volba produkčního serveru.

| Scénář | Výsledek |
| --- | --- |
| 1. Čistá databáze | Výchozí knihovna bez databázového importu vestavěných položek, instalace dolu z přesného simulovaného commitu. |
| 2. Příprava dobrodružství | Nová kampaň ze samostatné předlohy, šest místností a příprava všech pěti fází. |
| 3. Příšery a stafáž | Tři příšery s portréty, všech pět značek a oba materiály vložené přes herní API, sedm použitých vizuálních definic v odpovědi PJ. |
| 4. Offline provoz | Herní i administrační operace proběhnou bez jediného pokusu o externí `fetch`. |
| 5. Export/import | Shodný datový otisk po exportu, import do druhé čisté SQLite a start téhož dobrodružství včetně portrétů. |
| 6. Aktualizace | Změněný komunitní balíček se instaluje až po potvrzení, zdrojový commit se uchová. |
| 7. Vlastní kopie | Zkopírovaný strážce s ručně změněnými životy zůstává po aktualizaci zdroje stejný. |
| 8. Odebraná používaná položka | Nová verze odstraní strážce i jeho zdrojový obrázek a změní kresbu navijáku. Celý uložený stav kampaně a její připnuté definice zůstanou beze změny. |
| 9. Odebrání katalogu | Existující kampaň dál používá své podklady a umí z připnuté předlohy přidat další instanci; jiná kampaň bez podkladů odstraněnou předlohu použít nemůže. |
| 10. Úplná obnova | Služba se zastaví, SQLite a obrazy z plného serverového ZIP se přenesou do jiného adresáře. Nově spuštěná instalace zachová knihovnu, historii/zdroj, vlastní kopii, původní kampaň a obrazové otisky. Po obnově projde také offline návrat původní verze katalogu včetně jejích obrázků. Nejde jen o kontrolu obsahu ZIP. |

Stávající sady dále skutečně spouštějí CRC a deflate kontroly, poškozené archivy, traversal, symlink, duplicitní cesty, omezení počtu a velikosti souborů, nadměrnou dekompresi, neplatné JSON/manifesty, nepovolený JavaScript a SVG soubor, SVG skript v cestě, nebezpečnou barvu, falešný/animovaný WebP a nadměrné rozměry, neplatné odkazy a neúspěšný import bez viditelného částečného katalogu. Omezení jsou v [provozním návodu](CATALOG_LIBRARY.md#limity-a-bezpečnost).

## Nalezená a opravená chyba

**CAT-AUDIT-01 — neúplná záloha označená jako úplná.** Po odstranění `<snapshot>.sqlite.assets.zip` vracel endpoint plné zálohy úspěšný ZIP jen s databází. Nový regresní test před opravou selhal na `200 !== 503`. Taková záloha by při obnově nemusela obsahovat ilustrace instalovaných katalogů a jejich historie.

Oprava v [server/snapshots.mjs](../server/snapshots.mjs) zjistí požadované přílohy z databáze konkrétního snapshotu, včetně historie, a ověří jejich existenci, délku a SHA-256. Provádí se při tvorbě snapshotu i před exportem plného ZIP. Chybějící živý obrázek tedy také zablokuje vytvoření vadného nového snapshotu. Potřebné jsou skutečně používané soubory, ne nevyužité rezervace v tabulce příloh.

Regrese ověřuje chybějící sidecar, sidecar bez jedné přílohy, pozměněné bajty s jinak platným ZIP/CRC a ztrátu potřebného živého souboru. Zároveň ověřuje, že úplný starší snapshot lze stáhnout i při chybě v současném živém adresáři a že snapshot prázdné knihovny nepotřebuje obrázkový sidecar. Starší přímý SQLite download zůstává zachovaný.

## Výkon

Měření: 2026-11-07T15:04:23.142Z, v22.23.2, AMD Ryzen 7 7700X 8-Core Processor. Produkční Node server na localhost, sériové požadavky, tři zahřívací a dvanáct měřených vzorků pro každou operaci. Čas zahrnuje HTTP a načtení/dekódování JSON odpovědi; nejde o měření vykreslení v prohlížeči. Sloupec přípravy načítá stafáž i předlohy, protože používají jeden endpoint.

Porovnání: pouze výchozí katalog oproti výchozímu plus třem instalovaným katalogům — demo (3 příšery, 7 značek/ploch) a dvě syntetické knihovny (každá 50 příšer a 50 značek/ploch). Celkem tedy 103 dalších příšer, 107 vizuálních definic, tři předlohy a tři dobrodružství. Obrázky jsou malé a sdílené bajty deduplikované. V obou konfiguracích se startuje stejné vestavěné dobrodružství a pro poslední řádek stejná kampaň s 12 koboldy.

| Operace | Jen výchozí: p50 / p95 (ms) | +3 katalogy: p50 / p95 (ms) |
| --- | ---: | ---: |
| Bestiář PJ | 3.167 / 3.235 | 5.504 / 6.637 |
| Stafáž a předlohy (příprava) | 3.246 / 3.949 | 4.875 / 5.568 |
| Nová prázdná kampaň | 2.989 / 3.308 | 2.868 / 3.586 |
| Zahájení stejného vestavěného dobrodružství | 15.719 / 17.531 | 16.610 / 18.040 |
| Běžné API prázdné kampaně | 2.672 / 2.912 | 2.478 / 2.870 |
| API stejné kampaně s 12 příšerami | 8.955 / 9.677 | 8.801 / 10.141 |

Start demonstračního dobrodružství v rozšířené knihovně: p50 **15.334 ms**, p95 **17.967 ms**. [Syrové výsledky včetně jednotlivých vzorků a velikostí odpovědí](performance/catalog-audit.json).

V tomto měření je dodatečná práce patrná hlavně při načítání knihovny a přípravě dobrodružství; běžné API nedostává kompletní instalovanou knihovnu a jeho časy zůstávají podobné. Nebyl prokázán problém vyžadující cache nebo změnu architektury, proto audit nepřidává optimalizace. Nižší časy některých operací nejsou důkazem zrychlení — mohou souviset s JIT a variabilitou běhu. Při dvanácti vzorcích je p95 v použité metodě nejvyšší naměřený vzorek.

## Provedené kontroly a zbylé hranice

- `npm run verify`: dokumentace, obsah, TypeScript a základní regresní sady.
- `npm run build`, `npm run test:ci`: Cloudflare sestavení a herní integrace nad D1.
- `npm run build:node`, `npm run test:hosting`: produkční Node sestavení, skutečná administrace a herní integrace; zahrnuje katalogovou sadu a nový audit.
- `npm run test:updater`: simulované aktualizace, selhání, návraty, retence a obnova databáze.
- `npm run test:catalog-audit -- docs/performance/catalog-audit.json`: přenos, obnova a uložené měření.
- `npm run check:client-content`: sestavený klient neobsahuje soukromé texty předloh PJ.

Nebyl proveden skutečný Docker build/výměna kontejneru ani živá GitHub instalace nového dema. Není otestované maximum 16 plných katalogů, 128 MB příloh, souběžná zátěž mnoha družin, škodlivý lokální správce filesystemu ani dlouhodobý provoz. Audit nenahrazuje penetrační test ani úplný bezpečnostní audit dekodéru obrázků. V tomto kroku neproběhl nový ruční vizuální průchod všemi dialogy a zařízeními. Automatické testy ověřují datové definice a oprávnění, nikoli pixelovou podobu každého obrázku v prohlížeči.

Dynamická knihovna na Cloudflare zůstává nepodporovaná; vestavěný obsah a podklady přenesené v kampani mají deklarovanou podporu. Obnova plné instalace zůstává ruční při zastavené službě. Před skutečným vydáním proveď zbývající kroky z úvodu a [kontrolního postupu](RELEASING.md#kontrolní-postup-před-vydáním). V rámci původního lokálního auditu se nic nepublikovalo; následné zveřejnění vydání je samostatný schválený krok.
