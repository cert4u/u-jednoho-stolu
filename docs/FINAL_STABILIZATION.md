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

Odstraněny pouze tři samostatné UI šablony: `chart.tsx`, `calendar.tsx`, `carousel.tsx`, a balíčky `recharts`, `react-day-picker`, `embla-carousel-react`, `date-fns`. Prověřeny byly importy a re-exporty napříč zdroji, dynamické importy, Vite/Sites build hooky, konfigurace shadcn, registry a výstup sestavení. Registry jsou prázdné; samotný alias složky není dynamický loader. Tyto moduly neměly vstupní cestu do aplikace a po odebrání prošel TypeScript i Node build. Čistá instalace/build v CI ověří také absenci náhodné závislosti na lokálně ponechaném node_modules.

Ostatní obecné komponenty zůstávají: hromadné odstranění celé registry nebo buildových/connector helperů není cílem finální stabilizace. Nejde o plošný refaktor.

## B. Ověřené scénáře

[Test klientského transportu](../scripts/test-game-client.mjs) používá skutečnou klientskou funkci a řízený fetch. [Automatizovaný herní večer](../scripts/test-evening.mjs) používá tutéž funkci proti skutečnému API: PJ, dva hráči, mapa a patro, pohyb/viditelnost, veřejný chat i šeptání, stejné nezávislé zprávy/hody, ztracené potvrzení po uložení, souboj a souběh, odpojení/opětovné čtení, neplatný i obnovený token, export a obnova všech přenositelných dat včetně ilustrace (Node připíná data, Cloudflare u vestavěné příšery používá distribuovaný soubor). Samostatný přenositelný katalogový test na obou runtimech ověřuje i tři skutečně vložené komunitní obrázky. Druhý hráč a nový člen obnovené místnosti nikdy nedostanou přípravu PJ ani cizí šeptání. Staré zálohy bez operačního ledgeru a s neznámými volitelnými historickými atributy se obnovují.

ETag je ověřen pro shodné čtení, změnu stavu, jiné patro, cizí roli, opětovné připojení a rotaci/zneplatnění tokenu. Jde o automatizovaný integrační scénář, **nikoli o odehraný večer několika skutečných lidí**.

Administrace prošla existujícími behaviorálními testy kategorií, rozepsaných změn, rušení, import/update preview, read-only, pomalé odpovědi, dvojího kliku i odhlášení. Nebyla měněna architektura controlleru pouze kvůli jeho délce.

### Kontroly

| Kontrola | Prostředí | Výsledek |
| --- | --- | --- |
| `npm run verify` | Lokální | Závěrečný běh bude zaznamenán. |
| `npm run lint:baseline` | Lokální | Revidovaná baseline 6/46; závěrečný běh bude zaznamenán. |
| `npm run build` | Lokální Cloudflare | Závěrečný běh bude zaznamenán. |
| `npm run check:client-content` | Lokální | Závěrečný běh bude zaznamenán. |
| `npm run test:ci` | Lokální Worker/D1 | Závěrečný běh bude zaznamenán. |
| `npm run build:node` | Lokální | Po odstranění šablon prošel. |
| `npm run test:hosting` | Lokální Node | Závěrečný běh bude zaznamenán. |
| `npm run test:stabilization` | Lokální Node | Závěrečný běh bude zaznamenán. |
| `npm run test:updater` | Lokální simulace enginu | Prošlo; nenahrazuje Docker. |
| `test-stable-upgrade` proti sestavenému 1.2.1 | Lokální Node/SQLite | Prošlo. |
| Docker upgrade/rollback z 0.5.3 a 1.2.1 | GitHub Actions | Bude spuštěno na pracovní větvi; zatím neověřeno. |

## C. Zbývající technický dluh

Šest popsaných lint chyb a 46 varování; zbývající šablony a jejich závislosti; historická CSS kaskáda. Bez naměřeného problému se nerozděluje celý mapový controller ani nemění pravidla. CI nemá plnohodnotný automatický browserový runner; API/VM testy samy nedokazují layout, ovládání fyzické klávesnice ani skutečný hovor přes mikrofony.

## D. Kompatibilita a rollback

[Migrační test](../scripts/test-stable-upgrade.mjs) používá výhradně vlastní dočasnou databázi. Skutečný starý runtime 1.2.1 založí dvě kampaně, hráče, příběhové poznámky, šeptání a příšeru s připnutou ilustrací. Následuje migrace, restart, kontrola všech syrových řádků místností, přístupů a starých `created_at = 0`, kontrola kapacity a simulace nedostatku disku. Zápis dostane 503, čtení dál funguje. Simulace nahradí statistiku souborového systému pouze v testovacím procesu; disk hostitele se neplní.

Je ověřeno i otevření aditivního schématu starým runtime, návrat skutečné předaktualizační SQLite kopie do 1.2.1 a následná opětovná migrace. Podporovaný updater rollback obnovuje snapshot a odpovídající image, nikoli sloučení změn odehraných po snapshotu. Tyto novější změny je nutné uchovat oddělenou zálohou, kterou updater před návratem vytváří. [Postup](SELF_HOSTING.md#rollback-finální-stabilizace-na-121).

Přenosný formát zůstává verze 1, Node hranice 3 000 000 bajtů kompaktního exportu a D1 hranice 1 999 900 bajtů serializovaného řádku. Žádné nové povinné atributy, katalogová služba ani externí infrastruktura.

Docker CI zachovává původní test z 0.5.3 a přidává 1.2.1. Označení image `99.0.0` je výhradně syntetický fixture pro test updateru, který správně odmítá nahrazení jiným commitem stejné verze. Nemění package verzi, nevytváří Git tag, release ani veřejnou image. Test porovnává celé řádky místností a přístupy hráčů, skutečnou výměnu kontejneru, rollback databáze, chybnou image a obnovu katalogových souborů.

## E. Výkon

Herní JSON projekce ani ETag infrastruktura se nemění. Přenosový přínos předchozí stabilizace není přeměřován pětiminutovým testem bez důvodu. Závěrečné porovnání velikosti klientského JS a běžných API odpovědí bude doplněno po finálním buildu. Odstraněné šablony nebyly v klientském grafu; nepředstíráme proto jejich zdrojovou velikost jako ušetřený síťový přenos.

## F. Připravenost k vydání

**Zatím NOT READY k označení vydání:** místní cílené scénáře prošly, ale závěrečné úplné kontroly a hostované Docker joby ještě nejsou uzavřené. Po jejich dokončení bude stanovisko nahrazeno výsledkem podloženým konkrétními běhy. Žádný známý potvrzený problém neřešíme přidáním herních funkcí nebo automatickým mazáním dat.
