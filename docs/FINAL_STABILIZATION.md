# Finální stabilizace a připravenost vydání

Výchozí commit je `f4416a6565a81f8bda634f076afba5f9e5b02103` ve větvi `codex/stabilization`. Tento dokument navazuje na [původní audit](STABILIZATION_AUDIT.md) a jeho [měření](performance/stabilization.json). Pravidla, generátor V2 a jednoduché rozhraní se nemění. Verze balíčku zůstává 1.2.1. Nevytváří se release, tag ani merge do `main`.

## A. Opravené problémy

### Nezávislé zprávy a kostky

Nový [test klienta](../scripts/test-game-client.mjs) na původním stabilizačním commitu reprodukuje dvě paralelní zprávy „Ahoj“ se **stejným requestId**. Obsahově klíčovaná `pendingMessages` tedy slučovala nezávislé uživatelské úkony. Totéž platilo pro dva samostatné hody 1k20.

[Transport](../components/game-table/game-client.ts) nyní přidělí každému vyvolání nové ID. Při nejistém přenosu zopakuje nejvýše jednou totožné tělo se stejným ID. Explicitně předané ID se zachovává. Validace 4xx se automaticky neopakuje. Dva stejné záměrné úkony mají dvě zprávy a dva samostatné záznamy hodu; jejich číselné výsledky se samozřejmě mohou náhodně shodovat. Serverová deduplikace, actor scope, CAS a okno 256 operací zůstávají beze změny.

Po vyčerpání obou přenosů nelze z pouhé chyby spojení dovodit, zda server akci uložil. Klient nevytváří neomezené automatické retry ani trvalou frontu. Před dalším novým úkonem ověř historii; pro další přenos původní operace musí volající zachovat její ID.

### React a životní cyklus

Bylo posouzeno všech 15 původních chyb:

| Soubor / počet | Posouzení | Výsledek |
| --- | --- | --- |
| `app/page.tsx` – zápis session ref / 1 | P2: může zpřístupnit hodnotu nepotvrzeného renderu asynchronním handlerům. | Ref se aktualizuje v layout efektu po commit fázi; explicitní přihlášení/odhlášení nadále mění ref okamžitě. |
| `guarded-dialog.tsx` – close callback / 1 | P2/P3: stejná chyba s callbackem dokumentového Escape handleru. | Callback ref se mění po commit fázi. |
| `voice-panel.tsx` – presence callback / 1 | P2/P3: asynchronní události hovoru nesmějí použít callback nepotvrzeného renderu. | Callback ref se mění po commit fázi. |
| `loot-panel.tsx` – renderový DOM/ref přístup / 4 | P2: revize rozpracovaného formuláře závisela na DOM při renderu. | Revize se zachytí při prvním input eventu; netknutý formulář používá aktuální revizi při submitu. |
| `bestiary-panel.tsx` – reset v efektu / 1 | P2/P3: stará data mohou krátce zůstat při změně relace. | Stav fetch je scoped klíčem místnosti/tokenu; retry resetuje stav v události. |
| `catalog-provider.tsx` – reset v efektu / 1 | P2/P3: starý přípravný katalog nesmí přejít do jiné relace nebo role. | Scoped provider podle místnosti/tokenu/role, IO a promise handlery oddělené od synchronního efektu. |
| `app/page.tsx` – hydratační efekt / 1 | P3: jednorázové načtení localStorage a pozvánky po SSR. | Zůstává. Nevytváří cyklus a neodesílá herní mutace; širší změna hydratace není pro tuto etapu potřebná. |
| `dungeon-map.tsx` – reakce na patro, generování, boj, výběr příšery/postavy / 5 | P3: úmyslné resetování UI při změně konkrétního externího identifikátoru. | Zůstává. Neprovádí herní mutace; přidání nestabilních callbacků do dependencies by naopak opakovalo resety při běžném renderu. |

Zbylých **6 chyb a 46 varování** je stále vidět při `npm run lint`. Revidovaná baseline pouze klesla; žádné plošné `eslint-disable` ani zvýšení povolených počtů nebylo přidáno. Mezi varování patří i eventově zaměřené mapové efekty s úmyslně omezenými spouštěcími závislostmi; nejsou tvrzením o bezchybnosti všech budoucích změn mapového UI.

