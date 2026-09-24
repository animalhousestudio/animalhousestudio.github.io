# Asteroide v01

Modello approvato e integrato in Casa3D.

- `asteroid-v01.blend`: scena autonoma con modello e luci/camera di anteprima.
- `asteroid-v01.glb`: modello pulito, senza luci, camere o oggetti della scena iniziale.
- `asteroid-v01-preview.png`: anteprima della forma approvata.
- `create_asteroid.py`: generazione riproducibile in Blender; interrompe l'esecuzione se la scena esiste già.
- `stats.json` e `validation.json`: dimensioni e verifiche geometriche.

Due mesh (superficie e roccia), due materiali, 8.960 triangoli, 868.016 byte.
Piano a quota zero; larghezza circa 104 m, profondità 98 m, altezza 55 m.
Colori per vertice, nessuna texture esterna, nessuna vegetazione incorporata.
Le due mesh condividono geometricamente il bordo: saldandolo per la verifica
si ottiene un volume chiuso senza bordi non manifold.

La copia usata dal gioco è `src/assets/models/asteroid.glb`. Il codice in
`src/rooms/asteroid.mjs` applica alla superficie il materiale condiviso del
giardino, genera le UV e mantiene aperto il vano della casa. Il terreno
calpestabile segue il perimetro esportato, senza usare la scatola della roccia
come ostacolo. L'erba conserva le istanze già presenti nel giardino.

L'ingresso in `src/arrival.mjs` dura 14 secondi e termina a z=43, pochi metri
oltre il bordo anteriore. Parte solo dopo il caricamento di asteroide e casa
e un click/tocco. La distanza iniziale si adatta al formato verticale.
