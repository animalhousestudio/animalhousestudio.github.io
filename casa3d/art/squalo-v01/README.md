# Squalo v01

Modello originale per il corridoio allagato tra i laghetti di Casa3D.
La prima versione riprende la sagoma di uno squalo bianco con dorso
grigio ardesia, ventre chiaro, cinque branchie per lato e coda asimmetrica.
La lunghezza di 3,43 m è una scelta di modellazione da provare nel percorso.

## Sorgente Blender

Aprire [Squalo.blend](Squalo.blend). La collezione `Squalo | asset` contiene
una mesh modificabile con gruppi per corpo, pinne, occhi e dettagli del muso.
Il muso punta verso `-Y`, con `Z` verticale e l'origine nel torso. La livrea
usa colori ai vertici e un materiale opaco. La collezione `Studio | anteprima`
contiene luci, camere e un piano d'acqua dimostrativo a quota locale 0,70 m.
Per ripetere la vista della pinna, attivare il piano per il render e impostare
`Camera | pinna in superficie` come camera della scena.

Le prove [squalo intero](squalo.png) e [pinna in superficie](pinna.png)
sono render di Blender. A riposo la dorsale emerge di 29,2 cm, con la punta
della coda a 4 cm sotto il piano. Tale margine va ricontrollato in animazione
con inclinazione, oscillazione e onde. La coda e il resto del corpo
rimangono nel medesimo modello durante l'emersione.

Il [rapporto](verification.json) conserva misure, conteggi e SHA-256.
Il generatore verifica che la mesh sia valida, che i triangoli abbiano area
positiva e che solo la dorsale superi il piano. Per rigenerare dalla radice
del repository con Blender 5.2 su Windows:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python-exit-code 1 --python casa3d/art/squalo-v01/build_shark.py -- --stills
```

## Animazione

Aprire [Squalo_Animato.blend](Squalo_Animato.blend) e premere **Spazio**
per vedere i 12 secondi di dimostrazione. La camera parte sott'acqua,
passa in superficie mentre lo squalo risale e torna sott'acqua dopo
l'immersione. I render mostrano [nuoto](nuoto.png), [emersione](emersione.png)
e [discesa](discesa.png).

La scena `02 | Ciclo di nuoto sul posto` contiene il rig con otto ossa e
l'azione `Squalo | nuoto continuo`. Il ciclo dura 32 fotogrammi a 24 fps
(1,33 s) e la posa al fotogramma 33 coincide con quella al fotogramma 1.
L'oscillazione cresce verso la coda. La traiettoria, la quota e
l'inclinazione della dimostrazione sono animate su un oggetto separato.

Il [rapporto di animazione](animation-verification.json) registra 576
campioni della mesh deformata. La dorsale emerge di 19,3–22,5 cm durante
il tratto di emersione stabile. Tutte le altre parti conservano almeno
7,55 cm di profondità rispetto al piano d'acqua di prova. L'oscillazione
laterale della punta della coda è di 1,08 m da un estremo all'altro.

Per rigenerare l'animazione dal modello statico conservato in questo pacchetto:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python-exit-code 1 --python casa3d/art/squalo-v01/animate_shark.py -- --stills
```

## Nel gioco

`export_runtime.py` esporta soltanto il modello con rig e ciclo `Swim`.
Il [manifest](runtime-export.json) registra conteggi e SHA-256. Il percorso in
`src/rooms/sharkRoute.mjs` è indipendente dalla dimostrazione Blender. Le viste
locali `?review&view=shark`, `?review&view=shark-tunnel` e
`?review&view=shark-surface` mostrano il giro, il corridoio e la dorsale.
`test/shark.test.mjs` controlla gli ingombri e l'emersione.
