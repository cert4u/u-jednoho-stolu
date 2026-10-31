# Příprava vydání

[Dokumentace](README.md) · [Vývoj](DEVELOPMENT.md) · [CHANGELOG](../CHANGELOG.md)

Tento postup je pro správce projektu. Repozitář má CI, ale nemá automatický release workflow. Publikace stabilního vydání je ruční krok.

## Větev, verze a instalace

- `main` obsahuje průběžný vývoj. Dokumentace této větve může popisovat více funkcí než poslední stabilní vydání.
- `package.json` obsahuje verzi sestavení; samotná změna souboru ani push nevytvoří GitHub Release.
- Updater vybírá poslední **stabilní GitHub Release**, vylučuje draft/prerelease a vyžaduje tag `vX.Y.Z`. Vyhodnotí skutečný plný commit tagu a sestaví jej; neinstaluje automaticky `main`.
- Runtime `/healthz` vrací `version`, `revision` a `builtAt`. Sleduj i commit, zejména u vývojové instalace se stejným číslem verze.

Pokud má provozovatel novější vývojový commit než zveřejněný release, automatická aktualizace není bezpečnou zkratkou k „nejnovějším funkcím“. Vždy zkontroluj nabízený release a jeho změny.

## Kontrolní postup před vydáním

1. Vyber a zkontroluj finální commit, změny dokumentace a související issues. Projdi [limity](LIMITS.md) a odliš, co je implementované, pouze lokálně ověřené a stále plánované.
2. Aktualizuj verzi v `package.json` i odpovídající metadata `package-lock.json`. Přesuň relevantní položky z **Příští vydání** do nové sekce `CHANGELOG.md`.
3. Projdi změny migrací, backup formátu a požadavků na konfiguraci. Změny aplikovaných migrací nejsou přípustné. Pokud nový kód mění provozní postup, Compose, updater nebo externí službu, napiš ruční kroky do release notes.
4. Spusť kontroly podle [vývojového návodu](DEVELOPMENT.md#ověření-a-ci). CI musí projít na vydávaném commitu včetně Docker výměny a obnovy dat. Samotný úspěšný build není upgrade test.
5. Ověř čistou instalaci i existující testovací kampaň po upgradu, přihlášení hráče/PJ, zálohu JSON, konzistentní SQLite snapshot a návrat předchozí verze. U UI zkontroluj oba role pohledy a mobil. U hlasu proveď zkoušku se skutečnými mikrofony a sítěmi.
6. Zkontroluj licence nových závislostí a oznámení. Do archivu/repozitáře nepatří testovací přístupy ani skutečné kampaně.

## Publikace

Po schválení vytvoř neměnný tag `vX.Y.Z` na přesném ověřeném commitu a k němu GitHub Release. Prerelease slouží pro zkoušení, updater ho nenabízí jako stabilní vydání. Již vydaný tag nepřesouvej na jiný kód; opravné změny vydávej pod novou verzí.

Release notes mají obsahovat:

- Konkrétní nové chování a opravy z pohledu hráčů/PJ.
- Požadavky a kroky pro správce, nové proměnné a služby, kompatibilitu exportů/migrací.
- Co aktualizátor provede a co je ruční: checkout, updater a LiveKit se automaticky nemění s app kontejnerem.
- Skutečně provedené testy a známá omezení včetně dosud neověřených prostředí.
- Upozornění, že rollback vrací i databázi do doby před upgradem; novější změny zůstanou v samostatném snapshotu pro ruční obnovu.

Ověř, že Release API vrací zamýšlený stabilní tag a že testovací administrace ukazuje jeho správný commit. Neprováděj první zkoušku proti rozehrané družině. Archiv vydání obsahuje jeho vlastní dokumentaci; odkazy na vývojový README nejsou náhradou release notes.
