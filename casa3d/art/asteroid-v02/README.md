# Asteroide v02 — blocco centrale e bordi frastagliati

`asteroid-v02.blend` contiene la scena `Asteroid_Review_v02`, con una massa centrale larga fino alla base e contrafforti rocciosi laterali più irregolari. Il file v01 rimane conservato nella cartella precedente.

- Piano superiore e perimetro identici alla revisione v01.
- Due mesh e due materiali; 9.920 triangoli complessivi.
- Roccia continua, senza frammenti sovrapposti o oggetti separati per le creste.
- Superficie e roccia formano un volume chiuso quando si salda il bordo comune: zero bordi aperti e zero bordi non manifold.
- Colori per vertice; nessuna nuova texture esterna.
- `asteroid-v02.glb` contiene solo il modello, senza camera o luci; dimensione 967.120 byte.
- `asteroid-v02-preview.png` è il render controllato.

`revise_asteroid_v02.py` si applica una volta alla scena v01. I risultati delle verifiche sono in `stats.json`.

Revisione solo Blender: il modello caricato dal gioco non è stato sostituito in questo passaggio.
