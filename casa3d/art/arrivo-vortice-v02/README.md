# Atterraggio nel vortice

Il [filmato del gioco](atterraggio.mp4) segue il volo da ATTERRA al vialetto.
La registrazione è di 15 secondi, a 864 × 520 e 30 fotogrammi al secondo,
con l'apertura del brano 03.112. Il gioco disegna il volo in tempo reale.
Nel [pannello di prova locale](http://127.0.0.1:4186/casa3d/?review&panel)
si può ripetere con **Rivedi atterraggio**.

## Come si muove

Il [fumo](../../src/arrivalSmoke.mjs) occupa un volume lungo la traiettoria
del giocatore. Durante il volo, le correnti ruotano a velocità diverse e
le piccole turbolenze modificano i margini di ogni banco. Un campione in
direzione della luce modella le ombre delle pieghe. La scintilla guida
illumina il fumo vicino e le accensioni dei fuochi rischiarano il volume.
Trentadue filamenti a nastro si assottigliano e si attenuano dietro al fumo.
La [tavola di riferimento](../arrivo-illustrato-v01/bozzetto.png) e il
[pigmento storico](../arrivo-illustrato-v01/vortex-paint.webp) rimangono in archivio.

Il [controller](../../src/paintedArrival.mjs) coordina i 14 secondi della
discesa. Il [sistema originale di fuochi](../../src/arrivalFireworks.mjs)
disegna 3.840 scintille e le loro scie dietro la casa. Il fumo termina entro
9,24 s e i fuochi entro 12,46 s. Le ultime braci si spengono sopra il vialetto.

## Verifiche del 20 novembre 2026

La build locale e i 271 test sono riusciti. Le tre prove nel browser hanno
avviato il brano 03.112. Il registro delle richieste conferma zero accessi al
pigmento storico. La verifica visiva copre l'apertura, i primi scoppi, il
finale dei fuochi, le braci e il vialetto.

| Prova | Risultato |
| --- | --- |
| [Desktop 960 × 580](desktop/report.json) | A camera, guida e luce ferme, avanzare di 0,45 s cambia almeno 12 valori su 255 in un canale RGB nel 90,6% dei pixel del volume. Due voli rilasciano 15 risorse su 15 ciascuno. |
| [Verticale 390 × 780](verticale/report.json) | Lo stesso confronto cambia l'87,0% dei pixel. Entrambi i voli rilasciano 15 risorse su 15. |
| [Movimento ridotto](ridotto/report.json) | Zero risorse del volo, prospettiva e musica attive. |
| [Confronto dei tempi](tempi.json) | Edge, Intel UHD 630, 960 × 580. Fra v01 e v02 la mediana GPU passa da 23,43 a 24,34 ms e il 95º percentile da 29,65 a 34,28 ms. L'intervallo mediano fra fotogrammi è 33,3 ms in entrambe le prove. |

Le risorse tracciate includono il target del volume, la texture di rumore,
le geometrie e i materiali. La texture colore del target viene rilasciata
dal renderer con il target stesso. Il test unitario copre anche
l'interruzione a metà volo. Resta da misurare il costo su telefono fisico.

## Riprodurre le prove

Seguire [BUILD_LOCAL.md](../../../BUILD_LOCAL.md) per build locale e preview.
Dalla radice, con Playwright ed Edge disponibili, eseguire i comandi seguenti.
Se Playwright è installato fuori dal progetto, impostare `PLAYWRIGHT_PATH`
sul percorso del pacchetto.

```powershell
node --test casa3d/test/*.test.mjs
node casa3d/art/arrivo-vortice-v02/check-browser.cjs desktop verticale ridotto
node casa3d/art/arrivo-vortice-v02/measure-flight.cjs
$env:ARRIVAL_FRAMES = Join-Path $env:TEMP 'casa3d-volumetric-final-450'
node casa3d/art/arrivo-vortice-v02/record.cjs
blender -b --factory-startup --python-exit-code 1 --python casa3d/art/arrivo-vortice-v02/movie.py
```

Il confronto dei tempi usa la build storica `index-Cxp3R57u.js` e la build
attiva. Il filmato campiona il canvas a orologio controllato e monta la
traccia originale. Per misurare i tempi reali usare il confronto GPU.
