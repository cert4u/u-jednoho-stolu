# Opuštěný trpasličí důl

Samostatný demonstrační katalog pro **U jednoho stolu**. Obsahuje původní texty, schematické portréty a SVG značky pod licencí MIT, uvedenou v souboru LICENSE. Žádné tabulky ani ilustrace nejsou převzaté z pravidlové příručky. Čísla jsou jednoduché autorské herní předlohy, které může PJ upravit.

- Tři příšery: Strážce strusky, Měděný šeptač a Kahancový můrák; každá má portrét a krátkou radu pro PJ.
- Pět jednotlivých prvků: naviják, kolík, potrubí, písařský stůl a měděné úlomky.
- Dva plošné materiály: okrový průsak a struskový prach, filtrované pro důlní prostředí.
- Jedna předloha generátoru V2: malé patro se šesti komorami.
- Jedno krátké dobrodružství: **Třetí zvon pod Tichým hřbetem**, s fázemi vstup a překážka, výzva, komplikace, vyvrcholení a rozuzlení.

Katalog nevyžaduje jiné obsahové katalogy. Používá existující renderer a generátor aplikace, bez vlastního kódu nebo nových mechanik. Předloha dobrodružství připraví místnosti a příšery; polohy stafáže a ploch rozmístí PJ z palety. Na první místnosti se hodí naviják a kolík, k výzvě potrubí, k evidenci stůl a průsak, k čerpadlu úlomky a struskový prach.

## Instalace

Vyžaduje aplikaci **U jednoho stolu 1.2.0 nebo novější** na Node/Docker. Původní vydání aplikace 1.1.0 dynamickou knihovnu neobsahuje.

V administraci importuj ZIP tohoto adresáře a potvrď souhrn. V lobby vyber dobrodružství nebo použij jeho předlohy v bestiáři, generátoru a paletě. Instalovaný katalog funguje bez GitHubu. Originál je pouze pro čtení; vlastní varianty vytvářej kopírováním do svého katalogu.

## Samostatný GitHub repozitář

Vlož **obsah tohoto adresáře** do kořene vlastního veřejného repozitáře: `catalog.json`, kategorie JSON, `images`, README a LICENSE. Není potřeba přenášet zdrojový kód aplikace ani spouštět build. Uživatelé zadají URL repozitáře v administraci a instalaci potvrdí. Oficiální datový tag `catalog-dwarf-mine-v1.0.0` v repozitáři aplikace obsahuje pouze tento katalog. V administraci zvol **Přidat katalog z GitHubu**, adresu `https://github.com/cert4u/u-jednoho-stolu` a revizi `catalog-dwarf-mine-v1.0.0`. Nezadávej `main`: ta obsahuje zdrojový kód aplikace, nikoli samostatný katalog. Stejný obsah je přiložen jako ZIP k vydání aplikace 1.2.0.

Při další verzi zachovej ID katalogu a existujících položek, zvyš `version` v manifestu a ověř všechny odkazy. Nainstalované kampaně zachovávají své použité podklady; nové kampaně mohou použít novou verzi. Licence všech souborů je MIT, autorství uvádí manifest a LICENSE.
