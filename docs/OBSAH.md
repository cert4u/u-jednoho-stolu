# Přidávání herního obsahu

Obsah bez sestavování aplikace spravuje [místní knihovna katalogů](CATALOG_LIBRARY.md). Přenositelné balíčky popisuje [návod pro autora katalogu](CATALOG_AUTHOR.md). Níže je postup pro přispívání do vestavěného distribuovaného obsahu.

[Vývojový stůl](DEVELOPMENT.md) · [Ilustrace](ILUSTRACE.md) · [Herní příručka](PLAYING.md)

Každá předloha má vlastní soubor `<id>.json` v adresáři [content](../content). ID začíná písmenem a používá malá písmena bez diakritiky, číslice a pomlčky. Použité ID ponech kvůli odkazům z jiných předloh a kampaní.

## První příšera nebo dobrodružství za 15 minut

1. Ve vlastním forku zkopíruj [kobolda](../content/bestiary/kobold.json) nebo [Co hlídají kořeny](../content/adventures/pod-koreny.json). Kopii dej vlastní ID a stejné jméno souboru. Změň jméno a texty.
2. Příšeře přidej obrázek WebP do [public/monsters](../public/monsters). Pro první místní pokus můžeš použít existující ilustraci přes `"portrait": "kobold"`. Doplň větu `gmHint` s nápadem pro PJ a zkontroluj bojové hodnoty. K dobrodružství uprav upoutávku a jednu místnost podle příkladu níže.
3. Spusť `npm run content:sync` a `npm run check:content`. První příkaz obnoví seznamy souborů `index.ts`, druhý ověří data, ilustrace, odkazy i generování map. Chyba uvádí soubor a podle typu i přesné pole.
4. Spusť `npm run dev:node`. Příšeru vyzkoušej jako PJ v **Příšery → Bestiář**. Dobrodružství zvol v lobby při zakládání nového stolu.
5. Do PR přidej nový JSON, případnou ilustraci, vygenerovaný index a stručný popis toho, co jsi vyzkoušel. Uveď původ a oprávnění k textu i ilustraci podle [pravidel přispívání](../CONTRIBUTING.md#licence-a-původ-obsahu).

Související příšery, předlohu jeskyně a dobrodružství můžeš přidat v jednom PR. Vazby mezi nimi vedou přes ID.

## Pole a příklady

| Obsah | Příklad | Kontrola |
| --- | --- | --- |
| Příšera | [kobold.json](../content/bestiary/kobold.json) | `gmHint`, prostředí, životy a bojové hodnoty. `portrait` obsahuje název WebP bez přípony a výchozí název je ID příšery. |
| Předloha jeskyně | [cave.json](../content/dungeon-presets/cave.json) | Parametry V2 včetně semínka. Kontrola z nich vygeneruje a ověří mapu. |
| Stafáž | [moss.json](../content/scenery/moss.json) | Kategorie, prostředí, souhlas s automatickým rozmístěním a bezpečná SVG cesta; plošné materiály navíc profil `surface` s odstínem, texturou a nepravidelností; [návod pro autory](SCENERY.md#komunitní-katalog). |
| Dobrodružství | [pod-koreny.json](../content/adventures/pod-koreny.json) | Existující předloha jeskyně, platné a jedinečné cílové místnosti, známé příšery. |

Prostředí příšer definuje [seznam prostředí](../lib/bestiary-environments.ts). Větu `gmHint` server vydá PJ a při přidání ji zkopíruje do tajných poznámek příšery. Ilustrace jsou veřejné soubory.

Dobrodružství odkazuje na jeskyni polem `dungeonPreset`. Při založení server vytvoří mapu, schodiště, poznámky a příšery. Lobby ukazuje název a upoutávku. `gmNotes` patří PJ. `playerText` může PJ ukázat jako Situaci, případně se zobrazí při vstupu do místnosti během průzkumu.

### Připravená místnost

Pomocí `npm run content:rooms -- cave` vypiš ID a role místností pro předlohu `cave`. Zadej `floor` (1 je přízemí) a právě jeden cíl. `roomId` vybere konkrétní místnost, `role` vybere `entrance` nebo `goal` daného patra. ID V2 jsou stabilní pro stejné parametry, verzi, semínko a variantu. Po úpravě některé z těchto hodnot zkontroluj v náhledu, že odkaz stále vybírá zamýšlenou místnost.

```json
{
  "floor": 1,
  "roomId": "v2-l0-r1",
  "phase": "complication",
  "title": "Chodba plná skořápek",
  "playerText": "Pod kořeny křupou prázdné ořechové skořápky.",
  "gmNotes": "Krysy odláká hrst zbytků.",
  "monsters": ["giant-rat", "giant-rat"]
}
```

Volitelné `phase` slouží autorovi jako značka pro vstupní překážku (`entrance-obstacle`), výzvu (`challenge`), komplikaci (`complication`), vyvrcholení (`climax`) nebo rozuzlení (`resolution`). Fáze mohou chybět či se opakovat. Při založení hry se z nich sestaví soukromá [Příběhová osnova](STORY_OUTLINE.md), propojená se všemi odpovídajícími poznámkami. Aplikace podle nich neřídí průběh příběhu. Úplný příklad s osmi místnostmi je [Dům vypůjčeného světla](../content/adventures/dum-svetla.json).

Příšery obsazují volná podlahová políčka v půdorysu místnosti. Schody, vchod, východ a značky poznámek zůstanou volné. Pokud místo dojde, přebytečné příšery najde PJ v seznamu a může je rozmístit ručně.

Předlohy dodávají výchozí hodnoty. PJ pak upravuje kopii ve své kampani. Ilustrace se dohledává podle uloženého ID předlohy, proto při úpravě katalogu zachovej použitá ID a jejich portréty.

## Herní pravidla

Výpočty kostek, bonusů a zranění jsou v [combat-rules.ts](../lib/combat-rules.ts). Soubojový postup, oprávnění a potvrzení následků spravuje [mechanics.ts](../lib/mechanics.ts). Zvláštní schopnosti z předloh vyhodnocuje PJ u stolu.
