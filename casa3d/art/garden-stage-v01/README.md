# Palco da giardino — stato corrente e proposta storica

## Stato ricostruito dai sorgenti il 20 ottobre 2026

Il palco è integrato nel mondo principale: `src/world/content.mjs` registra
`garden-stage`, radice `GardenStage`, zona `outdoor:garden`, come struttura;
`src/world/assetCatalog.mjs` importa il GLB residente. La data sopra è quella
del riordino documentale e non attribuisce una nuova data di integrazione.

Il sorgente corrente è `garden-stage.blend`; `resize_stage.py` conserva il
passaggio di ampliamento e `export_stage.py` produce
`../../src/assets/models/props/garden-stage.glb`. `export-report.json` attesta
18.320 triangoli, 1.853.828 byte, 10 materiali e cinque texture del legno 512²;
registra inoltre la richiesta utente di integrazione del 5 ottobre 2026.
`verification.json` riguarda le verifiche geometriche del modello ampliato.

Il comportamento corrente è definito da `../../src/rooms/gardenStage.mjs` e
`../../src/rooms/stageLayout.mjs`: pedana 24 × 12 m, piano a 1,92 m, scala
`1 / WORLD_SCALE` sotto il giardino, collider semplici separati dal visivo e
raggruppamento del visivo per materiale all'interno della radice.
`stageLayout.mjs` è il riferimento attuale di posizione e ingombro;
`placement-report.json` conserva una collocazione precedente.

`runtime/browser-verification.json` e le immagini in `runtime/` documentano
un caricamento del palco nel gioco. Sono prove funzionali circoscritte,
non misure FPS/tempo GPU o una prova completa di percorribilità su dispositivi
target. Non vengono desunte nuove approvazioni da questi file.

La proposta sotto, `geometry-report.json`, `milestone-reviews.json` e
`final-report.json` restano documenti storici della prima revisione isolata;
le loro dichiarazioni di mancato export e integrazione non descrivono più il
runtime corrente. Il [registro degli asset](../../docs/ASSET_REGISTER.md)
collega sorgenti, inventario attivo ed evidenze.

## Proposta iniziale v01 — storico

Il testo seguente descrive il pacchetto di revisione di un **asset isolato**,
modellato in Blender dalla foto fornita dall'utente, prima dell'ampliamento e
dell'inserimento nel gioco. Stato, dimensioni e passaggi futuri vanno letti nel
contesto di quella proposta.

## Modello

- `garden-stage.blend`: sorgente modificabile, scena `GardenStage_Review`.
- `build_stage.py`: ricostruzione procedurale del modello e dello studio.
- `GardenStage_ASSET`: geometria del palco, parent `GardenStage`, origine al
  centro della pedana a livello terreno. `ReviewStudio_DO_NOT_EXPORT` contiene
  fondale, luci di studio e camera, da escludere da un futuro export.
- Pedana **8 × 4 m**, piano a **0,64 m**, con 70 assi marroni su supporto continuo.
- Struttura aperta con quattro montanti, tubi semplici e controventi corti;
  quattro fari, due gruppi cassa/sub laterali, due monitor e un microfono.
- Due scalette frontali: tre gradini e raccordo al piano, quattro alzate da 0,16 m.

`geometry-report.json` misura la geometria valutata con modificatori: **160
oggetti mesh, 14.512 triangoli**, ingombro complessivo circa **9,96 × 5,145 ×
4,555 m**. Questi conteggi non dimostrano prestazioni o percorribilità nel gioco.
`fixtures.json` descrive i quattro fari: lente emissiva, senza luci dinamiche di
default. Le luci dello studio servono soltanto alla revisione.

Il legno usa shader procedurali Blender, senza texture esterne. Prima del GLB
servono un bake PBR oppure una strategia di materiali glTF equivalente, con
verifica visiva; i nodi Noise/ColorRamp/Bump non vanno considerati già esportabili.

## Revisione

Viste previste in `renders/`: `stage-three-quarter.png`, `stage-front.png`,
`stage-rear.png`, `stage-top.png`. Sono viste dell'asset nello studio, non prove
di inserimento o interazione nel giardino. Lo stato dei gate e delle verifiche
è in `milestone-reviews.json` e `final-report.json`.

Per ricostruire, eseguire `build_stage.py` con Blender (`blender --background
--python build_stage.py`). Lo script crea una nuova scena e salva il sorgente
in questa cartella; non esegue l'export GLB né il rendering delle quattro viste.

## Futuro inserimento in Casa3D

Contratto ricavato in sola lettura da `../../AGENTS.md`,
`../../WORLD_CONTENT.md` e dai moduli di layout esistenti:

1. Il sorgente è in metri, Z verticale, fronte verso −Y Blender. L'export glTF
   standard porta il fronte a +Z gioco. Sotto `garden`, già soggetto a
   `WORLD_SCALE = 5`, applicare **scala 0,2**: pedana 1,6 × 0,8 unità locali,
   piano a 0,128. Evitare di applicare la conversione due volte.
2. Punto candidato, da confermare in gioco: locale **(−18, 0, 2)**, mondo
   **(−90, 0, 10)**, yaw 0, a est del laghetto con fronte verso l'accesso sud.
   Il rettangolo prudente locale X [−19,2; −16,8], Z [1,6; 3,0] passa i controlli
   esistenti di laghetto, vialetti, bordo giardino, casa/campo/altri prop e non
   interseca gli AABB delle chiome dei 12 alberi ricostruiti dal GLB. Non è una
   verifica BVH né una collocazione approvata. Riservare anche il prato sotto
   pedana e scalette prima della generazione dell'erba.
3. Usare una radice stabile `GardenStage` e una voce `garden-stage` nel catalogo
   contenuti, zona `outdoor:garden`, `kind: 'structure'` perché percorribile.
   Il costruttore resta in `src/rooms/`; aggiungere un asset al catalogo riusabile
   solo insieme alla relativa strategia di caricamento.
4. Separare visuale e collider: slab continuo per il piano e volumi semplici
   per gradini/supporti. Aggiungere la radice alla costruzione collisioni in
   `main.js`, prima del batching, e conservarne il confine di streaming.
   Le alzate da 0,16 m sono inferiori allo step di 0,4 m del controller;
   il passaggio va comunque provato con il personaggio.
5. Dopo l'inserimento verificare scala, appoggio, accessi, erba, camera,
   collisioni e rendering con `?review`; definire e misurare il budget runtime.
   Nessuno di questi passaggi è attestato da questo pacchetto.

Sono presenti modifiche preesistenti a runtime, cataloghi e LOD del progetto:
questa proposta le preserva e non modifica file esterni alla propria cartella.
