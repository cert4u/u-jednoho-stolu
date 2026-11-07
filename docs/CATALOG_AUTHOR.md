# Jak vytvořit a zveřejnit komunitní katalog

[Správa knihovny](CATALOG_LIBRARY.md) · [Schémata obsahu](OBSAH.md) · [Stafáž a plochy](SCENERY.md)

Katalog je čistě datový balíček, nikoli plugin. Nemá instalační skript a nespouští JavaScript. Nejjednodušší postup je vytvořit vlastní katalog v administraci, ověřit jeho obsah ve zkušební kampani a použít **Exportovat ZIP**.

Kompletní původní příklad je [Opuštěný trpasličí důl](../examples/catalogs/abandoned-dwarf-mine/README.md). Obsah jeho adresáře lze vložit přímo do kořene samostatného repozitáře. ZIP vytvoří `npm run catalog:demo -- /tmp/opusteny-trpaslici-dul.zip`; výstupní soubor nesmí již existovat. [Integrační audit](CATALOG_AUDIT.md) ověřuje i jeho přenos do nové instalace.

## Adresářový formát

ZIP i veřejný GitHub repozitář používají stejnou strukturu:

```text
catalog.json
bestiary/
  cave-scout.json
dungeon-presets/
  old-mine.json
adventures/
  missing-lantern.json
scenery/
  miners-table.json
  soot.json
images/
  cave-scout.webp
LICENSE
README.md
```

Kategorie mohou být prázdné nebo chybět. ZIP může mít jeden společný nadřazený adresář, například automatický ZIP repozitáře z GitHubu. Soubor `catalog.json` musí být právě jeden. Jména položek odpovídají jejich lokálním ID, malými písmeny bez diakritiky, s číslicemi a pomlčkami. Neměň ID již publikovaných katalogů a položek.

```json
{
  "schemaVersion": 1,
  "id": "trpaslici-doly",
  "name": "Trpasličí doly",
  "version": "1.0.0",
  "author": "Autor katalogu",
  "license": "CC-BY-4.0",
  "description": "Původní příprava pro opuštěné doly.",
  "minAppVersion": "1.2.0",
  "dependencies": [
    { "id": "builtin", "minVersion": "1.2.0" }
  ],
  "fileLicenses": {
    "images/cave-scout.webp": "CC-BY-4.0",
    "bestiary/cave-scout.json": "CC-BY-4.0"
  },
  "attributions": {
    "images/cave-scout.webp": {
      "author": "Autor ilustrace",
      "source": "Vlastní původní kresba"
    }
  }
}
```

Verze jsou v této etapě stabilní číselné `MAJOR.MINOR.PATCH`, například `1.0.0`. Kompatibilita se kontroluje podle `minAppVersion`, závislosti podle `minVersion`. Pro nové katalogy používej aktuální verzi aplikace podporující knihovnu. Číslo verze samo neidentifikuje obsah: instalace ukládá také SHA-256 a u GitHubu konkrétní commit.

Licenční a autorské údaje jsou povinné. Případné odlišné licence souborů uváděj v `fileLicenses`; `attributions` uchovává autorství a zdroj. Doprovodné licenční texty a README se při exportu zachovávají. Nepřidávej texty, ilustrace nebo tabulky, k jejichž sdílení nemáš oprávnění. Licence aplikace MIT automaticky neurčuje licenci převzatého herního obsahu.

## Položky a odkazy

Položky používají stejná schémata jako [vestavěný obsah](../content). Příšera má jméno, popis, větu pro PJ `gmHint`, prostředí, životy a bojové hodnoty. `portrait` je ID lokálního obrázku bez přípony; pokud chybí, lze použít obrázek se jménem ID příšery nebo bezpečný náhradní vzhled. Výslovné `builtin:kobold` použije distribuovaný portrét bez jeho kopírování do archivu.

Předloha dobrodružství může odkazovat na předlohu jeskyně a příšery. Neoznačené ID znamená **položku stejného katalogu**. Cizí odkazy jsou výslovné:

```json
{
  "id": "missing-lantern",
  "title": "Ztracená lucerna",
  "scene": "Vchod do staré štoly",
  "summary": "Najděte lucernu dříve, než zhasne poslední světlo.",
  "gmNotes": "Strážce se bojí zvuku zvonu.",
  "dungeonPreset": "builtin:mine",
  "rooms": [
    {
      "floor": 1,
      "role": "entrance",
      "title": "Zavalená vrata",
      "playerText": "Mezi kameny prosvítá teplé světlo.",
      "gmNotes": "Za vraty čeká hlídka.",
      "monsters": ["cave-scout"]
    }
  ]
}
```

Odkaz `builtin:mine` vyžaduje závislost na `builtin`. Odkaz `jiny-katalog:rat` vyžaduje deklarovanou závislost na `jiny-katalog`. Závislosti se samy nestahují; správce je nejprve nainstaluje. Cykly a chybějící odkazy jsou odmítnuté. Generátor a role místností se kontrolují stejnou logikou jako u vestavěných dobrodružství.

Stafáž používá [bezpečnou SVG cestu pro plátno 32 × 32](SCENERY.md#komunitní-katalog). Plošný materiál je záznam `scenery` s `category: "floor"`, `automatic: false` a profilem `surface`. Nevkládej HTML, celé SVG dokumenty, externí odkazy, skripty ani vlastní CSS. Textury a barvy řídí společný renderer.

## Ověření a publikace

1. Ověř katalog v místní administraci a založ z jeho předlohy testovací kampaň. Vyzkoušej i pohled hráče: `gmHint` a poznámky přípravy nesmějí být veřejné.
2. Exportuj ZIP. V jiné testovací instalaci jej naimportuj a potvrď až po prohlédnutí souhrnu. Při testu původní instalace může stejné ID způsobit kolizi — to je záměrná ochrana, ne důvod ID publikovaného katalogu náhodně měnit.
3. Pro GitHub rozbal svůj export do kořene **vlastního veřejného repozitáře**. Přidej srozumitelný README, autora a licenci. Katalog nesmí obsahovat skutečné kampaně, přístupy ani instalační tajemství.
4. Zvyš `version` při vydání změn a zachovej ID. Vhodný je také tag stejné verze. Aplikace umí při instalaci přeložit tag nebo `HEAD` na konkrétní commit.
5. Sdílej adresu `https://github.com/autor/repozitar`. Správce ji zadá v administraci a potvrdí ověřenou instalaci. Aplikace za tebe repozitář nezakládá ani do něj neposílá commity.

Odstranění nebo změna již používané položky nemění připnuté kopie v rozehraných kampaních. Nadále ale zachovávej stabilní ID a kompatibilní odkazy pro nové přípravy a závislé katalogy. Správce aktualizaci vždy potvrzuje; výpadek či zánik GitHubu neovlivní již instalovanou místní kopii.

Limity ZIP, obrázků, manifestu a instalace jsou v [provozním návodu knihovny](CATALOG_LIBRARY.md#limity-a-bezpečnost). Soukromé repozitáře, přihlašování ke GitHubu a vzdáleně spouštěný kód nejsou podporované.
