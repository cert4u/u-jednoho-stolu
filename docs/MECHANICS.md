# Stav základních herních mechanik

[Dokumentace](README.md) · [Herní příručka](PLAYING.md) · [Plán práce](ROADMAP.md) · [Limity](LIMITS.md)

Posouzení k 31. 10. 2026 pro verzi **0.3.0**. Vychází z implementace hlavní větve po přidání inspekce mapy. Jde o audit podpory herního večera v aplikaci, nikoli o kontrolu shody s konkrétní edicí DrD. Nezastupuje společnou zkoušku celé party.

Aplikace už podporuje základní průběh dobrodružství: přípravu → průzkum → zkoušku nebo souboj → rozdělení nálezu → odpočinek → pokračování uložené hry. Největší zbývající herní mezera je přechod ze společného průzkumu na samostatné postavení hrdinů v boji. Druhou praktickou mezerou je předávání výbavy mezi postavami.

## Co skutečně funguje

„Ruční“ znamená, že aplikace eviduje podklady, ale rozhodnutí nebo navazující změnu provádí PJ. Neznamená to, že je daná situace nehratelná.

| Oblast | Implementovaná podpora | Co zůstává na hráčích / PJ |
| --- | --- | --- |
| Postava | Pět vlastností, bonusy, rasa, povolání, úroveň, bojové hodnoty, životy. | Vytvoření podle pravidel a přepočet hodnot z povolání či výbavy. |
| Zkušenosti | Přidělení vybraným hráčům a důvod odměny. | Rozhodnutí o postupu, změna úrovně a jejích přínosů. |
| Průzkum | Společná družina, vedoucí, známé cesty, dohled, šedá paměť a propojená patra. | Pochodové pořadí neurčuje samo cíl přepadu; rozdělení družiny není podporované. |
| Příprava místností | Čísla a názvy, poznámky, tajný a sdílený popis, upozornění při přiblížení, inspekce obsahu. | Obsah připravuje PJ; generátor nevytváří setkání ani odměny. |
| Zkoušky a pasti | Serverový hod na vlastnost, nebezpečnost, soukromá výzva a zaznamenané vyhodnocení. | Spuštění výzvy, následky, případné zranění nebo stav. |
| Souboj | Útok → obrana → návrh zranění → potvrzení PJ; iniciativa, tah a kolo. | Pořadí je ruční, akce nejsou vynucené tahem a nemají rozpočet pohybu/akcí. |
| Poloha v boji | Značky příšer; samostatné značky postav před zahájením společného průzkumu. | Při společném průzkumu se postavy pohybují společně; chybí oddělený bojový režim. |
| Střelba | Lze použít obecný útok s ruční opravou. | Dostřel, kryt, přímka střelby a odečet munice nejsou zvláštní propojená mechanika. |
| Stavy a vyřazení | Vlastní stavy s počtem kol, 0 životů, bezvědomí/smrt/vyřazení a návrat potvrzený PJ. | Účinky stavů a odečet jejich kol; léčení samo neruší potvrzené vyřazení. |
| Kouzla a schopnosti | Vlastní záznamy, uložená cena a odečet magenergie. | Cíl, hod, trvání a účinek se vyhodnotí zvlášť. |
| Odpočinek a léčení | Výběr postav, náhled a potvrzení obnovy životů/magenergie. | Podmínky odpočinku a posun herního času. |
| Kořist a výbava | Nálezy, přidělení, rovné dělení mincí, měšec a spotřeba kusů. | Přímé předání mezi hráči, hmotnost/nosnost, automatický účinek lektvaru či nasazení výbavy. |
| Dveře | Otevírání/zavírání, omezení pohybu a dohledu. | Zámek, klíč, vypáčení a objevení tajných dveří se řeší popisem a zkouškou. |
| Čas a světlo | Ruční posun času, zdroje, odpočet a zhasnutí vyhořelého světla. | Světlo nemění dohled; pohyb, boj a odpočinek neposouvají čas samy. |
| Pokračování hry | Serverové uložení, obnovovací klíče a úplná záloha kampaně. | PJ určuje konec večera a pořizuje zálohu; není to historie všech změn. |

## Doporučené pořadí další práce

