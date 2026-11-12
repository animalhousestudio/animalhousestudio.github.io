# Registro degli asset attivi

Inventario ricostruito dai sorgenti e dai pacchetti `art/` il **20 ottobre 2026**.
La data descrive questo censimento, non la data di inserimento dei singoli asset.
La presenza di un `.blend`, di un render o di un vecchio rapporto non dimostra
che una variante sia quella caricata dal gioco.

Per le regole da conservare leggere [PERFORMANCE.md](../PERFORMANCE.md); per
l'inserimento seguire [WORLD_CONTENT.md](../WORLD_CONTENT.md). Ogni modifica
va registrata nel [diario di bordo](DIARIO_DI_BORDO.md), collegando qui il
pacchetto dell'asset quando cambia l'inventario.

## Come leggere il registro

- [content.mjs](../src/world/content.mjs) identifica le collocazioni e le radici;
  [assetCatalog.mjs](../src/world/assetCatalog.mjs) dichiara gli asset riusabili
  statici e i tre modelli con tier visivi. Altri GLB sono importati direttamente
  dai costruttori: il solo catalogo asset non è l'intero elenco dei download.
- Triangoli e byte sotto sono conteggi dei file o del sorgente esplicitamente
  indicato. Non sono chiamate di disegno, memoria GPU, FPS o costo della scena.
  Le trasformazioni e i raggruppamenti runtime possono cambiare i conteggi
  effettivamente disegnati.
- Un riscontro browser conservato vale per quella sequenza e revisione. Un
  viewport stretto non certifica prestazioni o input su un telefono reale.
  Non sono stati eseguiti nuovi benchmark durante questo riordino documentale.

## Modelli con dettaglio progressivo

