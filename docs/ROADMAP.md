# Plán další práce

[Dokumentace](README.md) · [Historie změn](../CHANGELOG.md)

Zaškrtnuté položky jsou implementované v této větvi, ne nutně součástí posledního stabilního vydání. Nezaškrtnuté položky nemají slíbený termín.

Pořadí je návrh a může se změnit podle skutečného hraní. Hlavní zásada: jednoduchost ovládání a spolehlivost mají přednost před počtem pravidel.

- [ ] Krátké testovací dobrodružství s celou partou a opravy podle jeho průběhu.
- [x] Jednoduchá iniciativa, číslo kola a aktuální účastník souboje; nezávisle na pochodovém pořadí.
- [x] Poznámky PJ k místům ukotveným v políčku, s odděleným sdílením popisu pro družinu a upozorněním při přiblížení.
- [x] Výzvy ke zkouškám a pastem: hráčský hod, tajná nebezpečnost a rozhodnutí PJ.
- [x] Kořist, měšec a připsání získaných předmětů do deníku s bezpečným rozdělováním mezi hráče.
- [x] Správa předmětů a měšce, odečítání použitých kusů a ruční příjmy/platby.
- [x] Vyřazení při 0 životech, potvrzení dalšího stavu a návratu do hry Pánem jeskyně.
- [x] Generátor propojené jeskyně podle parametrů PJ s náhledy, variantami a schodišti.
- [x] Volitelné čistě hlasové volání družiny přes vlastní LiveKit.
- [x] Trvalé značky vchodu a východu a umístění družiny u vchodu.
- [x] Komunitní příručky, provozní a vývojová dokumentace a kontrola odkazů v CI.
- [ ] Ověření hlasu skutečnými mikrofony na různých veřejných sítích a dokončení konkrétního veřejného nasazení.
- [ ] Krátké ukázání místa na mapě ostatním bez posunu družiny.
- [x] Čas průzkumu a světla družiny s odpočtem doby svícení a vrácením posledního posunu.
- [x] Odpočinek a léčení s výběrem postav, náhledem a obnovou životů i magenergie podle PJ.
- [x] Vlastní kouzla a schopnosti, magenergie a její odečítání při použití.
- [x] Jednoduché značky stavů postav a příšer, tajné poznámky a ruční počítání kol.
- [x] Příprava vlastního hostingu a dokumentovaný provoz včetně obnovy záloh.
- [ ] Další rozdělení rozsáhlých komponent a sjednocení klientských/serverových typů.

Mapa, dohled, deníky, hody, potvrzované zranění, obnova přístupů a celé kampaně už fungují. Podrobné automatické vyhodnocování povolání, kouzel a oficiální bestiář nejsou cílem současné verze.

Vchod a samostatný východ jsou trvalé značky mapy; PJ může zahájit průzkum u vchodu. Generátor je připraví na přízemí. Přechod do venkovní mapy je případné další rozšíření.

## Možná další rozšíření k diskusi

Předávání výbavy mezi hráči, rozestavení postav pro boj a opakovaně použitelné přípravy PJ jsou návrhy. Nemají schválený rozsah ani termín a nejsou automatickou součástí hotových funkcí. Priority upravíme podle prvního společného hraní.