Jde o návrh priorit, nikoli o závazek implementace všech položek. Každý krok by měl jít používat samostatně a ponechat PJ možnost ručního rozhodnutí.

### 1. Oddělit průzkum a bojové postavení

PJ spustí boj z aktuálního místa, rozestaví hrdiny a příšery, po skončení zvolí bod opětovného seskupení. Začít samotným postavením; automatické dostřely a složitý rozpočet akcí přidávat až podle potřeby.

Před implementací rozhodnout, z jakých bodů se během boje počítá společný dohled a kdo může posunout kterou postavu. Zkouška musí ověřit neprůchodné zdi/dveře, návrat do průzkumu i zachování fog-of-war.

### 2. Přímé předání předmětů a mincí

Odesílatel zvolí příjemce a počet, aplikace provede odečet i připsání společně a zaznamená předání. Nelze jen vytvořit dva nezávislé zápisy do deníků: při opakování nebo souběhu nesmí vzniknout předmět navíc ani se ztratit.

### 3. Propojit světlo s dohledem

Volitelná vazba aktivních světel a dosahu vidění by odstranila ruční přepínání po dohoření pochodně. PJ musí mít přepsání dosahu pro jiné prostředí či zvláštní vidění. Neslibovat správné chování ve tmě, dokud se neupraví skutečný výpočet výhledu a neověří hráčský pohled.

### 4. Jednoduché zámky a tajné dveře

Navázat stav na hranu mapy; PJ určí odhalení, odemknutí nebo úspěšnou zkoušku. Tajná zeď se hráči nesmí před objevením prozradit jako dveře v mapových datech. V první verzi stačí ruční potvrzení PJ, není nutný katalog klíčů.

### 5. Ulehčit opakované vyhodnocování

Volitelné odečtení kol stavů při změně kola, použití spotřebního předmětu s náhledem účinku a připomenutí postupu úrovně. Oddělit připomenutí od automatického zásahu do postavy; cenu, cíle a následky musí být možné zkontrolovat před potvrzením.

## Podpůrné věci mimo herní pravidla

- Rozšiřování kreslicí plochy: stále platí **28 × 20 polí na patro**. Okolní papír je vzhled, ne další souřadnice. Změna musí zahrnout kreslení, pohyb, dohled, příšery, poznámky i zálohy; nejde jen o roztažení SVG.
- Ukázání místa družině krátkým označením bez přesunu jejího žetonu.
- Opakovaně použitelné vlastní přípravy PJ a přehlednější deník herních sezení.
- Společný test celého večera a skutečných mikrofonů na různých sítích. Automatické kontroly nenahrazují tento provozní test.

Plný pravidlový engine povolání, automatické vyhodnocování všech kouzel, oficiální bestiář a velké katalogy předmětů nejsou podmínkou použitelného MVP.

## Zkouška s partou před dalším rozšiřováním

1. Hráči se připojí a uloží přístupy; PJ připraví dvě místnosti, dveře a schody.
2. Družina projde dveřmi; ověřit dohled, šedou paměť a návrat na předchozí patro.
3. PJ dostane připomínku u místa, otevře inspekci a zadá jednu soukromou zkoušku.
4. Odehrát souboj: ruční pořadí, útok, obranu, potvrzení zranění a rozhodnutí při 0 životech.
5. Rozdělit nález, použít předmět, posunout čas a provést odpočinek.
6. Obnovit úplnou zálohu do oddělené testovací místnosti a ověřit pokračování za PJ i hráče.

Při této zkoušce zapisovat konkrétní ruční úkony, které ruší hraní. Ty určují další priority lépe než počet nezaškrtnutých funkcí.

## Podklady v kódu

- [Hody a zranění](../lib/mechanics.ts), [iniciativa](../lib/initiative.ts), [deníky](../lib/character.ts), [zkušenosti](../lib/experience.ts).
- [Průzkum](../lib/exploration.ts), [inspekce](../lib/map-inspection.ts), [příprava míst](../lib/map-notes.ts).
- [Výbava](../lib/equipment.ts), [kořist](../lib/loot.ts), [čas a světlo](../lib/journey.ts).
- [Kouzla](../lib/powers.ts), [stavy](../lib/conditions.ts), [vyřazení](../lib/life.ts), [léčení](../lib/recovery.ts), [zkoušky](../lib/challenges.ts).
