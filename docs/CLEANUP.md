# Úklid projektu a dekorace mapy — 1.2.3

[Dokumentace](README.md) · [Vývoj](DEVELOPMENT.md) · [Aktualizace](SELF_HOSTING.md#přechod-z-122-na-123)

## Co bylo odstraněno

Prověřeno bylo skutečné použití v aplikaci, serveru, workeru, vývojových a testovacích skriptech, konfiguraci a CSS. Samotný nedosažitelný import není automatickým povolením ke smazání: volitelné kořeny a kontejnery mají další vstupy.

- **57 nevyužívaných komponent z `components/ui/` a `hooks/use-mobile.ts`:** celkem 58 souborů a 6 451 řádků. Tyto šablony neměly spotřebitele mimo vlastní nepoužívanou skupinu. Prázdné `registries` v `components.json` je dynamicky nenačítaly.
- **10 přímých produkčních závislostí:** `@base-ui/react`, `@hookform/resolvers`, `@shadcn/react`, `cmdk`, `input-otp`, `next-themes`, `react-hook-form`, `react-resizable-panels`, `sonner`, `vaul`.
- **Jeden vývojový balíček:** `tw-animate-css`, který nebyl importovaný v CSS ani konfiguraci.
- Lockfile má o **20 balíčkových záznamů méně**. Žádná verze zbývající závislosti se tím nezměnila; číslo samotné aplikace se zvyšuje na 1.2.3.
- S odstraněním šablon zmizely i jejich zvláštní lint výjimky. Zachované vlastní i převzaté zdroje procházejí striktní kontrolou bez chyb a varování.

[Úplný seznam a konzervativní graf importů](performance/cleanup.json) zachovává rozsah tohoto úklidu. Historická měření předchozích auditů nebyla přepsaná. Úbytek zdrojových souborů není vydáván za stejně velkou úsporu klientského JavaScriptu: šablony nebyly součástí herního importního grafu.

## Co zůstalo a proč

- `components/connector-error.tsx`, `components/ui/button.tsx` a `lib/utils.ts`: volitelný konektorový panel stále potřebuje tlačítko, `radix-ui`, `class-variance-authority`, `clsx` a `tailwind-merge`.
- Typové a běhové konektorové adaptéry, náhledový bridge, `raw-body`, vývojové instalační skripty a Vite pluginy: tvoří podporovanou vývojovou/Cloudflare cestu. TypeScript `.mts` kontrakty se používají přes `.mjs` importy; updater Dockerfile kopíruje společný `server/http.mjs` do kořene svého image.
- Licence a oznámení zachovaných převzatých součástí, katalogy, jejich obrázky, herní testy a vývojové nástroje.
- Historická CSS kaskáda: součástí tohoto zásahu není plošné mazání stylů odhadnutých pouze podle textového vyhledávání.

Novou kontrolu spustíš příkazem `node scripts/audit-maintainability.mjs`. Výsledek jde do `docs/performance/maintainability-current.json`; volitelným argumentem zvolíš jiný soubor. Skript nic nemaže. Jeho seznamy a explicitní vývojové/konektorové kořeny jsou podklad k revizi, nikoli důkaz pro libovolné dynamicky generované importy.

## Tužka a desetistěnná kostka pod mapou

Skici zůstávají ve svém rohu a zachovávají původní světlost na prázdném papíře. Pod podlahou a hranami zobrazené mapy je měkká SVG maska skryje. Posun, přiblížení, změna patra a velikosti okna mění projekci masky podle skutečné polohy plátna; nezasahují do mapových dat ani ovládání.

Maska dostává stejný `shown` pohled jako vykreslení mapy. U hráče ani v náhledu družiny se proto nesmí počítat ze soukromého atlasu. Zůstává `aria-hidden`, nemá pointerové hit targety a nezakrývá klikání ani klávesnici. Každý stůl má vlastní identifikátory filtrů a masky.

## Ověření a kompatibilita

Čistá instalace se provádí přes `npm run install:ci`, aby výsledek nezávisel na zbytcích odstraněných balíčků. `npm run verify`, `npm run lint` a `npm run format:check` kontrolují zdroje, obsah, typy a regrese. Test `scripts/test-keepsake-mask.mjs` navíc vykresluje skutečný hráčský editor a ověřuje, že maska neobsahuje neprozkoumané místnosti. Projekce má samostatné případy pro posun, změnu velikosti, prázdný papír a více stolů.

Obě varianty se ověřují samostatným buildem a kontrolou soukromí klientského balíčku. Cloudflare používá `npm run test:ci`; Node `npm run test:hosting` a `npm run test:stabilization`. Úplné CI vydávaného commitu a skutečné Docker scénáře jsou uvedené v poznámkách GitHub Release. V lokálním prohlížeči bylo navíc ověřeno skutečné překrytí obou skic pod místností, jejich návrat po odsunutí mapy, přiblížení, ručně kreslený vzhled a náhled družiny s neodhalenou místností. Konzole při této kontrole neobsahovala chyby ani varování. Samotný SVG/HTML test by výsledek rasterizace nedokazoval.

Z 1.2.2 nejsou potřeba nové SQL migrace, změna konfigurace ani updateru. Pravidla, generátor V2, formát kampaní, katalogů a záloh zůstávají stejné. Před aktualizací uchovej obvyklou úplnou serverovou zálohu. [Postup](SELF_HOSTING.md#přechod-z-122-na-123).
