# Arrivo illustrato v01

Versione storica del 19 novembre. La [revisione v02](../arrivo-vortice-v02/README.md) documenta il volo attuale.

Il [bozzetto approvato](bozzetto.png) guida il volo di 14 secondi. Il
[filmato](atterraggio.mp4) mostra fotogrammi della build locale a 704 × 424,
campionati a 18 fps, con l'inizio del brano **03.112**. Il gioco esegue la
sequenza in tempo reale. Nel pannello locale `?review&panel`, **Rivedi
atterraggio** la ripete durante la sessione.

Il [bake](bake.py) campiona il primo riquadro della tavola in coordinate
polari. Il centro si apre sulla casa reale. Il [pigmento WebP](vortex-paint.webp)
misura 1536 × 512 e pesa 211.038 byte. Il suo SHA-256 è
`ce639398f1638baabf3442ffdebb1eb53278a8e6473cd15557e9a961e67e5f06`.
L'originale ha SHA-256 `c70097882cd09b0dff74ce92b5d0f73103e0d9967e55a9aa57c26f2e2c35fab6`.
Per rigenerarlo eseguire `python casa3d/art/arrivo-illustrato-v01/bake.py`
con NumPy e Pillow.

Il [controller del volo](../../src/paintedArrival.mjs) gestisce tunnel,
scintilla, scia, palme e fumo. Le pennellate si muovono a profondità diverse.
I fuochi usano geometria istanziata, tre densità e le luci già presenti nella
scena. Il clic su ATTERRA avvia il caricamento facoltativo del pigmento.
Un disegno procedurale copre attesa ed errore. Richiesta, bitmap decodificata,
texture, geometrie e materiali appartengono a un singolo volo. Alla sua fine
o interruzione il controller stacca la radice, annulla la richiesta pendente,
chiude la bitmap e libera le risorse GPU. Il browser gestisce autonomamente
cache HTTP e recupero della memoria JavaScript.

Il [trattamento cromatico](illustratedColor.mjs) applica una curva
di luminanza a fasce morbide, ombre indaco e luci calde nei materiali. Il
colore al bordo usa la normale già disponibile sulle superfici fisiche opache.
Il cielo riusa le tre texture procedurali. I vetri residenziali ricevono una
componente ambrata. Le scene autonome importano il solo modulo del colore.

## Confronto della scena

Edge headless, SwiftShader, 960 × 580, DPR 1. Nelle catture di verifica
l'orologio del volo viene avanzato a istanti fissi. Durante il volo cambiano
traiettoria e composizione, quindi i numeri includono anche il mondo visibile.

| Istante | Draw prima → dopo | Triangoli prima → dopo | Immagini |
| --- | ---: | ---: | --- |
| Vortice, 2,10 s | 978 → 977 | 1.218.654 → 1.225.940 | [Prima](prima/vortice.jpg) · [Dopo](dopo/vortice.jpg) |
| Apertura, 5,75 s | 978 → 979 | 1.218.654 → 1.276.980 | [Prima](prima/scintilla.jpg) · [Dopo](dopo/scintilla.jpg) |
| Corona, 7,72 s | 978 → 977 | 1.218.654 → 1.276.596 | [Prima](prima/corona.jpg) · [Dopo](dopo/corona.jpg) |
| Dopo l'atterraggio | 953 → 953 | 1.252.938 → 1.252.938 | [Prima](prima/vialetto.jpg) · [Dopo](dopo/vialetto.jpg) |
| Tunnel subacqueo | 59 → 59 | 144.508 → 144.508 | [Prima](prima/sottacqua.jpg) · [Dopo](dopo/sottacqua.jpg) |

Il profilo alto può mostrare 1.155 pennellate istanziate. Le 6.410 linee e
i 3.840 punti aggiuntivi dei vecchi fuochi lasciano il posto a triangoli
con uno spessore leggibile. Il vortice precedente comprendeva anche un
canvas 2D esterno ai contatori WebGL. La scena al suolo riprende le normali
regole di visibilità e dettaglio.

### Tempi sulla Intel UHD 630

Un secondo confronto ha usato l'orologio reale, Edge headless con ANGLE
Direct3D11 e la GPU Intel UHD 630 a 960 × 580. La misura GPU usa
`EXT_disjoint_timer_query_webgl2` durante il disegno del mondo. È un volo
per versione, rispettivamente 417 e 418 campioni dopo il clic su ATTERRA.

| Durante il volo | Prima | Dopo |
| --- | ---: | ---: |
| Intervallo fra frame, mediana | 33,3 ms | 33,4 ms |
| Intervallo fra frame, 95º percentile | 34,9 ms | 43,3 ms |
| Tempo GPU, mediana | 19,94 ms | 23,66 ms |
| Tempo GPU, 95º percentile | 27,05 ms | 28,38 ms |

Il profilo illustrato ha impiegato 3,72 ms di GPU in più alla mediana.
La cadenza tipica si è mantenuta intorno a 30 fps, con maggiore variabilità
nei frame più lenti. [Misure](tempi.json) · [Procedura di confronto](measure-flight.cjs).

## Verifiche

- [Prima](prima/report.json), [dopo](dopo/report.json) e [viewport verticale](verticale/report.json).
  Due voli consecutivi per ciascuna viewport della nuova build. Per volo
  risultano cinque geometrie, cinque materiali e una texture finale
  rilasciati, con larghezza della bitmap decodificata pari a zero dopo la
  chiusura. Il test automatico copre anche una decodifica tardiva.
- [Movimento ridotto](ridotto/report.json). Il volo raggiunge il vialetto,
  rispetta l'avvio della musica e non richiede l'immagine del tunnel.
- [Veranda](dopo/veranda.jpg) e [sala autonoma](dopo/sala.jpg). Il controllo
  della sala conferma `worldLoaded: false`.
- [Verifica browser](check-browser.cjs). Usare Node, Playwright ed Edge con
  la build servita sulla porta 4186. Accetta `prima`, `dopo`, `verticale` o
  `ridotto`. Per il confronto precedente serve la build del 17 novembre.
- Suite completa dalla radice con `node --test casa3d/test/*.test.mjs`.
  271 test superati. Build con `casa3d/deploy.ps1` e consueto avviso Vite
  sul chunk condiviso. La prova su telefono fisico resta aperta.