Gli URL e i bounds correnti sono dichiarati nel catalogo; i file visuali sono
in [props/](../src/assets/models/props/) e [lod/](../src/assets/models/lod/).
Il livello `far` è richiesto all'avvio; `medium` e `near` sono opzionali.
Per soglie, scaricamento e gestione degli errori fa fede il contratto di
[PERFORMANCE.md](../PERFORMANCE.md#dettaglio-progressivo-contratto-attuale).

| Asset / collocazione | Tier | Triangoli | Byte | Fonte dei conteggi |
| --- | --- | ---: | ---: | --- |
| Fontana / `chocolate-fountain` | far | 10.229 | 342.388 | [metadata](../src/assets/models/lod/metadata.json) |
| | medium | 40.999 | 1.079.860 | stessa fonte |
| | near originale | 207.706 | 4.967.136 | stessa fonte |
| Alveare / `landing-beehive` | far | 10.444 | 544.296 | [metadata](../src/assets/models/lod/metadata.json) |
| | medium | 24.746 | 1.673.696 | stessa fonte |
| | near originale | 112.756 | 5.419.764 | stessa fonte |
| Tempietto / `lynx-temple` | far | 30.808 | 1.876.004 | [metadata](../src/assets/models/lod/lynx-temple-metadata.json) |
| | medium | 87.568 | 5.041.544 | stessa fonte |
| | near | 324.328 | 16.867.424 | stessa fonte |
| Tempietto, fisica residente | collision | 11.296 | 307.680 | [manifest](../art/lynx-temple-v01/manifest.json) |

**Fontana.** Sorgente
[triton-chocolate-fountain.blend](../art/triton-fountain-v01/triton-chocolate-fountain.blend),
export iniziale [export_game.py](../art/triton-fountain-v01/export_game.py),
derivazione dei tier [generate_lods.py](../art/world-lod/generate_lods.py).
Il [manifest LOD](../art/world-lod/manifest.json) conserva hash, materiali,
texture e bounds originali; [review studio](../art/world-lod/README.md) e
[review runtime](../art/world-lod/runtime/README.md) distinguono immagini,
campioni funzionali e limiti. Il [costruttore](../src/rooms/chocolateFountain.mjs)
normalizza tutti i tier con gli stessi bounds e mantiene il collider semplice
separato. Gli effetti sono gestiti da
[chocolateAnimation.mjs](../src/rooms/chocolateAnimation.mjs).

**Alveare.** Sorgente
[beehive-dreamy.blend](../art/beehive-v01/beehive-dreamy.blend),
[export_game.py](../art/beehive-v01/export_game.py) e stessa pipeline LOD della
fontana. I bounds originali regolano scala e appoggio; l'altezza nel mondo è
2,7 m. [beehive.mjs](../src/rooms/beehive.mjs) separa i collider dal dettaglio e
[beeSwarm.mjs](../src/rooms/beeSwarm.mjs) gestisce le api fuori dal batching
statico. La posizione è quella di [arrivalLayout.mjs](../src/rooms/arrivalLayout.mjs):
l'alveare è quattro metri avanti rispetto al cesto, a sinistra del monolite. Le coordinate del
[README iniziale](../art/beehive-v01/README.md) sono storiche.

**Tempietto.** Sorgente
[Tempio_della_Lince.blend](../art/lynx-temple-v01/Tempio_della_Lince.blend),
[export_temple.py](../art/lynx-temple-v01/export_temple.py),
[manifest](../art/lynx-temple-v01/manifest.json) e
[guida del pacchetto](../art/lynx-temple-v01/README.md).
Il sorgente è in metri: scala `1 / WORLD_SCALE` sotto il giardino. Il terreno a
quota zero è il riferimento di appoggio; il minimo dei bounds include il pozzo.
La fisica è residente e indipendente dai tier; botola chiusa e oracolo statico.
Le [viste di authoring](../art/lynx-temple-v01/authoring-review/) confrontano
sorgente e tier. Il [rapporto del 20 ottobre](../art/lynx-temple-v01/final-report.json)
attesta test e build locale, ma mantiene **la verifica browser finale in attesa**.
La [singola vista vicina](../art/lynx-temple-v01/runtime/near.jpg) precedente
non chiude questa verifica e non misura prestazioni su dispositivi target.

## Modelli residenti principali

| Asset caricato | Sorgente e pipeline conservati | Conteggi attestati / trattamento |
| --- | --- | --- |
| [mansion-v10.glb](../src/assets/models/mansion-v10.glb) | [sorgente v10](../art/mansion-v10/mansion-v10-circular-lift.blend), [compact_elevator.py](../art/mansion-v10/compact_elevator.py), [export_house.py](../art/mansion-v10/export_house.py) | [11.632.948 byte](../art/mansion-v10/export-report.json); [347.992 triangoli del sorgente destinato all'export](../art/mansion-v10/README.md). Correzioni, materiali, collisioni e raggruppamenti sono applicati anche a runtime. |
| [asteroid.glb](../src/assets/models/asteroid.glb) | [asteroid-v03.blend](../art/asteroid-v03/asteroid-v03.blend), [revise_asteroid_v03.py](../art/asteroid-v03/revise_asteroid_v03.py), a partire dalla [v02](../art/asteroid-v02/README.md) | [10.560 triangoli, 1.050.448 byte](../art/asteroid-v03/stats.json) del GLB base; il file attivo e [asteroid-v03.glb](../art/asteroid-v03/asteroid-v03.glb) hanno lo stesso SHA-256 al censimento. I fori dei laghi sono applicati a runtime. |
| [garden-stage.glb](../src/assets/models/props/garden-stage.glb) | [garden-stage.blend](../art/garden-stage-v01/garden-stage.blend), [build_stage.py](../art/garden-stage-v01/build_stage.py), [resize_stage.py](../art/garden-stage-v01/resize_stage.py), [export_stage.py](../art/garden-stage-v01/export_stage.py) | [18.320 triangoli, 1.853.828 byte](../art/garden-stage-v01/export-report.json), 10 materiali; cinque texture del legno 512². Scala `1 / WORLD_SCALE`, collider semplici separati. |
| [lollipop-basket.glb](../src/assets/models/props/lollipop-basket.glb) | [lollipop-basket.blend](../art/lollipop-basket-v01/lollipop-basket.blend), [build_basket.py](../art/lollipop-basket-v01/build_basket.py) | [32.407 triangoli, 1.077.088 byte](../art/lollipop-basket-v01/manifest.json), sei materiali, logo incorporato; scala `1 / WORLD_SCALE`, collider cilindrico separato. |
| [music-monolith.glb](../src/assets/models/props/music-monolith.glb) | [Sorgente Blender](../art/animale-artificiale-v01/Animale_Artificiale.blend), [esportazione](../art/animale-artificiale-v01/export_runtime.py) e [manifest](../art/animale-artificiale-v01/runtime-export.json) | `music-monolith` residente all'arrivo. GLB: 376 triangoli, 17.500 byte. Schermo: JPG 744 × 1168 da 102.809 byte, 2 triangoli di fondo e 2 per i comandi. Texture dei comandi 720 × 120 RGBA, aggiornata al cambio di stato. Scala `1 / WORLD_SCALE`, collider separato di 12 triangoli. |
| [contact-booth.glb](../src/assets/models/props/contact-booth.glb) | [contact-booth.blend](../art/contact-booth-v01/contact-booth.blend), [export_exterior.py](../art/contact-booth-v01/export_exterior.py), successivo [update_glass.py](../art/contact-booth-v01/update_glass.py) | [6.684 triangoli, 427.880 byte](../art/contact-booth-v01/exterior-metadata.json); scala `2 / WORLD_SCALE`, collider separati e anta dinamica. |
| [player-bear.glb](../src/assets/models/player-bear.glb) | [player-bear-v02.blend](../art/player-bear-v02/player-bear-v02.blend), [build_bear.py](../art/player-bear-v02/build_bear.py), [export_preview.py](../art/player-bear-v02/export_preview.py) | Caricato da [firstPersonBody.mjs](../src/player/firstPersonBody.mjs), in metri fuori da `WORLD_SCALE`. [39.724 triangoli e 52 ossa](../art/player-bear-v02/verification.json) riguardano il sorgente di authoring, non un manifest verificato del GLB attivo. |
| [trees-natural.glb](../src/assets/models/trees-natural.glb) | [trees-natural.blend](../art/trees-v01/trees-natural.blend), [build_library.py](../art/trees-v01/build_library.py) | [5.249.000 byte](../art/trees-v01/library-report.json); varianti Green 13.872, Gold 13.668, Red 21.512 triangoli. [Il runtime](../src/rooms/naturalTrees.mjs) richiede 12 collocazioni con geometrie condivise e istanze per celle; tronchi solidi, foglie senza collisioni. |
| [rocks-natural.glb](../src/assets/models/rocks-natural.glb) | [rocks-natural.blend](../art/rocks-v01/rocks-natural.blend), [import_rocks.py](../art/rocks-v01/import_rocks.py) | [Import report](../art/rocks-v01/import-report.json): Rock_A 1.646 e Rock_B 192 triangoli; texture al massimo 1024. [naturalRocks.mjs](../src/rooms/naturalRocks.mjs) gestisce distribuzione e istanze. |
| [entry-stairs.glb](../src/assets/models/entry-stairs.glb) | [entry-stairs.blend](../art/entry/entry-stairs.blend), [build_entry.py](../art/entry/build_entry.py), profilo condiviso [entryProfile.json](../src/rooms/entryProfile.json) | Il profilo condiviso guida esportazione e supporto del personaggio; manca un manifest dedicato con conteggi/hash nel pacchetto `art/entry/`. |

La casa principale predefinita è **v10**, selezionata in
[garden.js](../src/rooms/garden.js); la presenza di
[art/mansion-v11/](../art/mansion-v11/) non la rende attiva. Il
[README v10](../art/mansion-v10/README.md) descrive la consegna del sorgente e
la pausa di verifica di allora: non è il riepilogo delle successive correzioni
runtime. Per lo stato corrente e le verifiche aperte usare
[PROJECT_STATE.md](PROJECT_STATE.md).

### Riscontri e limiti per i residenti recenti

- **Palco:** [stato corrente e storico](../art/garden-stage-v01/README.md),
  [verifica di authoring](../art/garden-stage-v01/verification.json) e
  [campione browser](../art/garden-stage-v01/runtime/browser-verification.json).
  Il campione dimostra un caricamento nel gioco e conserva viste, non un
  benchmark o una certificazione di tutti i passaggi del giocatore. Il vecchio
  `final-report.json` resta il rapporto della proposta iniziale; il
  [rapporto di collocazione](../art/garden-stage-v01/placement-report.json)
  conserva una posizione precedente rispetto al `stageLayout.mjs` corrente.
- **Cesto:** [guida](../art/lollipop-basket-v01/README.md),
  [render del GLB reimportato](../art/lollipop-basket-v01/renders/export-oblique.png)
  e [rapporto finale](../art/lollipop-basket-v01/final-report.json).
  Test e build sono registrati; **la QA browser finale e la prova touch reale
  sono ancora aperte** nel rapporto. Le immagini parziali in
  [runtime/](../art/lollipop-basket-v01/runtime/) non attestano l'intera checklist.
- **Cabina:** [contratto corrente](../art/contact-booth-v01/README.md),
  [pulsanti integrati](../art/contact-booth-v01/runtime/integrated-controls.png)
  e [porta chiusa nel mondo](../art/contact-booth-v01/runtime/door-closed-integrated.png).
  Le prime prove della cabina autonoma sono storiche. I controlli di rete degli
  ingressi separati devono essere aggiornati quando cambiano gli import: il
  vecchio elenco di moduli esclusi non va copiato come contratto attuale.
- **Personaggio e alberi:** i README iniziali dicono rispettivamente "non
  esportato" e "sei alberi". Gli import e i costruttori correnti sopra mostrano
  lo stato successivo. Manca per il personaggio un rapporto unico aggiornato
  che leghi sorgente, export attivo, hash e revisione completa nel gioco.

## Altri contenuti attivi e sorgenti condivisi

| Contenuto | Fonte corrente / provenienza | Evidenza e lavoro documentale da completare |
| --- | --- | --- |
| UFO, tastiera e macchina da pugni | [asteroidProps.mjs](../src/rooms/asteroidProps.mjs) importa [ufo.glb](../src/assets/models/props/ufo.glb), [keyboard1.glb](../src/assets/models/props/keyboard1.glb), [punchmachine.glb](../src/assets/models/props/punchmachine.glb) | Il runtime normalizza, corregge materiali/UV e rimuove parti da studio. In questo censimento non è stato identificato un pacchetto `art/` con sorgente riproducibile e manifest che corrisponda esplicitamente a ciascuno dei tre GLB. |
| Campo da calcio | [soccer-pitch.glb](../src/assets/models/soccer-pitch.glb), [garden.js](../src/rooms/garden.js), [rockLayout.mjs](../src/rooms/rockLayout.mjs) | Il catalogo registra `soccer-pitch` come struttura. Non è stato identificato un manifest dedicato che colleghi GLB, sorgente di authoring e verifiche finali. |
| Prato | [fluffyGrass.mjs](../src/rooms/fluffyGrass.mjs), [grassPlacement.mjs](../src/rooms/grassPlacement.mjs), [grassLODs.glb](../src/assets/fluffy-grass/grassLODs.glb) | [Provenienza FluffyGrass](../art/landscape-v01/README.md#attribution) e [licenza](../src/assets/fluffy-grass/LICENSE). Le impostazioni correnti sono nel codice e in `PERFORMANCE.md`; i numeri iniziali del paesaggio sono storici. |
| Vialetti, laghetti e corridoio allagato | [roundStoneLandscape.mjs](../src/rooms/roundStoneLandscape.mjs), [deepPond.mjs](../src/rooms/deepPond.mjs), [basinPortal.mjs](../src/rooms/basinPortal.mjs) | Geometria prodotta nel codice, layout condivisi e supporti fisici. [Attribuzione acqua](../src/assets/water-reference/README.md) e [licenza](../src/assets/water-reference/LICENSE) da conservare. Non esiste un unico GLB da sostituire. |
| Giostra | [coasterLayout.mjs](../src/rooms/coasterLayout.mjs), [asteroidCoaster.mjs](../src/rooms/asteroidCoaster.mjs), [coasterQuality.mjs](../src/rooms/coasterQuality.mjs) | [Report v01](../art/coaster-performance-v01/report.json) e [v02](../art/coaster-performance-v02/report.json) sono prove circoscritte della giostra. Il dettaglio degli altri asset e il prato dipendono anche dallo stato del giro. |
| Audio di Animale Artificiale | [Associazione WAV/MP3 e hash](../art/animale-artificiale-v01/audio-encoding.json), [sorgente dati](../src/rooms/musicAlbum.mjs) | 13 MP3 a 192 kbps, 12.491.749 byte totali. Una sola sorgente HTML Audio, caricata su richiesta. |
| Disco iniziale `animaleartificale01` | [Nove MP3](../audio/animaleartificale01/), [manifest Blender e hash](../art/animale-artificiale-v01/album-01-export.json) | 74.642.275 byte, copia dei file originali. Seconda grafica del player da 86.418 byte. Entrambi i dischi condividono lo stesso elemento HTML Audio. |
| Indicatore traccia e graffito CAMBIA | [musicMonolithDisplay.mjs](../src/rooms/musicMonolithDisplay.mjs) | Due piani da quattro triangoli complessivi, con texture 490 × 68 e 272 × 144. L'indicatore si aggiorna al cambio di stato. Scritta e graffi vengono disegnati all'avvio sullo stesso piano, in basso a destra. |
| Ascensore, videocitofono, jetpack, tazza e sala separata | Contratti e moduli collegati in [WORLD_CONTENT.md](../WORLD_CONTENT.md) | Contenuti costruiti o assemblati nel runtime. Non dedurne il costo o il comportamento dai soli manifest dei GLB; verificare interazioni, timer, risorse aggiuntive e rientro nel mondo. |

## Aggiornamento del registro

Per ogni nuovo asset o variante sostituita aggiungere: ID asset e contenuto,
GLB effettivamente importato, sorgente e script, manifest con hash, tier e
conteggi, riferimento di scala/appoggio, proprietario della fisica e link alle
prove. Scrivere esplicitamente ciò che manca. Il diario conserva motivo,
impatto e stato del lavoro; questo registro conserva i riferimenti alla
versione attiva. Le prove storiche restano datate e non vengono promosse
automaticamente a verifica dello stato corrente.
