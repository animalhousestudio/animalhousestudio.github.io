# Alberi importati

I sei file della cartella Desktop/trees sono GLB 2.0 validi e sono stati importati con successo in Blender 5.2. Si aprono con **File → Importa → glTF 2.0 (.glb/.gltf)**; File → Apri si usa per i progetti `.blend`.

La libreria `trees-natural.blend` contiene tre varianti separate e modificabili:

- Green: `tree (2).glb`.
- Gold: `tree.glb`.
- Red: `tree (5).glb`, scelto dall'utente per la casa.

Le texture sono incorporate e ridotte a un massimo di 512 pixel; geometria, UV e sagome originali sono conservate. Ogni variante ha due mesh, rami/tronco e foglie. `src/assets/models/trees-natural.glb` pesa 5.249.000 byte. I file sul Desktop restano gli originali con le texture a risoluzione piena.

Nel gioco, sei alberi condividono le sei geometrie e i materiali delle tre varianti, con istanze suddivise per zona. La distribuzione è deterministica, varia altezza e orientamento, interra leggermente le radici ed evita campetto, ingressi, asset, massi e bordo dell'asteroide. I tronchi hanno collisione; le superfici delle foglie usano il ritaglio tramite trasparenza della texture e non bloccano il giocatore.

`build_library.py` ricrea la libreria dai file originali. `source-report.json` e `blender-import-report.json` documentano formato e importazione. `catalog.png` è una vista di confronto degli originali; la revisione della casa si trova in `../mansion-v09/`.
