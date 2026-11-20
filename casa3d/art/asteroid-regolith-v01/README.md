# Regolite dell’asteroide

Le immagini di riferimento hanno guidato la palette ocra, le chiazze di
polvere fine e gli accumuli di pietrisco. La nuova mappa periodica rappresenta
frammenti con bordi angolari, creste decentrate e sottili zone scure di
contatto. Due scale dello stesso motivo distinguono la grana dai depositi
più ampi. I due canali della normale approssimano l’orientamento sulle
pendenze della mesh. Il terzo canale contiene il tono minerale.

La mappa 512² pesa 403.681 byte contro 422.773 byte per il dettaglio v06.
Il materiale usa due campioni a distanza ravvicinata. Il precedente ne
richiedeva fino a quattro per tono e differenze di altezza. Il pietrisco
geometrico riusa i settori v06 con le quote corrette dalla scultura.

## Rigenerazione

Eseguire [bake_regolith.py](bake_regolith.py) con Python e NumPy, disponibili
anche nel Python di Blender. Il seme e i parametri di authoring sono nello
script. L’output viene scritto in
[`src/assets/terrain-detail/regolith-detail.png`](../../src/assets/terrain-detail/regolith-detail.png).

## Confronto locale

Build locale, Edge headless con SwiftShader, viewport 960×580, DPR 1,
movimento ridotto. Il prima usa la build `index-DK7WBYh3.js` con la
scultura delle radure. Le catture usano le stesse pose.

| Vista | Draw call prima e dopo | Triangoli prima e dopo | Prima | Dopo |
| --- | ---: | ---: | --- | --- |
| Regolite da vicino | 448 | 950.739 | [Immagine](prima/regolite.png) | [Immagine](dopo/regolite.png) |
| Presso il vialetto | 750 | 1.149.242 | [Immagine](prima/arrivo.png) | [Immagine](dopo/arrivo.png) |
| Cratere UFO | 806 | 1.203.728 | [Immagine](prima/cratere.png) | [Immagine](dopo/cratere.png) |
| Panoramica | 985 | 1.240.460 | [Immagine](prima/panorama.png) | [Immagine](dopo/panorama.png) |

La mappa viene scaricata una volta al primo avvicinamento e rilasciata
insieme ai settori tornando alla panoramica. Zero errori browser.
Il bake ripetuto ha prodotto lo stesso SHA-256 della texture nella build.
Frame time e GPU restano da misurare sui dispositivi fisici.

[Rapporto prima](prima/browser-report.json) · [Rapporto dopo](dopo/browser-report.json) ·
[Suite](test-suite.txt) · [Hash sorgenti](source-hashes.json)

Per ripetere la verifica con la build locale servita sulla porta 4186:

```powershell
$env:CASA3D_REVIEW_URL = 'http://127.0.0.1:4186/casa3d/'
node casa3d/art/asteroid-sculpt-v01/verify-browser.mjs casa3d/art/asteroid-regolith-v01/dopo 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' --close-up
node --test casa3d/test/*.test.mjs
```
