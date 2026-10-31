# Řešení problémů

[Dokumentace](README.md) · [Hraní](PLAYING.md) · [Hosting](SELF_HOSTING.md) · [Hlas](VOICE.md)

Než změníš nastavení nebo obnovíš data, poznamenej si verzi a příznak údržby. Na Node instalaci je zjistíš přes `/healthz`; správce může použít:

```bash
curl --fail http://127.0.0.1:8080/healthz
./deploy/stul.sh ps
./deploy/stul.sh logs --tail=100 app updater
```

S jiným portem uprav adresu. Používáš-li hlas, pro jeho stav přidej do Compose příkazů `-f compose.yaml -f compose.voice.yaml`; příklad je v [hlasovém návodu](VOICE.md#lokální-docker-na-linuxu). Před sdílením logy projdi: nesmějí obsahovat klíče, tokeny ani soukromou hru.

## Přístup a administrace

| Příznak | Co ověřit |
| --- | --- |
| Nemám heslo do `/admin` | Neexistuje výchozí heslo. Správce nastavuje `STUL_ADMIN_PASSWORD` v `.env`; minimum je 20 znaků. Je to jiný přístup než obnovovací klíč PJ. |
| Správné heslo nefunguje / „Neplatný původ“ | Adresa v prohlížeči musí odpovídat `PUBLIC_ORIGIN`, včetně protokolu a portu. `localhost` a `127.0.0.1` nejsou tentýž origin. Po změně prostředí znovu vytvoř kontejner aplikace. |
| Administrace chce po restartu znovu přihlásit | Očekávané: podpis relace se při startu mění. Přihlas se znovu. |
| „fetch failed“ / updater nedostupný | Ověř službu `updater`, společnou Docker síť a shodný `STUL_UPDATER_TOKEN`. Při nativním Node startu bez Docker updateru je jeho nedostupnost očekávaná; přihlášení a hra mají fungovat dál. |
| Příliš mnoho pokusů | Přihlášení omezuje počet neúspěchů podle síťového připojení; vyčkej do konce 15minutového okna. Za proxy mohou hráči sdílet adresu. |
| Pozvánka mi vytvořila novou postavu | K návratu použij vlastní obnovovací klíč, nikoli nové připojení přes pozvánku. PJ může nepotřebnou postavu archivovat. |
| Obnovovací klíč neplatí | Po použití nebo vydání nového klíče starý neplatí. Ověř správnou instalaci a celý klíč; hráč požádá PJ o nový. Přesun na jiný server vyžaduje i správnou adresu instalace. |

Změny v `.env` se nepromítnou pouhým `restart`. Pro znovuvytvoření služby použij `./deploy/stul.sh up -d --force-recreate app` (s hlasovým overlayem, používáš-li ho). Nepřidávej automaticky `--build` po aktualizaci z administrace.

## Hraní a mapa

- **Nemohu posouvat družinu:** musí být umístěná PJ, pohyb ovládá vedoucí nebo PJ a cíl musí mít známou průchozí cestu. Přepni z přípravy na odkrývání a zvol nástroj družiny. Nezaměňuj pohyb žetonu za posun papíru.
- **Mapa se nevejde:** použij Ruku, Ctrl + tažení, Ctrl + kolečko nebo Přizpůsobit mapu oknu. Posun papíru nepřidává kreslitelná políčka.
- **Nakreslené schody nepřepnou patro:** nejprve propoj dva body různých pater. Družina musí stát přímo na funkčním konci schodiště; přechod potvrdí vedoucí/PJ.
- **Hráč nevidí poznámku:** musí být sdílená zveřejněná verze a odhalené místo na příslušném patře. Pouhé uložení přípravy nic nezveřejní.
- **Příšera zmizela:** ověř ruční skrytí, archivaci, umístění, aktuální patro a dohled. Živé žetony se neuchovávají ve vzdálené šedé paměti.
- **Generátor odmítá vložení:** po změně nastavení či pater vytvoř nový náhled a ověř zbývající kapacitu. Neprázdnou starší mapu generátor nepřepíše.
- **Konflikt formuláře:** nejprve zachovej rozepsaný text, potom načti novější stav. Konflikt chrání před přepsáním změn jiného účastníka.
- **Lektvar/odpočinek neodstranil bezvědomí:** použití předmětu samo neléčí a léčení neruší potvrzený stav. PJ zvlášť obnoví životy a potvrdí návrat postavy.
- **Šestka se nepřehazuje:** běžné `/hod 1k6` není bojové `1k6+`. Použij Hody a souboj.

## Hlasový hovor

| Příznak | Co ověřit |
| --- | --- |
| Panel hlásí „Nenastaveno“ | Serverové `STUL_LIVEKIT_URL`, klíč a tajemství alespoň 32 znaků. URL musí být `wss://`, nebo `ws://` jen pro loopback. Po změně prostředí znovu vytvoř aplikaci. |
| Připojím se, ale nikdo mě neslyší | Připojení začíná s mikrofonem vypnutým. Zapni jej, povol prohlížeči mikrofon, ověř správný vstup a systémové ztlumení. |
| Neslyším ostatní | Ověř tlačítko poslechu, hlasitost systému/prohlížeče a případné Spustit poslech. Druhý účastník musí mít zapnutý mikrofon. |
| Mikrofon nelze povolit | Veřejná aplikace musí běžet přes HTTPS; localhost je lokální výjimka. Ověř oprávnění webu v prohlížeči a dostupnost zařízení. |
| Funguje jen na jednom počítači | `local.yaml` i adresa `ws://localhost:7880` jsou jen pro tentýž počítač. Pro jiné počítače nastav veřejnou adresu, HTTPS/WSS a veřejný profil. |
| Hovor funguje doma, ne v jiné síti | Ověř přímé RTC porty, veřejnou IP/NAT a TURN pro omezené sítě. Samotná HTTP proxy nestačí pro média. |
| Odpojilo mě další okno | Stejná herní identita není určena pro souběžné aktivní hlasové připojení ve více kartách. Zkus jednu kartu na postavu. |

Syntetický test přenosu a kontrola podpisu tokenů neověří fyzický mikrofon ani každou síť. Pro veřejné nasazení proveď zkoušku na dvou skutečných zařízeních.

## Databáze, zálohy a aktualizace

- **503 a údržba:** vyčkej na úlohu updateru a přečti její stav. `ok: true` v `/healthz` může současně obsahovat `maintenance: true`; samo neznamená, že jsou povolené zápisy.
- **Chyba změněné migrace:** vrať původní aplikovaný SQL soubor a připrav novou migraci. Neobcházej kontrolní otisky v databázi. Před úpravou si ulož snapshot.
- **Po startu vidím prázdnou instalaci:** ověř `STUL_DATA_DIR`, správný Docker volume a název Compose projektu. Neprováděj další obnovu přes existující data, dokud neurčíš, kterou databázi server otevřel.
- **JSON se neobnoví:** ověř úplný export formátu 1, serverový limit 3 MB serializovaného obsahu a podporovanou verzi. Starý zápis chatu není záloha kampaně.
- **Po obnově JSON nefungují staré klíče:** očekávané, vznikla nová místnost a přístupy. PJ hráčům vydá nové klíče.
- **Po webové aktualizaci se vrátila stará verze:** běžné spouštění musí používat `deploy/stul.sh` a `.stul-state/runtime.env`. Neprováděj build ze starého checkoutu.
- **Žádné nové vydání v administraci:** zkontroluj release chybu, internet a GitHub API limit. Funkce na `main` nejsou automaticky novým stabilním releasem. Porovnej commit/verzi a poznámky k vydání; nic neaktualizuj naslepo do staršího stavu.

Přesný postup ruční obnovy je v [SELF_HOSTING.md](SELF_HOSTING.md#přerušení-a-ruční-obnova). `down -v`, odstranění dat nebo reset databáze nejsou běžné opravné kroky.

## Po zhasnutí skoro nic nevidím

V **Čas a světlo** ověř, zda je zapnuté řízení světly, některý zdroj svítí a má dosah. Nosič musí být aktivní hráčská postava; v boji světlo svítí od jeho aktuální pozice. Při dohledu bez světla 0 je bez osvětlení viditelné jen vlastní políčko, známá mapa zůstává šedá. To je očekávané chování. PJ může zdroj doplnit/rozsvítit, přiřadit jinému nosiči, změnit dohled bez světla nebo automatiku vypnout. Vyhořelý zdroj je nutné doplnit, samotné Rozsvítit nestačí.

Dosah světla neruší maximální dohled u mapy a neobchází zavřené dveře či zdi. Viditelnost zkontroluj přes **Pohled družiny**; PJ v přípravě stále vidí i skrytou kresbu.

## Mapa se dříve odhalila při pohybu ve tmě

Ve vývojové verzi po 0.3.0 mohl běžný skupinový přesun zapsat do paměti maximální dohled i při zapnutém omezení světly. Oprava vyhodnocuje světlo na každém kroku cesty. Již uloženou paměť zpětně nemaže: nelze rozlišit dřívější legitimní odhalení od chybného. PJ může dotčenou oblast ručně skrýt nástrojem **Skrýt**; úplná obnova ze starší zálohy vrátí také ostatní herní změny.

## Co uvést do hlášení

Verzi nebo commit, způsob spuštění, prohlížeč, roli, očekávaný a skutečný výsledek a krátké opakovatelné kroky na smyšlené hře. U hovoru doplň lokální/veřejný profil a typ sítě bez citlivých adres. Screenshot nejprve zbav tajné přípravy a osobních údajů. [Bezpečnostní problémy](../SECURITY.md) nepatří s podrobnostmi do veřejných issues.
