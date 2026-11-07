# Místní a komunitní katalogy

Tato vývojová větev připravuje správu katalogů pro samostatnou instalaci Node/Docker. Nejde o centrální službu. GitHub je pouze volitelný distribuční zdroj. Již instalovaný obsah musí fungovat offline.

## Architektura a implementační etapy

1. **Jádro:** zachovaná Zod schémata a vestavěné soubory, neměnná identita katalogů, resolver, nová SQLite migrace a přenositelné připnutí použitých předloh do kampaně.
2. **Místní správa:** existující administrace, vlastní katalogy, verzované transakční úložiště, editace a kopie záznamů, jediný ZIP formát pro import a export.
3. **GitHub:** veřejný repozitář, konkrétní commit, stejné ověření jako u ZIP, souhrn změn a potvrzená aktualizace s bodem návratu.
4. **Integrace a audit:** bestiář, předlohy, stafáž a plochy, ochrana soukromých informací a existujících her, úplné zálohy serveru, regresní testy a návody.

Výchozí katalog zůstává součástí aplikace, neimportuje se do databáze a správce jej nepřepisuje. ID `builtin` je vyhrazené. Staré odkazy jako `kobold` označují výchozí obsah. Nové odkazy používají `id-katalogu:id-polozky`; typ položky je samostatná součást klíče resolveru. Zobrazovaný název katalogu lze změnit bez změny identity.

Uvnitř přenositelného katalogu znamená neoznačený odkaz jeho vlastní jmenný prostor. Cizí odkazy jsou výslovné, například `builtin:castle`, a vyžadují deklarovanou závislost. Tím nevzniká tichý přechod na stejně pojmenovanou položku jiného katalogu. Příšery a stafáž mohou mít stejné lokální ID, protože se hledají podle typu.

Kampaň připíná první použitou verzi předlohy a její potřebné závislosti. Aktualizace knihovny tuto kopii nemění; novou verzi lze používat v nové kampani. Životy, poznámky a ostatní herní stav zůstávají běžnou kopií kampaně. Export katalogu není export kampaně.

SQLite obsahuje metadata katalogů, jejich platné definice a historii verzí. Přílohy jsou neměnné soubory pojmenované SHA-256 v persistentním adresáři `catalog-assets` pod `STUL_DATA_DIR`. V kampani se potřebné obrázky uchovávají také přenositelně pro obnovu bez původní instalace. Zápis přílohy před databázovým commitem může při chybě ponechat pouze nepoužitý soubor, nikoli částečně instalovaný katalog.

Společné moduly neimportují Node API. Cloudflare používá vestavěné katalogy a připnuté podklady přenesené zálohou; dynamická serverová knihovna a její administrace nejsou na Cloudflare v této etapě podporované. Node adaptér obsluhuje SQLite a persistentní přílohy.

## Stav vývoje

Implementace probíhá po uvedených etapách. Tento dokument bude doplněn o přesné administrační kroky, formát archivu, limity a výsledky skutečně provedených testů před dokončením celé funkce.
