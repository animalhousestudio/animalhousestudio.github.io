# Asteroide v06

[Scena Blender](Asteroide_v06.blend) e [vista del cratere](cratere-blender.png).
La superficie usa un motivo ripetibile di fratture, granuli e variazioni di
rugosità. Le rocce semisepolte sono raccolte in 22 settori separati. Il
cratere è la zona con la maggiore densità di detriti.

I settori sono esportati sulle quote della superficie v05. Il gioco applica
lo scarto della [scultura delle radure](../asteroid-sculpt-v01/README.md)
una volta per settore al caricamento. Da vicino carica la
[mappa di regolite aggiornata](../asteroid-regolith-v01/README.md)
e fino a tre settori per volta. I settori condividono il limite
di due richieste simultanee con gli altri modelli. La texture e i settori
lontani vengono rilasciati dopo dieci secondi, o prima per fare spazio a un
settore vicino. Il dettaglio geometrico è decorativo.

I file e gli hash dei settori sono registrati nel
[manifest](../../src/assets/terrain-detail/sectors.json). Per rigenerare
scena, dettaglio e anteprima dalla radice del repository:

```powershell
blender --background casa3d/art/asteroid-v05/Asteroide_v05.blend --python-exit-code 1 --python casa3d/art/asteroid-v06/author_detail.py
```

La [prova Chrome](runtime-report.json) confronta la panoramica senza risorse
vicine, il cratere caricato, il rilascio in memoria e l'origine dei bengala.
