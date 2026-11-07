# Stafáž mapy

Nástroj **Stafáž** je dostupný PJ v přípravě i odkrývání. Paleta má dvanáct původních tušových symbolů: bednu, sud, stůl, lavici, polici, sloup, suť, balvan, houby, kořeny, důlní vozík a dřevěnou podpěru. Filtrem **Prostředí** vybereš hrad, důl nebo jeskyni; filtr je doporučení, ne pravidlo umístění.

![Stafáž v místnosti i v okolní skále](images/scenery.jpg)

## Umístění a úpravy

1. Vyber symbol, malou/střední/velkou velikost a otočení po 90°. Volba **Jen PJ** založí skrytý prvek.
2. Klikni do políčka mapy, případně použij šipky a Enter. Každé vložení je samostatný tah. Prvek může být uvnitř i vně půdorysu v rámci mřížky 28 × 20.
3. Ve zvoleném nástroji klikni na existující symbol nebo na jeho políčku stiskni Enter. Otevře se editor velikosti, otočení, skrytí a poznámky PJ do 1000 znaků.
4. Pro přesun nejdřív ulož rozepsané změny. **Přesunout v mapě** čeká na nové políčko; umístění potvrdí kliknutí nebo Enter. Přesun lze zrušit v paletě, klávesou Escape nebo změnou nástroje. Přepnutí na jiné patro přesun mezi patry neprovede.
5. **Odstranit stafáž** prvek odebere. Vložení, úpravu, přesun i odstranění lze vrátit běžným **Zpět**, v rámci společné historie mapy.

Na jednom políčku je jeden prvek a na patře nejvýše 200. Změny stávajícího prvku kontrolují jeho revizi (nový neprůhledný token při každém uložení, bezpečný i po Zpět); při souběhu server vrátí konflikt a editor ponechá rozepsané údaje. Poznámka se hráčům neposílá. Další nástroj, například Ruka, paletu zavře a běžné hraní pokračuje.

## Viditelnost a herní význam

Stafáž neblokuje pohyb, nemění zdi, dveře, osvětlení ani metadata generátoru V2. Klasický a ručně kreslený vzhled používají stejné symboly, slabší než hlavní kontury. Herní značky, postavy a příšery zůstávají nad dekoracemi. Mimo nástroj Stafáž jsou dekorace neinteraktivní.

Vnitřní prvek hráč pozná po odhalení svého políčka. Vnější prvek patří k bezprostředně sousedící podlaze; objeví se po odhalení alespoň jednoho takového políčka. Izolovaná dekorace bez sousední podlahy zůstává jen v přípravě PJ. Jde o kartografický detail okolní skály, nikoli o samostatný průhled skrze stěnu.

Při automatickém průzkumu se ukládá pouze skutečně viděná podoba. Přesun, odstranění nebo skrytí mimo dohled se do hráčské paměti nepromítne před dalším spatřením místa. Nově skrytý prvek, který už hráči dříve viděli, tak mohou stále znát ze šedé paměti. Změna tajné poznámky se neprozradí ani pomocí revize. PJ může odhalování řídit také ručně, stejně jako dosud.

Změna podlahy stafáž nemaže: může se stát vnější nebo izolovanou značkou. PJ ji může následně přemístit či odstranit. Automatické rozmístění, fyzické překážky, interaktivní truhly a vazby na kořist nejsou součástí první sady.

## Data a vývoj

Volitelné `Dungeon.scenery` obsahuje `{id, kind, x, y, rotation, size, hidden?, note?, revision?}`. Uložení používá existující akci `map`, nástroj `scenery`, operaci `save` nebo `remove`, `requestId`, a při úpravě `sceneryId` a `expectedRevision`. První vložení používá `expectedRevision: null`. Bezpečné opakování a historii zajišťuje běžná mapová transakce; hráčský zápis server odmítá.

- [lib/scenery.ts](../lib/scenery.ts): katalog, validace, úpravy a projekce do paměti.
- [glyph.tsx](../components/scenery/glyph.tsx): původní SVG symboly sdílené mapou a paletou.
- [layer.tsx](../components/scenery/layer.tsx): neinteraktivní dekorativní vrstva a útlum podle dohledu.
- [palette.tsx](../components/scenery/palette.tsx), [editor.tsx](../components/scenery/editor.tsx): výběr a soukromé úpravy PJ.
- [test-scenery-core.mjs](../scripts/test-scenery-core.mjs): typy, geometrická nezávislost, paměť, Zpět a kompatibilita generování v `npm test`.
- [test-scenery.mjs](../scripts/test-scenery.mjs): oprávnění, souběh, opakování, skrytí, paměť a úplné zálohy v obou integračních sadách.

Paměť ukládá jen veřejná vizuální pole; soukromé údaje se neskrývají pouze CSS. Může uchovat až 560 historických značek po jedné na políčko. Validační schéma odmítne tajné údaje v paměti. Záloha formátu 1 podporuje nové volitelné pole ve všech mapách a jejich historiích. Staré zálohy bez stafáže zůstávají platné, SQL migrace se nemění. Pro zachování nové stafáže při obnově používej verzi aplikace, která ji podporuje.
