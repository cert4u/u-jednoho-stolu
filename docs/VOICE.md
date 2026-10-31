# Hlas družiny (volitelný LiveKit)

[Dokumentace](README.md) · [Hosting](SELF_HOSTING.md) · [Řešení problémů](TROUBLESHOOTING.md#hlasový-hovor)

Každý herní stůl má vlastní hlasovou místnost. Panel **Hlas družiny** je u chatu. Hráč zvolí **Připojit k hovoru**; připojí se s vypnutým mikrofonem. Potom může mikrofon zapnout, ztlumit poslech, vybrat vstupní zařízení nebo odejít. Jména a zvýraznění ukazují účastníky a mluvící. Při odchodu od stolu nebo změně přístupu se hovor odpojí.

Aplikace používá pouze mikrofon. Správce LiveKit serveru je součástí důvěryhodné infrastruktury; aplikace nezapíná dodatečné koncové E2EE. Server vydává token s právem publikovat jen zdroj `microphone`, bez kamery, sdílení obrazovky, datových zpráv, správy místnosti nebo nahrávání. Nepřidáváme záznam ani přepis hovoru. Klíče jsou pouze na serveru; krátkodobý token se neukládá do kampaně ani localStorage. Hovor funguje odděleně od chatového šeptání: šeptání v chatu nezmění, komu je slyšet hlas.

## Nastavení aplikace

Do `.env` přidej:

```dotenv
STUL_LIVEKIT_URL=ws://localhost:7880
STUL_LIVEKIT_API_KEY=<vlastni-klic>
STUL_LIVEKIT_API_SECRET=<vlastni-tajemstvi-alespon-32-znaku>
STUL_LIVEKIT_CONFIG=./deploy/livekit/local.yaml
```

Klíč vygeneruj například `openssl rand -hex 12`, tajemství `openssl rand -hex 32`. Obě hodnoty musí odpovídat konfiguraci LiveKitu. Aplikace přijímá veřejné `wss://` adresy; nešifrované `ws://` dovoluje jen pro localhost/loopback. Adresa musí být dostupná **z prohlížeče hráče**, ne pouze z Docker sítě. Pokud konfigurace chybí, hra funguje dál a panel vysvětlí, že volání není nastavené.

## Lokální Docker na Linuxu

```bash
./deploy/stul.sh -f compose.yaml -f compose.voice.yaml up -d
```

Předtím dokonči první sestavení aplikace podle [hostingu](SELF_HOSTING.md#první-spuštění). Hlas můžeš přidat k existující instalaci tímto příkazem bez nového buildu aplikace. Wrapper načítá aktivní image po aktualizaci; přímé `docker compose` ho nemusí zachovat. Pro první sestavení z aktuálně zvolených zdrojů lze přidat `--build`, ale nikdy nebuildovat starý checkout po webovém upgradu.

Pro další spouštění, logy a změny prostředí zachovej overlay:

```bash
./deploy/stul.sh -f compose.yaml -f compose.voice.yaml ps
./deploy/stul.sh -f compose.yaml -f compose.voice.yaml logs --tail=100 livekit
./deploy/stul.sh -f compose.yaml -f compose.voice.yaml up -d --force-recreate app
```

Volitelný soubor přidá připnutý LiveKit server v1.13.11 v hostitelské síti. Výchozí `local.yaml` používá loopback pro signalizaci i média a limit 12 účastníků. Otevři aplikaci na `http://localhost:8080`; každý účastník testu musí být na stejném počítači. Tento profil neslouží pro další počítače v LAN ani veřejný internet.

Bez Dockeru lze použít oficiální binárku LiveKitu s `--config deploy/livekit/local.yaml`. Proměnná `LIVEKIT_KEYS` musí obsahovat `<klic>: <tajemstvi>`. Aplikaci nejprve sestav pomocí `npm run build:node` a spusť s jejími třemi `STUL_LIVEKIT_*` proměnnými. Pro `.env` použij `node --env-file=.env server/start.mjs`; samotné `npm run start:node` soubor prostředí nenačítá. Potřebuješ i základní heslo správce a interní token podle [nativního startu](DEVELOPMENT.md#rychlý-start-node-bez-dockeru). Nestartuj veřejný server v režimu `--dev`.

## Veřejný server

1. Nastav HTTPS pro herní aplikaci a vlastní doménu hovoru, například `hlas.example.cz`, s důvěryhodným certifikátem.
2. Nastav `STUL_LIVEKIT_URL=wss://hlas.example.cz` a `STUL_LIVEKIT_CONFIG=./deploy/livekit/public.yaml`.
3. Reverzní proxy musí směrovat HTTPS a WebSocket na místní port 7880. Například Caddy:

   ```caddy
   hlas.example.cz {
       reverse_proxy 127.0.0.1:7880
   }
   ```

4. Povol pro média přímo na hostiteli UDP 7882 a TCP 7881; HTTPS proxy na 443 média nepřenáší. Port 7880 ponech firewallem dostupný jen reverzní proxy. U serveru za NAT zajisti přesměrování a správnou veřejnou IP; `public.yaml` používá její automatické zjištění.
5. Pro firemní a jiné omezené sítě připrav TURN, ideálně TURN/TLS. V šabloně je komentovaný příklad s porty 3478/UDP a 5349/TCP; potřebuje doménu, certifikáty a jejich read-only připojení do kontejneru. Sítě povolující jen TCP 443 mohou vyžadovat TURN/TLS právě na portu 443 a samostatnou IP nebo vhodné rozdělení provozu. Samotný výchozí profil tento fallback neposkytuje.
6. Spusť Compose s oběma soubory. Po změně klíčů nebo URL znovu vytvoř i aplikaci.

Mikrofon vyžaduje souhlas uživatele a HTTPS, s výjimkou lokálního localhostu. Počítej s ručním testem ze dvou skutečných zařízení a různých sítí včetně přenosu zvuku, ztlumení a obnovy spojení.

Přístup se ověřuje podle členství ve hře. Vydaný token platí pro nové připojení 120 sekund. Jeho vypršení samo neukončí již navázaný hovor; odvolání přístupu přes herní aplikaci odpojí běžného klienta při aktualizaci přihlášení, ale není serverovým vykázáním účastníka z LiveKitu. Pro okamžité vynucené vykázání je potřeba doplnit serverovou moderaci. Hlasové místnosti a připojení nejsou součástí zálohy kampaně.

LiveKit je samostatná služba; aktualizátor herní aplikace zachovává její proměnné, ale server LiveKitu aktualizuješ samostatně změnou připnutého image. Ověř nasazení podle [oficiální dokumentace](https://docs.livekit.io/transport/self-hosting/deployment/) a [portů/firewallu](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

## Ověření skutečného přenosu zvuku

Běžné `test:hosting` testuje přístupy, podpis a omezení tokenů i chování bez konfigurace. Pro oddělený lokální testovací server s nastaveným LiveKitem lze navíc spustit syntetický přenos bez mikrofonu a reproduktorů:

```bash
npm install --prefix /tmp/stul-voice-media --no-audit --no-fund @livekit/rtc-node
STUL_RTC_SDK=/tmp/stul-voice-media/node_modules/@livekit/rtc-node/dist/index.js \
  node scripts/test-voice-media.mjs http://127.0.0.1:18089
```

Test vytvoří vlastní místnost a dvě postavy, vydá vstupenky přes herní API a ověří příjem nenulových zvukových vzorků druhým klientem. Spouštěj jej proti testovací databázi. Nenahrazuje zkoušku reálných mikrofonů a veřejného připojení.
