# Banco d’acquario v01

Studio Blender per Casa3D, base Git `364a720` con lavoro locale in corso. Il
[banco d’acquario](Banco_di_pesci_acquario.blend) deriva dalla scena di lavoro
`art/asteroid-v05/Banco_di_pesci.blend`. Le due foto fornite in chat sono
riferimenti di forma e livrea. Le mesh e le livree a colori per vertice sono
modellate in Blender.

## Contenuto e verifiche

- 19 pesci: tre pagliacci, tre chirurghi blu, due farfalla e undici pesci
  distribuiti nelle altre varianti. Le sei acciughe restano semplici.
- Il secondo farfalla sostituisce `Pesce 15`, il sarago giallo grande. Misura
  38,6 cm lungo l’asse locale e conserva i canali di movimento esistenti.
- Un materiale visibile condiviso, zero texture raster. La scena passa da
  15.722 a 44.985 triangoli visivi relativi ai pesci. È un conteggio di
  authoring. La versione integrata è descritta sotto.
- La verifica BVH campiona le mesh deformate ai fotogrammi interi da 1 a 240
  in Blender 5.2. Zero coppie di pesci con intersezioni rilevate. I percorsi dei
  centri e i valori dei morph di coda corrispondono al confronto campionato
  prima della modifica. [Dati](verification.json), [prima](prima.png),
  [dopo](dopo.png) e [dettaglio del secondo farfalla](farfalla-giallo.png).

## Script

`authoring.py` conserva le modifiche procedurali applicate alla scena
interattiva con le livree sfumate e il primo farfalla già presenti. La baseline
era una sessione aperta con modifiche in memoria. La copia Blender in questo
pacchetto è il risultato modificabile ed è già pronta per la verifica.

```powershell
blender --background Banco_di_pesci_acquario.blend --python-exit-code 1 --python verify_school.py
```

## Integrazione in Casa3D

[Export verificato](runtime-export.json) in metri, con i pesci orientati verso
+Z. L’export riduce a 22.641 triangoli e conserva le livree per vertice. Il gioco
unisce le geometrie in una mesh con 38 ossa e un solo materiale. Usa un tier
caricato in prossimità del percorso e rilasciato quando ci si allontana.
Il registro conserva i bounds dell’intera formazione durante il giro.

```powershell
blender --background Banco_di_pesci_acquario.blend --python-exit-code 1 --python export_school.py -- ../../src/assets/models/props/banco-acquario.glb
node --test casa3d/test/fishSchool.test.mjs
```

Nella revisione successiva il gioco riusa lo stesso export per 36 pesci.
Il gruppo disegna 25.072 triangoli in una draw call con 72 ossa. I pesci
possono spostarsi nelle tre direzioni, beccheggiare e inclinarsi.
[Verifica della revisione](runtime-v02/browser-report.json).

Il comando Blender parte da questa cartella. Il test Node parte dalla radice.
I controlli campionano gli inviluppi animati del banco e dello squalo e lo
spazio occupato da carrelli, rotaie e sostegni durante la corsa. Il giro dura
83,77 s. Il margine minimo rilevato dalla parete è 27,2 cm, già al netto
delle tolleranze usate nel test del volume animato.

[Rapporto runtime](runtime/browser-report.json), [andata](runtime/andata.png),
[ritorno](runtime/ritorno.png), [primo laghetto](runtime/primo-laghetto.png),
[secondo laghetto](runtime/secondo-laghetto.png) e [corsa dal carrello](runtime/giostra-in-movimento.png).
Il browser headless verifica la visibilità, il movimento e il delta di draw e
triangoli. La prova dal carrello accelera il tempo nel browser e salta il disegno prima del corridoio. Le prestazioni hardware restano da misurare.

