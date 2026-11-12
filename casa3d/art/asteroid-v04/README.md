# Asteroide v04

[Scena Blender](Asteroide_v04.blend) per la prima revisione del terreno. La
spianata di polvere calda si apre davanti alla casa; i margini restano di
basalto e il fianco sudorientale è inciso da una frattura con una diramazione.
Rugosità e grana minerale sono modificabili nei due materiali procedurali.

Le tre camere salvate corrispondono a [panoramica](panoramica.png),
[superficie](superficie.png) e [frattura](frattura.png). La casa v10 è
in una collezione di riferimento. Il piano mostrato è quello del sorgente
Blender. I ritagli dei laghetti, i vialetti e gli appoggi del gioco sono
assemblati separatamente nel runtime.

La geometria del terreno ha due mesh e 10.560 triangoli come nella v03.
Il piano e il bordo condiviso coincidono vertice per vertice con la v03.
Il controllo sul volume saldato non rileva bordi aperti o non manifold.
La [verifica](stats.json) viene scritta dallo script.

Per ricreare la scena e i render dalla radice del repository:

```powershell
blender --background casa3d/art/asteroid-v03/asteroid-v03.blend --python-exit-code 1 --python casa3d/art/asteroid-v04/author_terrain.py -- --render
```

La revisione riguarda sagoma e materiali. Il GLB attivo resta quello v03.
Bake dei materiali, rilievo locale e caricamento per settori si valuteranno
sulla composizione approvata.
