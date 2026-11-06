# Ilustrace postav a bestiáře

Nové kresby připravujeme v ImageGenu v Codexu. K zadání přilož referenční obrázky ze správné sady a v promptu nahraď text v hranatých závorkách. Reference určuje kresbu, barevnost, měřítko a pozadí. Vzhled nové postavy nebo příšery popiš zvlášť.

Obě sady spojuje jemná inkoustová šrafura, tlumený akvarel a světlý krémový papír přibližně v odstínu `#f8f2e6`. Papír má jen slabou texturu a kolem celé siluety je dost místa. Obrázek používáme v deníku nebo na kartě bestiáře, proto potřebujeme čitelnou kresbu i v malém náhledu.

## Postavy

Přilož [válečníka](../public/characters/warrior-light.webp) a [válečnici](../public/characters/warrior-woman-light.webp). Pro nové povolání vytvoř dvojici s podobným měřítkem a stejně praktickou výbavou.

```text
Create two new full-length portraits for a classic Czech tabletop RPG character
sheet. Use the attached warrior portraits as references for fine engraved ink
hatching, restrained watercolor, natural proportions, framing and light warm ivory
paper (#f8f2e6). Draw a [PROFESSION] with [CLOTHING, EQUIPMENT AND MUTED COLORS].
Show an adult man on the left and an adult woman on the right, with distinct faces
and equally practical gear. Each figure stands naturally, fully visible from head
to boots. Make a landscape 4:3 sheet with two equal independent vertical 2:3
portraits. Leave a broad blank gutter at the center. Use subtle paper grain and a
faint contact shadow. Keep all props inside their own half. No scene, vignette,
frame, typography or visible divider.
```

Rozděl výstup v polovině, obě kresby ulož jako WebP o rozměrech 720 × 1080 do [public/characters](../public/characters) a doplň české názvy a alternativní texty do [deníku postavy](../components/character-sheet-artwork.tsx).

## Bestiář

Přilož [skřeta](../public/monsters/orc.webp) a k němu vhodný druhý vzor, třeba [vlka](../public/monsters/wolf.webp) pro zvíře nebo [kostlivce](../public/monsters/skeleton.webp) pro nemrtvého. Drž se klidného postoje a neutrálního světla, aby různé druhy vypadaly jako kresby z jednoho atlasu.

```text
Draw a new full-body specimen of [CREATURE] for the same old-school tabletop RPG
field guide as the attached references. Match the fine ink crosshatching, muted
earth-tone watercolor, pale warm ivory paper, even light and small ground shadow.
The specimen has [ANATOMY, CLOTHING OR PROPS]. Give it a calm resting pose in a
three-quarter view. Keep every limb and prop within the frame, with generous
blank margins. Make the background uniform and lightly textured. Avoid action
poses, saturated colors, glow, deep shadows, scenery, frames and lettering.
```

Při generování více druhů v jednom obrazu požádej o samostatné sloupce se širokými prázdnými mezerami, aby každá silueta šla vyříznout. Každou příšeru ulož samostatně jako WebP o rozměrech 400 × 480 do [public/monsters](../public/monsters). Do [katalogu](../content/bestiary.json) přidej stálé ID, český název, popis, větu pro PJ (`gmHint`), prostředí a výchozí bojové hodnoty. Soubor pojmenuj podle ID nebo nastav položku `portrait` na název souboru bez přípony. Při pozdější výměně kresby ponech stejné ID, aby se obrázek dál zobrazoval i u dříve přidaných příšer.
