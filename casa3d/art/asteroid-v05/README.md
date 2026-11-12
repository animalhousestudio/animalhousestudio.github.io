# Asteroide v05

Revisione Blender della palette, del rilievo e del cratere dell'UFO.
La roccia è marrone scuro e la polvere centrale resta più chiara.
Il piano conserva il bordo v04. Il rilievo riparte dal profilo corrente
del gioco e aggiunge ondulazioni fuori dalle aree protette.

L'UFO è il modello del gioco nella sua posizione, inclinazione e profondità
attuali. Il cratere ha una conca asimmetrica e un bordo di detriti più alto
su un lato. [Vista ravvicinata](cratere.png), [panoramica](panoramica.png),
[vista dall'alto](superficie.png) e [terreno da vicino](terreno.png).

La mesh di studio aumenta la densità vicino al cratere. Ai suoi 18.846
triangoli si aggiungono 1.476 triangoli di frammenti, in una collezione
separata per il dettaglio ravvicinato. Il bordo originale è chiuso
con il fianco e i riferimenti del gioco restano disponibili per confrontare
le due versioni. I laghetti e gli altri oggetti assemblati nel gioco non
sono riprodotti in questa scena.

Per ricreare scena, verifiche e render dalla radice del repository:

```powershell
blender --background casa3d/art/asteroid-v04/Asteroide_v04.blend --python-exit-code 1 --python casa3d/art/asteroid-v05/review_terrain.py -- --render
```

Lo script campiona `baseTerrainHeight` e legge la posa dell'UFO direttamente
dai moduli del gioco tramite Node.

## Prima integrazione locale

[Export e hash](runtime-export.json). Il GLB contiene il fianco e due texture
di colore cotte in Blender. Una griglia di scarti centimetrici applica il
rilievo alla superficie già ritagliata per casa e laghetti. Il cratere
procedurale è la base di questa correzione, così l'avvallamento viene
applicato una volta sola. L'export attenua il rilievo sul bordo e presso gli
appoggi del tempietto e della cabina.

```powershell
blender --background casa3d/art/asteroid-v05/Asteroide_v05.blend --python-exit-code 1 --python casa3d/art/asteroid-v05/export_runtime.py
```

In `?review` sono disponibili `view=terrain` e `view=terrain-ufo`.
Il [report Chrome](runtime/report.json) include i controlli di appoggio,
le due aperture dei laghetti e l'atterraggio. Il dettaglio ravvicinato
in collezione separata resta nella scena Blender.