### Prokázaně nepoužité šablony

Odstraněny pouze tři samostatné UI šablony: `chart.tsx`, `calendar.tsx`, `carousel.tsx`, a přímé závislosti `recharts`, `react-day-picker`, `embla-carousel-react`, `date-fns`. Prověřeny byly importy a re-exporty napříč zdroji, dynamické importy, Vite/Sites build hooky, konfigurace shadcn, registry a výstup sestavení. Registry jsou prázdné; samotný alias složky není dynamický loader. Tyto moduly neměly vstupní cestu do aplikace a po odebrání prošel TypeScript i Node build. Čistá instalace, Cloudflare build i Node a Docker běhy v hostovaném CI prošly bez těchto přímých závislostí; výsledek tedy nezávisí na lokálně ponechaném node_modules.

Ostatní obecné komponenty zůstávají: hromadné odstranění celé registry nebo buildových/connector helperů není cílem finální stabilizace. Nejde o plošný refaktor.

## B. Ověřené scénáře

[Test klientského transportu](../scripts/test-game-client.mjs) používá skutečnou klientskou funkci a řízený fetch. [Automatizovaný herní večer](../scripts/test-evening.mjs) používá tutéž funkci proti skutečnému API: PJ, dva hráči, mapa a patro, pohyb/viditelnost, veřejný chat i šeptání, stejné nezávislé zprávy/hody, ztracené potvrzení po uložení, souboj a souběh, odpojení/opětovné čtení, neplatný i obnovený token, export a obnova všech přenositelných dat včetně ilustrace (Node připíná data, Cloudflare u vestavěné příšery používá distribuovaný soubor). Samostatný přenositelný katalogový test na obou runtimech ověřuje i tři skutečně vložené komunitní obrázky. Druhý hráč a nový člen obnovené místnosti nikdy nedostanou přípravu PJ ani cizí šeptání. Staré zálohy bez operačního ledgeru se obnovují. Neznámé volitelné historické atributy jsou tolerovány a validátor je ignoruje; nejde o příslib uchování libovolných polí mimo přenosné schéma. Všechna podporovaná příběhová data se porovnávají po skutečné obnově.

ETag je ověřen pro shodné čtení, změnu stavu, jiné patro, cizí roli, opětovné připojení a rotaci/zneplatnění tokenu. Jde o automatizovaný integrační scénář, **nikoli o odehraný večer několika skutečných lidí**.

Krátký skutečný browserový smoke na izolovaném Node serveru prošel: založení stolu, otevření/zavření dialogů Escape, načtení bestiáře, filtrování a přidání kobolda, zveřejnění nálezu, otevření mincovního formuláře a pokračování po upozornění na neuložené změny. Rozepsaná hodnota zůstala zachovaná. Nebyly zapínány mikrofony ani kamery.

Administrace prošla existujícími behaviorálními testy kategorií, rozepsaných změn, rušení, import/update preview, read-only, pomalé odpovědi, dvojího kliku i odhlášení. Nebyla měněna architektura controlleru pouze kvůli jeho délce.

### Kontroly

