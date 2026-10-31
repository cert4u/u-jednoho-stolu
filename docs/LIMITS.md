# Limity a hranice současné verze

[Dokumentace](README.md) · [Herní příručka](PLAYING.md)

Jde o limity aktuálního kódu v této větvi, nikoli o příslib vhodnosti pro veřejný server s libovolným zatížením.

| Oblast | Limit / chování |
| --- | --- |
| Mapa | 28 × 20 polí na patro, nejvýše 8 pater na místnost. Okolní papír není další kreslicí plocha. |
| Souřadnice | API od nuly: x 0–27, y 0–19. Uživatelská mřížka je číslovaná od 1. |
| Hráči | 12 aktivních účastníků včetně PJ, 200 postav včetně archivovaných. |
| Příšery | 200 včetně archivovaných na dobrodružství. |
| Generátor | 1–8 nových pater podle zbývající kapacity; 2–12 místností na patro, u velkých 2–6. Samostatná kapacita se počítá se znovuvyužitím skutečně prázdného výchozího patra. |
| Dohled | 1–12 polí. |
| Poznámky a místnosti na mapě | 200 dohromady na dobrodružství včetně automatických značek generátoru, nejvýše jedna na políčko a patro. Volitelné číslo 1–999 je unikátní na patře; upozornění 1–6 polí, výchozí 2 (automatické značky je mají vypnuté). |
| Inspekce mapy | Jen PJ. Platný V2 graf vymezuje logickou místnost; ruční/změněná mapa používá propojenou podlahu ohraničenou zdmi a dveřmi. Volná chodba může spojit více místností. Kořist a zkoušky se hledají podle vazby na poznámky v prostoru. |
| Soubojové pořadí | Nejvýše 64 účastníků. Až 100 rozpracovaných útoků; uzavřená soubojová historie se omezuje samostatně. |
| Stavy | Nejvýše 12 na postavu/příšeru, trvání 0–999 kol nebo neurčené. |
| Vlastní kouzla a schopnosti | Nejvýše 30 na postavu; magenergie a cena 0–9999. |
| Světla | Nejvýše 24 zdrojů na dobrodružství. |
| Kořist | 50 připravených/otevřených nálezů, 100 posledních uzavřených; 24 položek a 200 převzetí na nález. |
| Výbava | 200 názvů položek na postavu; nejvýše 999999 kusů jedné položky. |
| Zkoušky | 50 rozpracovaných a posledních 100 uzavřených. |
| Chat | Posledních 500 zpráv. Rozpracované soubojové akce a ostatní strukturované záznamy žijí odděleně. |
| Běžné kostky | 1–20 kostek se 4, 6, 8, 10, 12, 20 nebo 100 stěnami; volitelná oprava. Přehazování šestek platí jen pro mechaniku boje, nejvýše 100 hodů v řadě. |
| Herní synchronizace | Klient načítá stav přibližně každé 2 sekundy. Hlas běží zvlášť přes WebRTC. |
| Záloha JSON | Formát verze 1, nejvýše 3 000 000 bytů serializovaného JSON na serveru. Souborový výběr dovoluje až 10 MB souboru, ale neruší serverový limit. |
| Historie mapy | Nejvýše 12 tahů; není historií všech změn kampaně. |
| Provoz | Jedna replika aplikace a jedna SQLite databáze v Docker variantě. Rootless Docker, Swarm a škálování na více replik nejsou podporovaným postupem. |

Podrobný [audit herních mechanik](MECHANICS.md) rozlišuje funkční evidenci, ruční rozhodování a navržené priority.

## Co se řeší ručně

- Výpočet bojových hodnot z rasy, povolání a vybavení, postup úrovní, iniciativa podle pravidel a účinky kouzel/stavů.
- Převod pohybu, boje a odpočinku na herní čas, odpočty kol stavů a dopad světla na dohled.
- Rozestavení jednotlivých postav při boji se společným průzkumem; rozdělení družiny na více nezávislých skupin.
- Předávání předmětů mezi hráči, zamčené/tajné dveře jako zvláštní mechanika a přechod východem do venkovní mapy.
- Generátor připravuje mapu, nikoli automatický obsah místností, pravidlový bestiář nebo kompletní dobrodružství.

## Hlas a veřejný provoz

LiveKit je volitelný a vyžaduje samostatné nasazení. Lokální profil je jen pro stejný počítač. Veřejný profil vyžaduje HTTPS/WSS, správné síťové cesty a pro omezené sítě TURN. Není implementované hlasové šeptání, nahrávání, přepis ani serverové okamžité vykázání účastníka při archivaci postavy. Podrobnosti jsou v [návodu](VOICE.md).

Herní místnost je určená důvěryhodné partě. Pozvánka umožňuje připojit novou postavu až do limitu místnosti; neexistuje obecný účetní systém se schvalováním každého hráče. Databáze uchovává herní tokeny a obsah kampaní; správce instalace má k těmto datům přístup. PJ není správcem serveru, ale serverový administrátor není izolovaný od dat jednotlivých kampaní.
