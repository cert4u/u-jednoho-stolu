# Přidávání herního obsahu

[První změna a vývojový stůl](DEVELOPMENT.md) · [Ilustrace](ILUSTRACE.md) · [Herní příručka](PLAYING.md)

Předlohy jsou součástí repozitáře v adresáři [content](../content). Každý katalog má `version: 1` a seznam `entries`. Jedna položka má jedno stálé ID z malých ASCII písmen, číslic a pomlček. ID neměň, pokud na ně odkazují jiná dobrodružství nebo uložené příšery.

Předlohy dodávají výchozí hodnoty při založení. Úpravy PJ se ukládají do konkrétní kampaně. Nová verze katalogu nepřepisuje její mapy, statistiky ani poznámky. Obrázek příšery se dohledává podle uloženého ID předlohy.

| Chci přidat | Upravím | Kontrola |
| --- | --- | --- |
| Příšeru | [bestiary.json](../content/bestiary.json) a WebP v [public/monsters](../public/monsters) | Unikátní ID, známé prostředí, platné bojové hodnoty, existující ilustrace. |
| Nastavení generátoru | [dungeon-presets.json](../content/dungeon-presets.json) | Pojmenované parametry V2 včetně semínka. Z předlohy musí vzniknout platná mapa. |
| Krátké dobrodružství | [adventures.json](../content/adventures.json) | Předloha jeskyně, dostupná patra a role místností, platné odkazy na příšery. |

## Příšera

Zkopíruj podobný záznam v bestiáři. Uprav `name`, `description`, `gmHint`, `environments`, `maxHp` a `combat`. Obrázek pojmenuj podle ID. Pokud má jiný název, uveď jej v `portrait` bez přípony `.webp`. Použitelná prostředí definuje [modul bestiáře](../lib/bestiary.ts). Nápověda `gmHint` se při přidání příšery zkopíruje do jejích tajných poznámek.

## Jeskyně a dobrodružství

Předloha jeskyně v generátoru vyplní nastavení pro další úpravu a náhled. PJ sám potvrdí vložení mapy. Semínko, verze a varianta určují opakovatelný výsledek.

Předloha dobrodružství odkazuje na jeskyni pomocí `dungeonPreset`. Při vytvoření nového stolu server připraví mapu, schodiště, poznámky a příšery. Lobby zpřístupňuje pouze název a krátkou upoutávku. `gmNotes` jsou tajné a `playerText` se používá pro Situaci, kterou může PJ ukázat ručně nebo se spustí při vstupu družiny do místnosti.

Připravenou místnost určují `floor` (1 je přízemí) a `role` (`entrance` nebo `goal`). Například následující záznam přiřadí popis a sliz do cílové místnosti přízemí.

```json
{
  "floor": 1,
  "role": "goal",
  "title": "Schránka v kořenech",
  "playerText": "Na vlhké podlaze se něco leskne.",
  "gmNotes": "Klíč je uvnitř slizu.",
  "monsters": ["slime"]
}
```

Spusť `npm run check:content` a předlohu vyzkoušej na místním stole. Běžná hra, export i obnova používají stejné uložené objekty jako ručně vytvořená kampaň.

## Herní pravidla

Výpočty kostek, bonusů a zranění jsou v [combat-rules.ts](../lib/combat-rules.ts). Soubojový postup, oprávnění a potvrzení následků spravuje [mechanics.ts](../lib/mechanics.ts). Předlohy mohou nastavit výchozí bojové hodnoty. Popis zvláštní schopnosti vyhodnocuje PJ u stolu. Pro změnu pravidla uprav příslušný modul a projdi integrační scénáře.
