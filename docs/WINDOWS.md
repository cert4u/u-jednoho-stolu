# U jednoho stolu pro Windows

Přenosný prototyp pro Windows 11 x64 spojuje herní server a jeho rozhraní v jednom staženém souboru. Electron se při spuštění automaticky rozbalí do dočasné složky.

1. [Stáhni přenosný soubor pro Windows](https://github.com/cert4u/u-jednoho-stolu/releases/download/v1.4.0/u-jednoho-stolu-1.4.0-windows-x64-portable.exe) a spusť ho dvojklikem. Po rozbalení se stůl otevře ve vlastním okně.
2. V nabídce **Stůl** najdeš **Administrace**, **Zobrazit heslo správce**, **Otevřít složku s daty** a **Jak spustit a hrát**. Zavřením okna ukončíš také server.

Aplikace při prvním spuštění vygeneruje heslo správce. Nastavení, databáze, obrázky a zálohy jsou v `%APPDATA%\U jednoho stolu\Stul`. Před aktualizací vytvoř zálohu v administraci, zavři aplikaci a spusť nové `.exe` pod stejným uživatelem Windows. Stejnou složku s daty používá i starší varianta ze ZIPu.

## Připojení družiny

Pro první zkoušku na jednom počítači stačí spustit aplikaci. Výchozí adresa je `http://127.0.0.1:8080`. Pro více počítačů potřebuješ společnou HTTPS adresu, kterou otevře hostitel i hráči. Port **TCP 443** obsluhuje HTTPS přes Caddy. Port **8080** slouží místnímu spojení mezi Caddy a aplikací.

### Hra ve stejné domácí síti

1. Na hostitelských Windows spusť `ipconfig` a zjisti IPv4 adresu připojeného adaptéru Wi-Fi nebo Ethernet. Níže je příklad `192.168.1.50`. Použij svou skutečnou adresu a domácí síť nastav ve Windows jako **Soukromou**.
2. Stáhni a rozbal `caddy.exe` pro Windows x64. Vedle něj vytvoř soubor `Caddyfile` bez přípony a vlož následující konfiguraci. Adresu nahraď vlastní a při změně portu aplikace uprav také `8080`. [Instalace Caddy](https://caddyserver.com/docs/install#static-binaries)

   ```caddyfile
   {
       auto_https disable_redirects
   }

   https://192.168.1.50 {
       tls internal
       @internal path /internal /internal/*
       respond @internal 404
       reverse_proxy 127.0.0.1:8080
   }
   ```

3. **Povol příchozí HTTPS.** V PowerShellu spuštěném jako správce zadej následující příkaz. Platí pro zařízení ve stejné podsíti a pro soukromý profil. Po hraní můžeš pravidlo odebrat příkazem `Remove-NetFirewallRule -Name StulHttpsLan`. [Dokumentace Windows Firewallu](https://learn.microsoft.com/powershell/module/netsecurity/new-netfirewallrule)

   ```powershell
   New-NetFirewallRule -Name StulHttpsLan -DisplayName "U jednoho stolu (LAN HTTPS)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Private -RemoteAddress LocalSubnet
   ```

4. V běžném PowerShellu ve složce s Caddy spusť `.\caddy.exe run --config .\Caddyfile` a okno nech otevřené. Caddy vytvoří místní certifikační autoritu. Z `%APPDATA%\Caddy\pki\authorities\local\` zkopíruj hráčům pouze veřejný soubor `root.crt`. Na hostiteli i v prohlížečích hráčů musí být tento certifikát důvěryhodný. Na Windows ho uživatel může přidat do svého úložiště důvěryhodných kořenů příkazem níže, spuštěným ve složce se souborem. Instalujte pouze certifikát od svého hostitele. Soukromý klíč Caddy patří hostiteli. [Místní HTTPS v Caddy](https://caddyserver.com/docs/automatic-https#local-https) · [Import certifikátu ve Windows](https://learn.microsoft.com/powershell/module/pki/import-certificate)

   ```powershell
   Import-Certificate -FilePath .\root.crt -CertStoreLocation Cert:\CurrentUser\Root
   ```

5. V aplikaci otevři **Stůl → Otevřít složku s daty**. Ukonči aplikaci, v `nastaveni.json` změň hodnotu `publicOrigin` na stejnou HTTPS adresu, například `"publicOrigin": "https://192.168.1.50"`, a znovu spusť aplikaci. Z druhého počítače otevři stejnou adresu v prohlížeči. Doma router pro tento postup nepotřebuje přesměrování portů.

Na druhém počítači můžeš zkusit `Test-NetConnection 192.168.1.50 -Port 443`. Když test TCP selže, zkontroluj IP adresu, privátní profil, pravidlo firewallu a běh Caddy. **502** obvykle znamená, že Caddy běží, ale aplikace je zavřená nebo má jiný port. Varování certifikátu řeš instalací správného kořenového certifikátu.

### Kamarádi mimo domácí síť

Pokud už máte **vlastní VPN**, připojte k ní všechny hráče a použijte HTTPS adresu dostupnou z VPN. Při použití výše uvedeného postupu s Caddy nahraď domácí IP adresou hostitele ve VPN a ve firewallu nastav `RemoteAddress` na rozsah či adresy hráčů ve VPN a `Profile` podle profilu daného adaptéru.

Pro **přímé připojení z internetu** potřebuješ veřejnou IPv4 adresu a vlastní DNS jméno. V DNS namiř záznam A na veřejnou adresu. Na routeru rezervuj hostiteli stálou místní IP a přesměruj **TCP 80 a 443** na stejná čísla portů hostitele. Ve Windows Firewallu povol příchozí TCP 80 a 443 pro síťový profil hostitele. U této veřejné varianty musejí na Caddy dosáhnout i servery certifikační autority. V Caddyfile použij své DNS jméno místo místní IP, vynech `tls internal` i blok `auto_https disable_redirects` a nastav stejnou veřejnou HTTPS adresu do `publicOrigin`. Caddy pak může získat veřejný certifikát, kterému prohlížeče důvěřují. Přístup ověř z jiné sítě, třeba přes mobilní data. Při režimu CGNAT u poskytovatele přesměrování na domácím routeru samo nestačí. [Požadavky Caddy na veřejné HTTPS](https://caddyserver.com/docs/automatic-https#hostname-requirements)

## První společná hra

1. **PJ** zadá jméno a klikne na **Založit nový stůl**. Pro rychlý začátek může vybrat **Předlohu dobrodružství** s připravenou mapou.
2. PJ klikne nahoře na **Pozvat družinu** a rozešle zkopírovaný odkaz. Ověří, že odkaz začíná společnou adresou `https://…`. **Hráč** otevře pozvánku v běžném prohlížeči, zadá jméno postavy a zvolí **Přisednout ke stolu**.
3. Každý si přes avatar vpravo nahoře uloží vlastní **obnovovací klíč**. V jiném prohlížeči nebo po změně adresy použije **Vrátit se ke své postavě**.
4. PJ v **Odkrývání** umístí družinu u vchodu a v **Nastavení a schodiště** určí vedoucího. Hráči si v **Můj deník** doplní postavu. Vedoucí nebo PJ přesouvá družinu, kostky a chat jsou v pravém panelu.

Během hry nech běžet aplikaci i Caddy a počítač vzhůru. Po sezení může PJ přidat shrnutí přes **Kde jsme skončili**. Podrobnější postupy jsou v [herní příručce](https://github.com/cert4u/u-jednoho-stolu/blob/main/docs/PLAYING.md).

Tento prototyp nemá automatické aktualizace ani hlas v okně Electronu.

## Záloha a obnova

Jednu kampaň vyexportuj a obnov přes herní stůl. Pro zálohu celé instalace v administraci vytvoř ruční zálohu a stáhni **Úplná záloha ZIP**.

Při obnově celé instalace ukonči aplikaci. Ve složce `Stul` přejmenuj `data` například na `data-pred-obnovou`, založ novou prázdnou složku `data` a rozbal do ní obsah zálohy. Soubor `game.sqlite` má být přímo v `data`; složku `catalog-assets` zachovej, pokud v záloze je. Po spuštění ověř kampaně a katalogy. Soubor `nastaveni.json` je vedle složky `data` a obsahuje i heslo správce.

## Sestavení ze zdrojů

Ze zdrojového repozitáře po instalaci vývojových závislostí spusť `npm run build:windows`. Výsledné přenosné `.exe` je v `outputs/`. Příkaz sestaví Node server a zabalí ho s ověřeným sestavením Electronu pro Windows x64.

Pro sestavení potřebuješ [NSIS](https://nsis.sourceforge.io/Download) a jeho kompilátor `makensis` v `PATH`. Na Windows můžeš umístění `makensis.exe` zadat proměnnou `STUL_MAKENSIS`. Příkaz používá na Linuxu `curl` a `unzip`, na Windows `curl.exe` a `tar.exe`.