| Kontrola | Prostředí | Výsledek |
| --- | --- | --- |
| `npm run verify` | Lokální | Prošlo. |
| `npm run lint:baseline` | Lokální | Prošlo: 6 historických chyb, 46 varování, žádný nárůst. |
| `npm run build` | Lokální Cloudflare | Prošlo. |
| `npm run check:client-content` | Lokální | Prošlo. |
| `npm run test:ci` | Lokální Worker/D1 | Prošlo. |
| `npm run build:node` | Lokální | Prošlo. |
| `npm run test:hosting` | Lokální Node | Prošlo. |
| `npm run test:stabilization` | Lokální Node | Prošlo. |
| `npm run test:updater` | Lokální simulace enginu | Prošlo; nenahrazuje Docker. |
| `test-stable-upgrade` proti sestavenému 1.2.1 | Lokální Node/SQLite | Prošlo. |
| Docker upgrade/rollback z 0.5.3 a 1.2.1 | GitHub Actions | Oba joby prošly v běhu [42456742786](https://github.com/cert4u/u-jednoho-stolu/actions/runs/42456742786), commit `b2e6d1930eb35d32915805b3667f31141f422b94`. |

### Zpřesnění testovacích předpokladů

Při prvním rozšířeném průchodu byly odhaleny i chyby samotných testů: předpoklad vloženého obrázku u každé vestavěné příšery na Cloudflare, společný limit zakládání vyčerpaný celou funkční sadou a chybějící potvrzení konkrétního commitu v Docker fixture z 1.2.1. Updater v posledním případě správně odmítl výměnu ještě před jejím zahájením. Test nyní předává `expectedSha`; produkční ochrana nebyla změněna.

Hromadná izolovaná funkční sada používá běžně konfigurovatelný limit 1000/min. Výchozí produkční ochrana se zvlášť ověřuje v čisté databázi: **přesně 100 úspěšných založení a odmítnutí 101.** Cloudflare CI používá dvě oddělené Worker/D1 instance; Node má samostatnou testovací instanci. Příprava hraniční zálohy byla také změněna z kvadratické na lineární. Původní opakovaná serializace několik sekund blokovala klientský event loop a hostovaný Node běh poté selhal na uzavřeném keep-alive socketu (`EPIPE`). Test nyní počítá velikost přírůstkově, stále ověřuje přesnou UTF-8 délku a před velkým POST nechá zpracovat události socketů; neřeší to slepým opakováním požadavku.

Nejde o testovací backdoor v API ani o zvýšení produkčních výchozích hodnot. Vite předává stejné tři již dokumentované konfigurační proměnné do lokálních Cloudflare runtime bindingů.

Závěrečný kompletní hostovaný běh [42456742786](https://github.com/cert4u/u-jednoho-stolu/actions/runs/42456742786) je **SUCCESS** na commitu `b2e6d1930eb35d32915805b3667f31141f422b94`. Prošel obecný job `test` i oba joby skutečného Docker upgradu/rollbacku. Poslední následný commit doplňuje pouze tento report, návod a naměřená data; produkční kód se po ověřeném commitu nemění.

`npm run lint` byl také skutečně spuštěn a vrací 1 kvůli popsaným 6 historickým chybám / 46 varováním. Není vykazován jako čistý; prochází kontrola revidované baseline. V této etapě nebyl nasazen veřejný Cloudflare Worker ani proveden společný test několika skutečných lidí nebo mikrofonů.

## C. Zbývající technický dluh

Šest popsaných lint chyb a 46 varování; zbývající šablony a jejich závislosti; historická CSS kaskáda. Bez naměřeného problému se nerozděluje celý mapový controller ani nemění pravidla. CI nemá plnohodnotný automatický browserový runner; API/VM testy samy nedokazují layout, ovládání fyzické klávesnice ani skutečný hovor přes mikrofony.

## D. Kompatibilita a rollback

[Migrační test](../scripts/test-stable-upgrade.mjs) používá výhradně vlastní dočasnou databázi. Skutečný starý runtime 1.2.1 založí dvě kampaně, hráče, příběhové poznámky, šeptání a příšeru s připnutou ilustrací. Následuje migrace, restart, kontrola všech syrových řádků místností, přístupů a starých `created_at = 0`, kontrola kapacity a simulace nedostatku disku. Zápis dostane 503, čtení dál funguje. Simulace nahradí statistiku souborového systému pouze v testovacím procesu; disk hostitele se neplní.

Je ověřeno i otevření aditivního schématu starým runtime, návrat skutečné předaktualizační SQLite kopie do 1.2.1 a následná opětovná migrace. Podporovaný updater rollback obnovuje snapshot a odpovídající image, nikoli sloučení změn odehraných po snapshotu. Tyto novější změny je nutné uchovat oddělenou zálohou, kterou updater před návratem vytváří. [Postup](SELF_HOSTING.md#rollback-finální-stabilizace-na-121).

Přenosný formát zůstává verze 1, Node hranice 3 000 000 bajtů kompaktního exportu a D1 hranice 1 999 900 bajtů serializovaného řádku. Žádné nové povinné atributy, katalogová služba ani externí infrastruktura.

Docker CI zachovává původní test z 0.5.3 a přidává 1.2.1. Verze v metadatech testovací image `99.0.0` je výhradně syntetický fixture pro test updateru, který správně odmítá nahrazení jiným commitem stejné verze. Nemění package verzi, nevytváří Git tag, release ani veřejnou image. Test porovnává celé řádky místností a přístupy hráčů, skutečnou výměnu kontejneru, rollback databáze, chybnou image a obnovu katalogových souborů.

## E. Výkon

Herní JSON projekce ani ETag infrastruktura se nemění. Přenosový přínos předchozí stabilizace není přeměřován pětiminutovým testem bez důvodu. Produkční Node klientský JS má 1 271 827 B místo 1 271 458 B (+369 B, +0,029 %); gzip po souborech 357 837 B místo 357 709 B (+128 B). Počet chunků zůstává 10. CSS kleslo z 188 450 B na 182 395 B (gzip z 33 651 B na 32 857 B); JS a CSS dohromady jsou o 5 686 B menší. Osm klientů se stejnou kampaní o 20 příšerách přeneslo v 150 zrychlených dotazech stejných 530 605 B, z toho 8 odpovědí 200 a 1 192 odpovědí 304. Běžný stůl PJ/hráč 5 828 / 1 287 B a pohled s příšerami 507 554 / 3 293 B zůstaly stejné. Není zde významný nárůst bundlu ani přenosu; produkční latenci a chování při velké zátěži z tohoto přenosového měření nevyvozujeme. [Podrobné měření](performance/final-stabilization.json). Odstraněné šablony nebyly v klientském grafu; nepředstíráme proto jejich zdrojovou velikost jako ušetřený síťový přenos.

## F. Připravenost k vydání

**READY WITH LIMITATIONS – připraveno k vydání pro zamýšlené malé komunitní skupiny.**

Všech devět výslovně požadovaných lokálních příkazů prošlo (striktní lint má samostatně uvedené historické nálezy), stejně jako celý hostovaný CI běh včetně skutečného Docker upgradu, rollbacku a obnovy dat z 1.2.1 i 0.5.3. Nebyla zjištěna známá neopravená kritická chyba ohrožující uživatelská data v ověřeném rozsahu. Nezávislé zprávy/hody se neslučují, opakovaný přenos zachovává identitu a serverový výsledek, soukromá data PJ zůstávají oddělená a export → import zachovává podporovaný příběh, mapu, souboj a obrázky na skutečné hranici obou runtimeů.

Konkrétní omezení: 6 posouzených React lint chyb a 46 varování; mapové/SSR efekty zůstávají zdokumentované, nikoli vypnuté. Cloudflare byl ověřen místním runtime a hostovaným CI, nikoli veřejným deploymentem konkrétního tarifu. Automatizovaný herní večer a krátký skutečný UI smoke nenahrazují společné hraní lidí ani zkoušku mikrofonů. Tato omezení nevyžadují další herní funkce ani novou infrastrukturu.

Technická stabilizace je tím uzavřena. **Nebyl vytvořen release 1.2.2, Git tag ani automatický merge do main.**

### Krátký manuální společný smoke před nasazením

1. V oddělených profilech prohlížeče připoj PJ a dva hráče do testovací místnosti. Ověř jejich role, deníky a že tajné poznámky nevidí hráči.
2. Změň patro a viditelnost, pošli veřejnou zprávu i šeptání, proveď dva úmyslné stejné hody. Porovnej počty zpráv a samostatné záznamy hodů, nikoli nutně různé číselné výsledky.
3. Odpoj jednoho hráče od sítě, připoj ho a případně obnov jeho klíč. Ověř správný aktuální pohled a odmítnutí starého tokenu.
4. Exportuj testovací kampaň a obnov ji do nové místnosti. Před používáním stejného postupu na skutečné kampani uchovej i úplnou serverovou zálohu. Volitelný hovor přes skutečné mikrofony ověř samostatně, pokud jej instalace používá.

Tento lidský společný smoke zatím nebyl odehrán; je doplňkem automatizovaného scénáře, nikoli jeho náhradním označením.
