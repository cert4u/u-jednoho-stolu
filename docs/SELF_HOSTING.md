# Vlastní server s Dockerem

Tato varianta používá Node.js 22 a SQLite. Cloudflare účet není potřeba. Počítej přibližně se 2 GB volné RAM a několika GB disku pro sestavení image. Podporovaný je běžný Linux s rootful Docker Engine 28+ a Compose v2; rootless Docker, Swarm a více replik aplikace zatím nejsou podporované.

## První spuštění

```sh
git clone https://github.com/cert4u/u-jednoho-stolu.git
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

## Aktualizace z administrace

Otevři **`https://tvoje-adresa/admin`** a přihlas se heslem správce instalace. Toto heslo je oddělené od účtů PJ a hráčů.

1. Administrace nabídne poslední stabilní GitHub Release s tagem `vX.Y.Z`. Kontrola je krátce cachovaná; GitHub může při vyčerpání veřejného API limitu vrátit chybu, což rozehraný stůl neovlivní.
2. Po kliknutí na **Aktualizovat** updater sestaví image z přesného commitu vydání. Při sestavování se dál hraje. Stahování i build vyžadují internet (GitHub, Docker Hub a npm).
3. Poté aplikace pozastaví změny, dokončí rozběhlé požadavky a uloží konzistentní zálohu celé SQLite databáze, včetně přístupů hráčů.
4. Updater vymění kontejner a ověří start i identitu nové verze. Po úspěchu se opět povolí změny. Při neúspěchu obnoví předchozí image a databázi.

Stránka správy může při výměně kontejneru na chvíli ztratit spojení. Po startu se znovu přihlas (relace se záměrně neuchovává mezi restarty). Průběh úlohy je uložený na disku a znovu se zobrazí. Aktualizace se nespouští automaticky a nikdy nebere rozpracovaný `main` místo vydání.

Tlačítko **Vrátit předchozí verzi** obnoví také databázi z okamžiku před posledním upgradem. Novější změny se před návratem uloží do další samostatné zálohy. Jde o jednu úroveň návratu; starší zálohy zůstávají pro ruční obnovu. Zastavené původní kontejnery se odstraní, image se zachová.

### Další spouštění Compose

Vždy používej `./deploy/stul.sh`, který načte také `.stul-state/runtime.env` s aktivním image. Běžný restart či spuštění:

```sh
./deploy/stul.sh restart
./deploy/stul.sh up -d
```

Po aktualizaci přes administraci nespouštěj `up --build` ze starého checkoutu: sestavil by staré zdroje. Zdrojový checkout a samotná služba updateru se přes web nemění. Jejich údržba je ruční: získej odpovídající vydání přes Git, ponech `.env` a `.stul-state` a sestav jen updater (`./deploy/stul.sh up -d --build --no-deps updater`). Nová vydání musí případnou změnu způsobu nasazení uvést v poznámkách.

## Data a zálohy

- Docker volume `stul_data`: `game.sqlite`, WAL a `backups/*.sqlite`.
- `.stul-state/`: průběh aktualizace a aktivní image; adresář je chráněný režimem 700.
- `.env`: heslo správce, interní token a adresa instalace.

Zálohy obsahují soukromé poznámky a přístupové tokeny. Neukládej je do veřejného repozitáře. Zálohy se samy nemažou: sleduj disk a pravidelně je přenášej mimo server. Automatický snapshot na stejném disku nechrání proti ztrátě celého serveru. Při změně názvu projektu Compose se může změnit název volume; zachovej existující data. `down -v` databázi smaže.

Před plánovanou ruční zálohou je nejsnazší zastavit aplikaci a zkopírovat celý volume. Alternativou pro jednotlivou kampaň je existující export v zápisníku PJ. Ten je přenositelný i z Cloudflare verze; obnova v Docker instalaci vytvoří novou místnost a nové přístupy. Přímé automatické přenesení databáze z hostované služby není součástí upgradu.

## Přerušení a ruční obnova

Po restartu updater z uloženého stavu dokončí potvrzenou výměnu, nebo obnoví původní verzi. Při chybě Dockeru či poškození disku ponechá stůl v údržbě a vypíše důvod v administraci/logu. Oprav příčinu a zkus `./deploy/stul.sh restart updater`. Neodstraňuj ručně soubor `maintenance`, dokud není databáze a běžící verze ověřená.

Při ruční obnově:

1. Zastav aplikaci i updater. Poznamenej si aktivní a předchozí image ze stavového souboru.
2. Zálohuj současný volume a `.stul-state`.
3. Do `game.sqlite` vrať vybraný snapshot. Odstraň příslušné `game.sqlite-wal` a `game.sqlite-shm`; obnovuj pouze při zastavené aplikaci. Data musí být zapisovatelná uživatelem UID/GID 1000.
4. Do `.stul-state/runtime.env` nastav odpovídající `STUL_APP_IMAGE=stul-app:<commit>` (případně původní `stul-app:local`). Stavovou úlohu odlož mimo aktivní `state.json`, aby updater neopakoval dokončenou obnovu.
5. Spusť aplikaci, ověř `/healthz`, herní data a správnou verzi. Teprve potom odstraň příznak údržby a spusť updater.

## Důvěra a oprávnění

Pouze updater má Docker socket. Přístup k němu znamená správu celého Docker hostitele; službu nepublikuj na internet a nedávej její token hráčům. Aktualizace spouští kód vydaný správcem repozitáře `cert4u/u-jednoho-stolu`; před potvrzením si přečti poznámky k vydání. App kontejner běží jako uživatel `node` a socket nemá. Správa instalace používá samostatné heslo, HttpOnly/SameSite cookie a kontrolu původu změnových požadavků.

Oficiální podklady: [Docker a ochrana daemonu](https://docs.docker.com/engine/security/protect-access/), [sestavení ze zdrojů v Git](https://docs.docker.com/build/concepts/context/#git-repositories), [GitHub Releases API](https://docs.github.com/en/rest/releases/releases).
