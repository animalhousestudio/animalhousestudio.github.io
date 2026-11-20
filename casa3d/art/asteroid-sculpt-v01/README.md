# Conche e dossi dell’asteroide

La [scultura](../../src/rooms/terrainDetail.mjs) combina profili ellittici
sovrapposti. Conche allungate e creste decentrate seguono direzioni diverse.
La griglia v05 integra gli scarti all’avvio. La mesh e il profilo di camminata
campionano quella griglia. I settori v06 applicano solo lo scarto dal profilo
originale, mantenendo la propria profondità di interramento.

## Confronto locale

Edge headless con SwiftShader, viewport 960×580, DPR 1, movimento ridotto.
Il prima corrisponde a `63b009d`. Le immagini dell’arrivo guardano verso
la casa dal terreno a ovest del vialetto.

| Vista | Draw call prima e dopo | Triangoli scena prima e dopo | Prima | Dopo |
| --- | ---: | ---: | --- | --- |
| Panoramica | 985 | 1.240.460 | [Immagine](prima/panorama.png) | [Immagine](dopo/panorama.png) |
| Cratere UFO | 805 | 1.145.180 | [Immagine](prima/cratere.png) | [Immagine](dopo/cratere.png) |
| Terreno presso l’arrivo | 748 | 1.147.958 | [Immagine](prima/arrivo.png) | [Immagine](dopo/arrivo.png) |

La superficie mantiene 57.071 vertici e 113.479 triangoli. Il totale delle
collisioni della scena è 712.086 triangoli in tutte e tre le viste.
La texture vicina e i settori vengono rilasciati tornando alla panoramica.
Le acquisizioni di SwiftShader forniscono conteggi e verifica visiva.
Frame time e GPU sui dispositivi target sono ancora da misurare.

[Rapporto prima](prima/browser-report.json) · [Rapporto dopo](dopo/browser-report.json) ·
[Suite](test-suite.txt) · [Hash sorgenti](source-hashes.json)

Per ripetere il confronto dalla radice del checkout:

```powershell
npm.cmd --prefix .\casa3d run dev -- --host 127.0.0.1 --port 5187 --strictPort
node casa3d/art/asteroid-sculpt-v01/verify-browser.mjs casa3d/art/asteroid-sculpt-v01/dopo 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node --test casa3d/test/*.test.mjs
```
