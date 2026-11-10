# Vlastní server s Dockerem

[Dokumentace](README.md) · [Vývoj bez Dockeru](DEVELOPMENT.md#rychlý-start-node-bez-dockeru) · [Řešení problémů](TROUBLESHOOTING.md)

Tato varianta používá Node.js 22 a SQLite. Cloudflare účet není potřeba. Počítej přibližně se 2 GB volné RAM a několika GB disku pro sestavení image. Podporovaný je běžný Linux s rootful Docker Engine 28+ a Compose v2; rootless Docker, Swarm a více replik aplikace zatím nejsou podporované.

Tato dokumentace odpovídá vydání 1.2.8; vývojový `main` se může od stabilního vydání lišit. Pro stabilní instalaci zvol zdroje zamýšleného vydání a jeho dokumentaci; `git clone` bez přepnutí bere vývojový `main`. Po klonování můžeš před sestavením přepnout na konkrétní existující tag příkazem `git switch --detach <tag-vydání>`; zvolený tag nahraď označením z GitHub Release. Updater nabízí pouze stabilní GitHub Releases. Číslo verze samo nestačí k určení novosti vývojového buildu: porovnávej i commit a release notes.

## První spuštění

```sh
git clone --branch v1.2.8 --depth 1 https://github.com/cert4u/u-jednoho-stolu.git
cd u-jednoho-stolu
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

Do `.env` vlož dvě různé vygenerované hodnoty jako `STUL_ADMIN_PASSWORD` a `STUL_UPDATER_TOKEN`. Nastav `PUBLIC_ORIGIN` na finální adresu bez cesty, například `https://stul.example.cz`. Heslo správce má mít alespoň 20 znaků, token alespoň 32. Soubor chraň příkazem `chmod 600 .env`.

```sh
./deploy/stul.sh up -d --build
./deploy/stul.sh logs --tail=50
```

Pro místní vyzkoušení nastav `PUBLIC_ORIGIN=http://localhost:8080` a otevři tuto adresu. Na serveru nasměruj vlastní HTTPS reverzní proxy na `127.0.0.1:8080`, například Caddy:

```caddy
stul.example.cz {
    reverse_proxy 127.0.0.1:8080
}
```

Port aplikace se standardně váže pouze na localhost. Aplikaci a správu publikuj přes HTTPS. Pokud proxy běží v jiném kontejneru, uprav síť podle svého hostingu. Cesty `/internal/*` může proxy navíc blokovat; interní updater komunikuje přímo přes Docker síť. `/admin` lze omezit i na VPN.

## Konfigurace

Soubor `.env` připrav podle [příkladu](../.env.example). Změnu proměnných promítne **znovuvytvoření** kontejneru, nikoli samotný `restart`: `./deploy/stul.sh up -d --force-recreate app`. U hlasu vždy přidej oba soubory Compose podle [VOICE.md](VOICE.md).

| Proměnná | Účel / výchozí stav |
| --- | --- |
| `PUBLIC_ORIGIN` | Přesný vnější původ aplikace bez cesty; pro místní hru `http://localhost:8080`. Musí odpovídat prohlížeči, včetně protokolu a portu. |
| `STUL_ADMIN_PASSWORD` | Vlastní heslo `/admin`, alespoň 20 znaků; žádné výchozí. |
| `STUL_UPDATER_TOKEN` | Jiná tajná hodnota, alespoň 32 znaků, shodná pro aplikaci a updater. |
| `STUL_BIND`, `STUL_PORT` | Vazba Compose na hostiteli, výchozí `127.0.0.1:8080`; uvnitř app kontejneru zůstává port 8080. |
| `STUL_APP_CONTAINER` | Výchozí jméno `stul-app`; aplikace i updater se na něm musí shodnout. |
| `STUL_UPDATE_CHANNEL` | `stable` (výchozí), `preview` nebo `development`. |
| `STUL_BACKUP_KEEP` | Počet automatických záloh k ponechání po úspěšné operaci. `0` (výchozí) vypíná automatické mazání. |
| `STUL_APP_IMAGE` | Aktivní image, výchozí `stul-app:local`; updater ho zapisuje do `.stul-state/runtime.env`, které načítá wrapper. |
| `STUL_LIVEKIT_URL` | Volitelná adresa hlasu dostupná z prohlížečů, veřejně `wss://`. |
| `STUL_LIVEKIT_API_KEY`, `STUL_LIVEKIT_API_SECRET` | Volitelné hlasové klíče; tajemství alespoň 32 znaků, shodné s LiveKitem. |
| `STUL_LIVEKIT_CONFIG` | Cesta hostitele k YAML souboru pro hlasový overlay; výchozí `./deploy/livekit/local.yaml`. |

Node server mimo Docker navíc čte `PORT`, `STUL_DATA_DIR` a případně `STUL_UPDATER_URL`; Compose předává `STUL_UPDATER_URL=http://updater:8090` a Docker image má `STUL_DATA_DIR=/data`. Přidání těchto hodnot do `.env` je samo nepředá do kontejneru, pokud nejsou v jeho `environment`. Nativní server se váže na `0.0.0.0`, zatímco bezpečná výchozí hostitelská vazba `127.0.0.1` výše je vlastností Compose.

`GET /healthz` vrací verzi, plný commit, čas sestavení a příznak údržby. `ok: true` spolu s `maintenance: true` znamená dostupný proces, ale pozastavené herní zápisy. Heslo ani interní/hlasové klíče se přes tento endpoint nevracejí.

## Aktualizace z administrace

Otevři **`https://tvoje-adresa/admin`** a přihlas se vlastním `STUL_ADMIN_PASSWORD`. Neexistuje výchozí heslo. Toto heslo je oddělené od účtů PJ a hráčů. Odhlášení ihned zneplatní danou relaci na serveru. Restart aplikace ukončí všechny relace správce.

Přehled ukazuje verzi, commit, režim údržby, velikost databáze včetně WAL, volné místo na jejím volume a poslední zálohu. Podrobnosti o updateru, konfiguraci hostingu a nastavení hlasu najdeš ve **Nastavení serveru**.

| Kanál | Co může správce nainstalovat |
| --- | --- |
| Stable | Poslední stabilní GitHub Release označený `vX.Y.Z`. Doporučený kanál pro rozehrané kampaně. |
| Preview | Nejvyšší podporovanou verzi ze seznamu posledních 20 vydání, včetně prerelease. |
| Development | Výslovně zvolenou větev nebo plný commit z oficiálního GitHub repozitáře. Používej na zkušebním stole. Číslo verze u vývojového commitu nemusí vystihovat jeho stáří. |

Stable a Preview dovolí instalovat pouze vyšší verzi podle SemVer. Stejné číslo s jiným commitem vyžaduje nové vydání. Návrat je samostatná operace. Vývojovou větev nejdřív převeď na konkrétní commit tlačítkem **Ověřit commit**. Pokud se mezitím cíl změní, potvrď ho znovu.

1. Projdi poznámky z GitHub Release, uvedené požadavky a výsledek CI pro vybraný commit. Hodnota „neuvedeno“ znamená, že vydání údaj nedeklarovalo. Instalaci vždy potvrdí správce.
2. Updater sestaví image z ověřeného commitu a zkontroluje požadované verze updateru a hostingu. Během sestavování se dál hraje. GitHub, Docker Hub a npm musí být dostupné.
3. Aplikace přejde do údržby, dokončí rozpracované požadavky a uloží konzistentní snapshot SQLite včetně přístupů.
4. Updater vymění kontejner a ověří commit, integritu databáze, čtení herního API a dostupnost a ochranu administrace. Kontrola nepracuje s rozehranými kampaněmi. Teprve potom uvolní údržbu a označí operaci jako hotovou.
5. Při selhání kontroly se obnoví původní kontejner a databáze. Pokud updater ztratí odpověď při uvolňování údržby, pokračuje s již ověřenou verzí. Tím chrání změny, které mohly mezitím vzniknout. Jestliže se nedokončí ani obnova, panel vyžádá zásah správce.

Při výměně kontejneru se přihlas znovu. Průběh úlohy se načte z uloženého stavu. U návratu ke starému image bez nové kontroly služeb použije updater jeho `/healthz` a ověří commit.

Tlačítko **Vrátit předchozí verzi** obnoví databázi z doby před posledním upgradem. Novější změny se před návratem uloží do samostatné zálohy. Jde o jednu úroveň návratu. Uchovej i odpovídající image, pokud chceš starší snapshot obnovit ručně.

### Další spouštění Compose

Vždy používej `./deploy/stul.sh`, který načte také `.stul-state/runtime.env` s aktivním image. Běžný restart či spuštění:

```sh
./deploy/stul.sh restart
./deploy/stul.sh up -d
```

### Aktualizace updateru a konfigurace hostingu

Před přechodem ze staré infrastruktury si zkopíruj `.env`, `.stul-state` a databázi podle postupu níže. Získej zvolený a ověřený checkout přes Git. Potom spusť jen sestavení a výměnu updateru, bez závislých služeb.

```sh
./deploy/stul.sh up -d --build --no-deps updater
```

Stejným příkazem použiješ změnu kanálu nebo retence z `.env`. Spouštěj ho mimo probíhající aktualizaci nebo obnovu. V **Nastavení serveru** ověř protokol updateru a verzi konfigurace hostingu. První verze tohoto kontraktu je **1**. Updater porovnává požadavek sestaveného image s vlastní podporou a konfigurací Compose před vstupem do údržby. Aplikace s novou administrací vyžaduje updater s protokolem 1 pro webové operace. Dříve vydané aplikace mohou používat nový updater v režimu Stable.

Aktualizace v administraci vyměňuje aplikační kontejner. Checkout, Compose, updater a případný LiveKit spravuješ samostatně. Změny aplikačních proměnných nebo připojení volume prováděj plánovaně přes Compose s aktivním image z `.stul-state/runtime.env`.

#### Přechod z 1.0.0 na 1.1.0

V administraci vyber stabilní vydání 1.1.0 a ověř jeho commit a CI. Nové SQL migrace, proměnné, Compose ani updater nejsou potřeba. Před aktualizací uchovej úplnou zálohu a snapshot; po výměně ověř přihlášení PJ i hráče, stafáž, plochy a export/obnovu testovací kampaně. Zálohy jsou nadále ve formátu 1, nově s volitelnými poli `scenery` a `surfaces` ve všech mapách, paměti a historii. Staré zálohy fungují i bez těchto polí.

Při návratu updater obnoví také databázi před aktualizací. Pro obnovu nové JSON zálohy s dekoracemi použij 1.1.0 nebo novější; starší aplikace jejich zachování negarantuje. LiveKit a místní checkout se samostatně nemění.

#### Přechod z 0.6.0 na 1.0.0

V administraci zkontroluj vydání a zvol stabilní 1.0.0. Nastavení prostředí, protokol updateru a konfigurace hostingu se nemění, nové SQL migrace nejsou potřeba. Před výměnou vznikne snapshot databáze; po ní ověř přihlášení PJ i hráče, herní mapu a export úplné zálohy. LiveKit ani místní checkout se automaticky neaktualizují. Úplná JSON záloha zůstává ve formátu 1 a nově zahrnuje příběhovou osnovu, pokud ji používáš.

Návrat přes updater obnovuje také databázi do doby před upgradem. Novější změny zůstanou v samostatném snapshotu; při návratu ke starší aplikaci nepředpokládej, že zachová nově přidanou osnovu. Z instalace 0.5.3 nejprve proveď níže uvedenou aktualizaci updateru a Compose, potom pokračuj na 1.0.0.

#### Přechod z 0.5.3 na 0.6.0

1. Dokonči případnou operaci v administraci a zazálohuj databázi, `.env` a `.stul-state`.
2. V checkoutu instalace stáhni tag `v0.6.0` a přepni se na něj. Zachovej místní nastavení a případné vlastní úpravy Compose.
3. Spusť `./deploy/stul.sh up -d --build --no-deps updater`. Použije se konfigurace hostingu 1 a výchozí kanál Stable. U instalace s vlastním Compose overlay zachovej také parametry pro jeho načtení.
4. V dosavadní administraci otevři **Zkontrolovat vydání** a potvrď aktualizaci na 0.6.0. Po výměně se znovu přihlas a ověř verzi i přístup do stávající kampaně. V nové administraci se zobrazí protokol updateru 1 a verze konfigurace hostingu 1.

Provozní SQLite formát i export kampaně verze 1 lze použít dál. **Vrátit předchozí verzi** obnoví také snapshot z doby před výměnou. Updater po návratu zůstane na nově sestavené službě.

## Data a zálohy

- Docker volume `stul_data`: `game.sqlite`, WAL a `backups/*.sqlite`.
- `.stul-state/`: průběh aktualizace a aktivní image; adresář je chráněný režimem 700.
- `.env`: heslo správce, interní token, adresa instalace a případné hlasové klíče.

Zálohy obsahují soukromé poznámky a přístupové tokeny. Neukládej je do veřejného repozitáře. Výchozí retence je neomezená. Sleduj disk a pravidelně přenášej zálohy mimo server. Automatický snapshot na stejném disku nechrání proti ztrátě celého serveru. Při změně názvu projektu Compose se může změnit název volume; zachovej existující data. `down -v` databázi smaže.

### Správa snapshotů v administraci

V **Zálohy databáze** může správce vytvořit ruční konzistentní snapshot i během běžného provozu, projít stáří a velikost souborů a stáhnout je. **Obnovit databázi** je samostatná akce. Vyžaduje funkční updater, zadání přesného názvu souboru a krátkou údržbu. Před nahrazením databáze se uloží její současný stav. Úspěšná obnova nastaví nový výchozí stav a dřívější tlačítko pro návrat verze přestane nabízet zálohu z jiné historie kampaně.

Při `STUL_BACKUP_KEEP=5` updater po dokončené operaci ponechá pět nejnovějších automatických snapshotů, potřebnou zálohu pro návrat a bezpečnostní snapshot právě dokončené operace. Ruční zálohy retence vynechává. Stahuj důležité snapshoty mimo server i při zapnuté retenci.

### Dvě různé zálohy

| | Export kampaně JSON | Snapshot SQLite databáze |
| --- | --- | --- |
| Rozsah | Jedna kampaň, všechna patra, tajná příprava a chat. | Všechny místnosti včetně původních přístupových tokenů. |
| Kdo | PJ přes herní nabídku. | Správce, automaticky také updater před výměnou. |
| Obnova | Nová místnost a nové přístupy; hráčům PJ vydá nové klíče. | Původní databáze a přístupy; musí odpovídat běžící verzi kódu. |
| Přenos mezi runtime | JSON lze přenést mezi podporovanými instalacemi. | SQLite soubory z Node nejsou přímý import Cloudflare D1. |

Oba typy obsahují soukromý obsah. Snapshot databáze nenahrazuje kopii `.env`, `.stul-state` a připnutých konfigurací pro obnovu celého serveru. Aktivní hlasová spojení nejsou součástí ani jedné zálohy.

Pro obnovu po ztrátě serveru ulož celý volume, konfiguraci a aktivní image. Zálohuj mimo probíhající aktualizaci, obnovu nebo údržbu. Příklad pro základní Compose instalaci.

```sh
./deploy/stul.sh stop app updater
mkdir -p backups/manual
chmod 700 backups backups/manual
STUL_BACKUP_APP=$(./deploy/stul.sh ps -aq app)
test -n "$STUL_BACKUP_APP"
docker cp -a "$STUL_BACKUP_APP:/data/." backups/manual/data
STUL_BACKUP_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$STUL_BACKUP_APP")
docker image save -o backups/manual/app-image.tar "$STUL_BACKUP_IMAGE"
git rev-parse HEAD > backups/manual/checkout
cp -a compose.yaml backups/manual/
# Podle vlastnictví souborů může být pro tuto kopii potřeba oprávnění správce:
cp -a .env .stul-state backups/manual/
./deploy/stul.sh up -d
```

Pokud kopie nastavení selže na oprávněních, dokonči ji jako správce před označením zálohy za hotovou. Adresář `backups/manual` musí být pro novou zálohu nový/prázdný; předchozí kopii nepřekrývej. U hlasu používej oba Compose soubory a přidej i případný vlastní YAML a TLS konfiguraci. Zálohu bezpečně přenes mimo server a ověř zkušební obnovu do izolované instalace.

### Obnova na novém serveru

1. Obnov zaznamenaný Git checkout, vlastní soubory Compose, `.env`, `.stul-state`, reverzní proxy a případnou konfiguraci LiveKitu. Použij stejnou adresu instalace, pokud mají zůstat v platnosti dřívější odkazy a relace hráčů.
2. Načti uložený image pomocí `docker image load -i backups/manual/app-image.tar`. Vytvoř zastavený app kontejner příkazem `./deploy/stul.sh create app`. Překontroluj, že používá očekávaný image.
3. Zkopíruj obsah uloženého `data/.` do `/data/` zastaveného kontejneru pomocí `docker cp -a`. Ověř, že soubory databáze může číst a měnit UID/GID 1000. Udržuj původní volume i zdroj zálohy samostatně až do ověření.
4. Spusť aplikaci a updater a ověř verzi, přístup PJ i hráče a čitelnost kampaní. Pro použití předchozího návratu je nutný i jeho snapshot a původní image. Pokud chceš zachovat možnost tohoto návratu i po ztrátě serveru, ulož také předchozí image.

Alternativou pro jednotlivou kampaň je existující export v zápisníku PJ. Ten je přenositelný i z Cloudflare verze; obnova v Docker instalaci vytvoří novou místnost a nové přístupy. Přímé automatické přenesení databáze z hostované služby není součástí upgradu.

## Přerušení a ruční obnova

Po restartu updater z uloženého stavu dokončí potvrzenou výměnu, nebo obnoví původní verzi. Při chybě Dockeru či poškození disku může operace vyžadovat zásah správce. Podrobnosti jsou v administraci a v logu updateru. Oprav příčinu a zkus `./deploy/stul.sh restart updater`. Neodstraňuj ručně soubor `maintenance`, dokud není databáze a běžící verze ověřená.

Při ruční obnově:

1. Zastav aplikaci i updater. Poznamenej si aktivní a předchozí image ze stavového souboru.
2. Zálohuj současný volume a `.stul-state`.
3. Do `game.sqlite` vrať vybraný snapshot. Odstraň příslušné `game.sqlite-wal` a `game.sqlite-shm`; obnovuj pouze při zastavené aplikaci. Data musí být zapisovatelná uživatelem UID/GID 1000.
4. Do `.stul-state/runtime.env` nastav odpovídající `STUL_APP_IMAGE=stul-app:<commit>` (případně původní `stul-app:local`). Stavovou úlohu odlož mimo aktivní `state.json`, aby updater neopakoval dokončenou obnovu.
5. Spusť aplikaci, ověř `/healthz`, herní data a správnou verzi. Teprve potom odstraň příznak údržby a spusť updater.

## Důvěra a oprávnění

Pouze updater má Docker socket. Přístup k němu znamená správu celého Docker hostitele; službu nepublikuj na internet a nedávej její token hráčům. Aktualizace spouští kód vydaný správcem repozitáře `cert4u/u-jednoho-stolu`; před potvrzením si přečti poznámky k vydání. App kontejner běží jako uživatel `node` a socket nemá. Správa instalace používá samostatné heslo, HttpOnly/SameSite cookie a kontrolu původu změnových požadavků.

Oficiální podklady: [Docker a ochrana daemonu](https://docs.docker.com/engine/security/protect-access/), [sestavení ze zdrojů v Git](https://docs.docker.com/build/concepts/context/#git-repositories), [GitHub Releases API](https://docs.github.com/en/rest/releases/releases).

## Volitelné hlasové volání

Pro čistě hlasový hovor přidej LiveKit podle [návodu Hlas družiny](VOICE.md). `compose.voice.yaml` je volitelný doplněk; běžná hra jej nevyžaduje. Aplikace potřebuje tři proměnné `STUL_LIVEKIT_*`, které aktualizátor při výměně kontejneru zachová. Hlasový server se spravuje samostatně.

## Místní knihovna katalogů

Verze 1.2.0 přidává migrace `0001_catalog_library.sql` a `0002_catalog_updated_at.sql`, místní SQLite katalogy a persistentní `catalog-assets` pod `STUL_DATA_DIR`. Zachovej celý datový volume. Úplná serverová záloha ZIP zahrnuje databázi i obrázky; samotný SQLite export obrázky knihovny nezahrnuje. [Postup správy a obnovy](CATALOG_LIBRARY.md#uložení-a-zálohy). Cloudflare zatím používá vestavěné katalogy, nikoli dynamickou administraci knihovny.

## Přechod z 1.1.0 na 1.2.0

Před aktualizací uschovej konzistentní databázový snapshot a potřebnou konfiguraci podle návodu výše. Verze 1.2.0 při startu automaticky aplikuje nové migrace `0001_catalog_library.sql` a `0002_catalog_updated_at.sql`; již aplikované migrace se nemění. Po restartu ověř existující kampaň i sekci **Katalogy** v `/admin`.

Není potřeba nová proměnná prostředí, změna Compose ani přestavba updateru. Zachovej celý datový volume: obrázky nových katalogů leží v `STUL_DATA_DIR/catalog-assets`, nikoli v image aplikace. Nové snapshoty mají obrázkový soubor vedle SQLite; pro přenos celé instalace stahuj **Úplná záloha ZIP**. Samotný SQLite download neobsahuje soubory knihovny.

Návrat na starší image vrací i databázi do snapshotu před aktualizací; novější katalogy a kampaně se tak z tohoto pohledu vrátí v čase. Před návratem zachovej i aktuální kompletní data. Novou katalogovou zálohu kampaně obnovuj aplikací 1.2.0 nebo novější. Cloudflare nadále podporuje vestavěné katalogy a přenesené podklady kampaně, nikoli dynamickou administraci knihovny.

## Přechod z 1.2.0 na 1.2.1

V administraci vyber stabilní vydání 1.2.1 a ověř jeho commit a CI. Nejsou potřeba nové SQL migrace, proměnné prostředí, změna Compose ani přestavba updateru. Zachovej celý datový volume a obvyklou zálohu před výměnou. Z 1.1.0 nebo starší verze se nadále aplikují dřívější migrace knihovny podle předchozího návodu.

Po aktualizaci obnov stránku `/admin`, aby se načetly nové klientské skripty. **Přidat katalog z GitHubu** zobrazí formulář uvnitř stránky; vstupy ani potvrzení už nevyužívají systémové `prompt()`/`confirm()`. Ověř otevření i zrušení dialogu, náhled importu, přepínání obsahu a stránkování katalogu. Rozdělení interního servisu nemění databázové tabulky, API ani uložená data.

Heslo správce je nadále hodnota `STUL_ADMIN_PASSWORD` tvé instalace; projekt nemá společné výchozí heslo. Administraci otevírej na adrese běžící služby, například `http://localhost:8080/admin`, nikoli jako soubor `server/admin.html` z disku. Samostatné spuštění přes Node nezahrnuje Docker updater.

## Přechod z 1.2.1 na 1.2.2

1. Vytvoř úplnou serverovou ZIP zálohu, uchovej konfiguraci a image 1.2.1. Ověř možnost obnovy mimo rozehranou instalaci.
2. V administraci updateru vyber stabilní vydání 1.2.2 a potvrď konkrétní commit. Při ručním nasazení sestav zdroje tagu `v1.2.2` a zachovej celý datový volume včetně `catalog-assets`.
3. Node/Docker při startu automaticky aplikuje `0003_room_admission.sql`. Na Cloudflare aplikuj nové D1 migrace běžným postupem před spuštěním nového Workeru. Formát přenositelné zálohy zůstává 1.
4. Obnov stránku aplikace i `/admin`. Ověř přístup PJ/hráče, existující mapu, zprávy a export testovací kampaně. Před návratem na starší verzi uchovej i data vzniklá po aktualizaci; viz rollback níže.

Nové proměnné `STUL_ROOM_CREATE_RATE`, `STUL_ROOM_LIMIT` a `STUL_ROOM_BYTES_LIMIT` jsou volitelné. Bez jejich nastavení platí níže uvedené výchozí hodnoty. Není nutná přestavba updateru ani nová služba. Aktualizace aplikace přes updater sama nepřepisuje checkout, `.env` ani Compose soubor. Chceš-li vlastní kvóty nastavovat přes `.env`, převezmi také odpovídající předání proměnných z Compose vydání 1.2.2 a znovu vytvoř kontejner aplikace při zachování datového volume.

[Změny vydání](../CHANGELOG.md#122--2026-11-08) · [Výsledky a omezení ověření](FINAL_STABILIZATION.md).

## Přechod z 1.2.2 na 1.2.3

Vytvoř úplnou serverovou ZIP zálohu včetně katalogových obrázků, uchovej konfiguraci a odpovídající image. Potom vyber stabilní vydání 1.2.3 a jeho ověřený commit v administraci updateru; při ručním sestavení použij tag `v1.2.3`. Zachovej celý datový volume. Nejsou potřeba nové SQL migrace, proměnné prostředí, změna Compose, LiveKitu ani přestavba updateru. Z 1.2.1 nebo starší verze nadále platí dřívější migrační kroky popsané výše.

Po aktualizaci obnov stránku aplikace a `/admin`. Ověř původní kampaň, obrázky, přepnutí nástroje, posun/zoom a ztišení skic pod mapou. Refaktor zachovává pravidla, generátor V2, formát záloh a katalogové balíčky. Úplné zálohy neobsahují žádné nové povinné atributy.

Podporovaný rollback vrací odpovídající image i databázový snapshot. Před návratem zachovej také data vzniklá po aktualizaci; nejde o sloučení novějších změn do staršího snapshotu. [Změny a rozsah úklidu](CLEANUP.md).

## Přechod z 1.2.3 na 1.2.4

Vytvoř úplnou serverovou ZIP zálohu, uchovej konfiguraci a zachovej celý datový volume. Vyber stabilní vydání 1.2.4 v administraci updateru; při ručním sestavení použij tag `v1.2.4`. Přechod nevyžaduje SQL migraci, změnu konfigurace ani přestavbu updateru nebo LiveKitu. Formát záloh se nemění.

Po aktualizaci obnov herní stránku i `/admin`. Ověř přihlášení, otevření mapy a posun obsahu v dialogu. Podporovaný rollback vrací image i databázový snapshot z doby před aktualizací. [Změny vydání](../CHANGELOG.md#124--2026-11-09).

## Přechod z 1.2.7 na 1.2.8

Před aktualizací vytvoř úplnou serverovou ZIP zálohu a uchovej konfiguraci. V administraci zvol stabilní vydání 1.2.8 nebo při ruční aktualizaci sestav aplikaci ze značky `v1.2.8`. Ponech připojený celý datový volume. Stačí výměna aplikace, konfigurace i updater zůstávají kompatibilní a SQL migrace nejsou potřeba.

Po výměně se znovu přihlas do administrace. Ověř export a obnovu kopie kampaně, zejména pokud má dlouhý archiv postav nebo rozpracovaný boj. Formát přenositelné zálohy zůstává 1. Nová verze zachová i rozsáhlejší historické odměny, které 1.2.7 při exportu odmítala. Při rollbacku použij předaktualizační snapshot databáze. [Změny vydání](../CHANGELOG.md#128--2026-11-10).

## Přechod z 1.2.6 na 1.2.7

Vytvoř úplnou serverovou ZIP zálohu a uchovej konfiguraci. Potom v administraci vyber vydání 1.2.7. Při ruční aktualizaci použij značku `v1.2.7` a zachovej celý datový volume. Stačí aktualizovat samotnou aplikaci.

## Přechod z 1.2.5 na 1.2.6

Před aktualizací vytvoř úplnou serverovou ZIP zálohu a uchovej konfiguraci. V administraci vyber stabilní vydání 1.2.6. Při ruční aktualizaci sestav aplikaci ze značky `v1.2.6` a ponech připojený celý datový volume. Přechod nevyžaduje migraci, změnu konfigurace Compose ani přestavbu updateru nebo LiveKitu.

## Přechod z 1.2.4 na 1.2.5

Před aktualizací vytvoř úplnou serverovou ZIP zálohu a uchovej konfiguraci. Vyber stabilní vydání 1.2.5 v administraci updateru nebo při ručním sestavení použij tag `v1.2.5`. Zachovej celý datový volume. Přechod nevyžaduje SQL migraci, změnu Compose ani přestavbu updateru nebo LiveKitu. Formát záloh zůstává stejný.

Po aktualizaci obnov aplikaci i `/admin` a zkontroluj, že jde otevřít existující kampaň a detail katalogu. Podporovaný rollback vrací také databázi ze snapshotu před aktualizací. [Změny vydání](../CHANGELOG.md#125--2026-11-09).

## Ochrany stabilizační větve

Tyto ochrany jsou součástí vydání 1.2.2. Nová migrace `0003_room_admission.sql` přidává datum vzniku místnosti a index; staré místnosti zachovává s hodnotou 0. Node ji aplikuje při startu, pro D1 použij obvyklý migrační postup. Před nasazením uchovej úplnou serverovou ZIP zálohu a odpovídající image.

| Proměnná | Výchozí hodnota | Význam |
| --- | --- | --- |
| `STUL_ROOM_CREATE_RATE` | `100` | Nové a obnovené kampaně za posledních 60 sekund, společný limit instalace. |
| `STUL_ROOM_LIMIT` | `1000` | Nejvyšší počet místností; žádné automatické mazání. |
| `STUL_ROOM_BYTES_LIMIT` | `256000000` | Součet UTF-8 bajtů uloženého JSON místností. Platí také pro růst kampaní. |

Hodnoty musejí být kladná bezpečná celá čísla; neplatná nebo chybějící hodnota použije výchozí nastavení. `0` ochranu nevypíná. Compose předává tyto proměnné aplikaci a updater zachovává prostředí původního kontejneru. Úpravu `.env` použije nově vytvořený kontejner aplikace; samotný restart starého kontejneru jeho prostředí nezmění.

Na Cloudflare se stejné hodnoty nastavují jako runtime proměnné/bindingy Workeru (nikoli jako veřejné klientské proměnné). Bez nich platí stejné výchozí hodnoty. Atomická SQLite/D1 podmínka zamezuje závodu mezi současnými zakládáními a růstem dat. Žádný režim nedůvěřuje `X-Forwarded-For` ani jiným dodaným IP hlavičkám.

Při vyčerpané četnosti se vrací 429, při vyčerpané kapacitě 503; obě odpovědi uvádějí opakování za 60 sekund. Navýšení kapacity je rozhodnutí správce. Pokud správce sníží limit pod současné využití, čtení a zápisy zmenšující či zachovávající velikost dat fungují dál.

Node navíc odmítá herní POST při méně než 16 000 000 volných bajtech na datovém volume. Cloudflare nemá lokální diskový senzor; používá datovou kvótu a chyby D1. D1 navíc omezuje celý řádek na 2 000 000 bajtů; aplikace proto před zápisem kontroluje nejvýše 1 999 900 bajtů serializované místnosti a ponechává rezervu na ID, číselné sloupce a SQLite hlavičku. Tento provozní limit zahrnuje i přístupová pole, není to přímo velikost exportovaného souboru. Větší platný JSON formátu 1 lze obnovit na Node/Docker, nikoli do jediného řádku D1. Viz [oficiální limity D1](https://developers.cloudflare.com/d1/platform/limits/). Kvóta JSON nezahrnuje obrázky katalogů, serverové zálohy, WAL ani ostatní soubory. Pro veřejný server proto sleduj i skutečné volné místo a nastav limity těla požadavku/četnosti v reverzní proxy. Aplikační ochrana není úplná obrana proti distribuovanému síťovému zahlcení. Odmítnutí a selhání herního zápisu logují pouze provozní kategorii, bez herních textů a tokenů.

Úplná serverová ZIP záloha zůstává oddělená od 3MB přenositelného JSON exportu kampaně. Již nadlimitní historická kampaň se nemaže: zachraň ji serverovou zálohou (na Cloudflare nativním exportem D1) a zmenši ji explicitní úpravou PJ, která se vejde do limitu. Export nadlimitního či neplatného JSON nepředstírá úspěch.

[Podrobný stabilizační audit a stav ověření](STABILIZATION_AUDIT.md).

### Rollback finální stabilizace na 1.2.1

Migrace `0003_room_admission.sql` přidává sloupec s výchozí hodnotou a index. Lokální regresní test ověřuje byte-for-byte zachování všech řádků místností, tokenů, hráčů, příběhu a připnutých obrázků po aktualizaci a restartu. Samotný starý runtime 1.2.1 umí aditivní schéma otevřít, ale podporovaný návrat přes updater obnovuje také konzistentní předaktualizační snapshot a odpovídající image. Změny odehrané po snapshotu tím z hlavní databáze zmizí; updater je před návratem uchová v nové záloze. Proto nezaměňuj kompatibilitu otevření SQLite s bezztrátovým sloučením nových a starých herních dat.

Před upgradem uchovej úplnou serverovou zálohu včetně katalogových obrázků a konfigurace. Snížení kvót neodstraní existující místnosti. Při nedostatku disku se herní zápis odmítne, nikoli částečně uloží. [Aktuální výsledky lokálního a Docker ověření](FINAL_STABILIZATION.md).

Mapy v 1.2.3 lze ručně rozšířit na 56 × 40 polí. Generátor ponechává 28 × 20. Zálohy mají stále formát 1, ale starší aplikace mapu s novými souřadnicemi mimo 28 × 20 odmítne; pro návrat použij původní předaktualizační zálohu.
