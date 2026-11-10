# Bezpečnostní hlášení a hranice důvěry

Projekt je raná verze pro menší důvěryhodnou partu. Aktivně se udržuje současná větev `main`; starší vydání nemají garantovanou samostatnou bezpečnostní podporu. Samotná přítomnost posledního tagu nezaručuje podporu všech starších instalací.

## Jak nahlásit problém

Do veřejných issues nepřikládej skutečné herní tokeny, obnovovací klíče, hesla, interní/LiveKit tajemství, osobní údaje hráčů, databáze ani herní zálohy. Pro obyčejnou chybu použij smyšlený příklad a anonymizované kroky podle [návodu](docs/TROUBLESHOOTING.md#co-uvést-do-hlášení).

Zranitelnost oznam soukromě přes záložku Security, pokud je tato možnost v repozitáři dostupná. Jinak otevři issue pouze s žádostí o soukromý kontakt, bez návodu ke zneužití a citlivých dat. Uveď dotčený commit/verzi a runtime; konkrétní postup a důkazy předej soukromě. Zveřejnění podrobností domluvíme po opravě. Projekt nemá garantovanou dobu reakce ani peněžní program odměn.

## Co je a není oddělené

- Herní role se ověřují v API. Hráčský pohled nemá obsahovat tajnou mapu, statistiky příšer ani cizí soukromé deníky; tyto kontroly jsou součástí testů.
- Bestiář se načítá po ověření role PJ a klientský build se kontroluje na texty určené PJ. Součástí veřejného Git repozitáře jsou zdrojové předlohy. Tajná příprava konkrétní kampaně patří do stolu a jeho soukromých záloh. Schopnosti, bojové hodnoty a výbavu cizího deníku hráčské API neposílá.
- Herní token se uchovává v prohlížeči, v databázi je dostupný správci serveru. Obnovovací klíč se na serveru ukládá jako otisk; jeho použití rotuje herní přístup a vydá nový klíč. Samotná pozvánka umožňuje vytvořit novou postavu do kapacity místnosti.
- PJ je role v jedné kampani. Heslo `/admin` spravuje celou instalaci; není účtem PJ. Správce serveru/databáze má fyzický přístup k soukromému hernímu obsahu, i když není jeho příjemcem přes herní API.
- JSON export kampaně vynechává tokeny a otisky klíčů, ale obsahuje tajnou přípravu a chat. Snapshot celé databáze obsahuje i přístupy. Obě zálohy chraň jako soukromá data.
- Pouze updater má Docker socket. Přístup k němu je oprávnění ovládat Docker hostitele; updater ani jeho token nepublikuj hráčům. App kontejner socket nemá.
- Přehled, stažení a obnova snapshotů SQLite vyžadují relaci správce instalace. Obnova navíc vyžaduje potvrzení názvu zálohy a dostupný updater. Zálohy stahuj a ukládej jako citlivá data.
- Změnové požadavky administrace vyžadují cookie a správný `Origin`. Odhlášení zneplatní relaci na serveru. Všechny relace zanikají při restartu. Interní endpointy vyžadují vlastní Bearer token.
- Hlasový JWT je krátkodobý a umožňuje publikovat pouze mikrofon konkrétní identity v jedné místnosti. Jeho vypršení neodpojí existující hovor; okamžité serverové vykázání po archivaci postavy není implementované. Dodatečné koncové E2EE se v aplikaci nezapíná. Viz [hlas](docs/VOICE.md).

Workflow [Dependency audit](.github/workflows/dependency-audit.yml) kontroluje každý týden celý npm lockfile včetně nástrojů používaných při sestavení. Vypíše všechna hlášení a neprojde při vysoké nebo kritické závažnosti. Stejnou kontrolu lze spustit pomocí `npm audit --audit-level=high`.

## Provoz

Veřejný provoz vyžaduje HTTPS a odpovídající síťové nastavení; hlas navíc WSS a přímé RTC/TURN cesty. Neukládej tajemství do veřejného checkoutu nebo snímků obrazovky. Nativní Node start poslouchá na `0.0.0.0`; Docker Compose standardně publikuje aplikaci jen na loopbacku. Podrobnosti a zálohování jsou v [provozním návodu](docs/SELF_HOSTING.md).

Před reportem nebo opravou neprováděj pokusy proti cizím kampaním. Pro reprodukci použij vlastní izolovanou testovací databázi a syntetické postavy.
