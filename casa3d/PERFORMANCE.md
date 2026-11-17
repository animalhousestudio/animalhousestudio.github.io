# Prestazioni: regole operative

Riferimento corrente, verificato sui sorgenti il **20 ottobre 2026**.
Obiettivo: arricchire il mondo facendo dipendere il costo dal dettaglio utile
nella vista corrente, preservando movimento, collisioni e qualità leggibile.

Le misure datate sono nello [storico](docs/PERFORMANCE_HISTORY.md).
Lo [stato del progetto](docs/PROJECT_STATE.md) elenca debiti e prove mancanti;
il [diario](docs/DIARIO_DI_BORDO.md) registra ogni cambiamento.
I percorsi in codice qui sotto sono relativi a `casa3d/`.

## Cosa significa mantenere le prestazioni

Non esiste ancora un budget globale di FPS, tempo GPU o memoria validato su
una lista concordata di dispositivi. Le soglie adattive degli effetti non
costituiscono quel budget. Non promettere 60 FPS sulla base dei test.

Ogni nuovo asset deve dichiarare costo residente, dettaglio opzionale,
collisioni, materiali/texture ed eventuali aggiornamenti o passaggi aggiuntivi.
Confrontare prima/dopo nelle stesse condizioni, comprendendo il costo totale
della scena. Se un costo aumenta, documentare motivo, compensazioni e risultato
osservato. Non chiudere una regressione irrisolta dichiarando soltanto che i test passano.

I rapporti di authoring medium sotto il 30% e far sotto il 12% dei triangoli
originali sono un punto di partenza, da controllare visivamente: non garantiscono
fluidità. Per un piccolo oggetto può bastare un unico modello economico.
Prima di molte nuove attrazioni vanno fissati dispositivi e budget misurabili
con la baseline descritta sotto.

## Invarianti da mantenere

| Ambito | Regola corrente e motivo | Sorgenti principali |
| --- | --- | --- |
| Avvio | Attendere strutture, fisica e far necessari; preparare shader/materiali prima di ATTERRA. Medium/near non bloccano l'ingresso. Durante lo splash il mondo non gira continuamente; il video viene fermato e scaricato dopo la dissolvenza. | `src/main.js`, `src/rooms/garden.js` |
| Volo di arrivo e fuochi in giostra | Canvas 2D fino a 1,1 milioni di pixel e circa 30 aggiornamenti al secondo. In volo due chiamate per le raffiche dietro l'asteroide e due per i bengala dalla visuale. La giostra usa due chiamate, rimpiazzando i buffer ogni cinque secondi con sovrapposizione delle code. Gli effetti si liberano a fine sequenza e rispettano la preferenza di movimento ridotto. | `src/ui/arrivalFlight.mjs`, `src/arrivalFireworks.mjs` |
| Fari, fumo e foschia dell'asteroide | Tre SpotLight senza ombre, due sui montanti alti e uno per il giro a terra, con aggiornamento a 15 Hz. Un batch di custodie, fino a tre coni e un batch ciascuno per fumo e foschia. Entrambi riutilizzano la texture procedurale 64×64. La foschia svanisce con la quota. Gli effetti partono al suolo e si sospendono negli interni e sott'acqua. | `src/rooms/asteroidAtmosphere.mjs` |
| Dettaglio del terreno | Fino a tre settori decorativi e una mappa condivisa 512². Solo all'esterno vicino al suolo, caricamento nella coda LOD globale e rilascio dopo dieci secondi di inattività. | `src/rooms/asteroidSurfaceDetail.mjs` |
| Cataloghi e confini | Ogni collocazione ha ID, radice e zona stabili. Il batching del genitore non attraversa `streamingBoundary`/`worldZone`. | `src/world/content.mjs`, `catalog.mjs`, `zones.mjs` |
| Fisica | Catturare geometria fisica e interazioni prima delle ottimizzazioni che sostituiscono le mesh. Visibilità e LOD non rimuovono il supporto del personaggio. Porte/ascensore conservano collisioni dinamiche. | `src/player/collisionWorld.mjs`, `src/rooms/garden.js` |
| Geometria statica | Prima istanze di copie condivise, poi batch opachi per materiale/cella. Conservare esclusioni per oggetti mobili, interattivi, trasparenti, skin/morph e `staticDetail`. Casa: celle da 10 unità modello per copie oltre 100 triangoli. | `src/rooms/optimize.mjs` |
| Pulizia | Rimuovere soltanto triangoli con area esattamente zero; niente epsilon che elimini triangoli sottili validi, niente alterazione di UV o attributi condivisi. | `src/rooms/geometryCleanup.mjs` |
| Vetri | La casa usa trasparenza semplice, `transmission = 0`, `depthWrite = false`, `forceSinglePass = true`. Reintrodurre trasmissione fisica aggiunge lavoro sull'intero mondo opaco. | `src/rooms/garden.js` |
| Bounds e culling | Bounds conservativi completi, mai derivati dal solo tier/count ridotto. Usare `worldLocalBounds` per asset progressivi e `refreshBounds` dopo spostamenti. Non ricostruirli traversando tutte le mesh a ogni frame. | `src/world/zones.mjs`, `src/rooms/fluffyGrass.mjs` |
| Casa e stanze | Solo le radici `decoration` possono essere nascoste dal registro. Non spegnere automaticamente piani o interni visibili da finestre, torri e ascensore. | `src/world/content.mjs`, `zones.mjs` |
| Risorse | Liberare geometrie/materiali/texture rispettando la condivisione. Non chiudere indiscriminatamente gli ImageBitmap. `unregister` non libera risorse né collisioni. | `src/world/visualLod.mjs`, `zones.mjs` |

I tre testi del punchball mantengono visibilità autonoma: spariscono sotto
1,5 pixel di altezza carattere e tornano sopra 2 pixel. Il corpo resta presente;
il cambio non modifica le collisioni (`src/rooms/detailVisibility.mjs`).
Le trasformazioni statiche congelate non devono includere porte o pickup.

## Dettaglio progressivo: contratto attuale

Fontana, alveare e tempietto usano lo stesso controller. I dati dei file e le
fonti sono nel [registro asset](docs/ASSET_REGISTER.md).

| Parametro | Valore corrente |
| --- | --- |
| Far | Necessario all'avvio e mantenuto come fallback |
| Medium / near | Diametro proiettato nominale 80 / 260 pixel del buffer di rendering |
| Isteresi | 15%: ingresso medium 92, near 299; uscita sotto 68 / 221 pixel |
| Concorrenza | Massimo 2 caricamenti LOD globali; uno per contenuto alla volta |
| Evizione opzionali | Dopo 20 s con target far o inattivo |
| Errore opzionale | Fallback conservato, un solo retry aggiuntivo dopo almeno 15 s |
| Preparazione | Compilare i materiali opzionali prima della comparsa |

Fonti: `src/world/assetCatalog.mjs` e `visualLod.mjs`.
Scala, origine e appoggio vengono dal modello originale, non dai bounds del tier
appena caricato. Nel tempietto il minimo include il pozzo: l'appoggio è quota
terreno, non il minimo geometrico.

Fuori campo, sott'acqua, durante lo splash e a pagina nascosta non si domanda
nuovo dettaglio. Una risposta tardiva non rende visibile un tier superato;
una richiesta in coda diventata inutile non parte. I download già iniziati
non hanno cancellazione di rete: non descrivere questo sistema come streaming
con abort completo. L'errore del far richiesto segue invece l'errore di avvio.

## Effetti e situazioni che devono restare economici

| Sistema | Soluzione corrente da preservare | Fonte |
| --- | --- | --- |
| Prato | Temporaneamente disattivato da `MEADOW_ENABLED`. Quando attivo usa celle con culling e densità e dettaglio a distanza, geometrie e materiali condivisi e bounds che includono il vento. | `src/rooms/layout.mjs`, `src/rooms/fluffyGrass.mjs` |
| Giostra | Asset al massimo medium. Vicino a casa e lago solo far, senza nuove richieste opzionali. Quando il prato è attivo, in giostra l'erba sparisce oltre 9 m dal terreno, sfuma fino al 3% vicino al suolo ed è limitata alle celle locali. Alla discesa tornano i criteri normali. | `src/rooms/coasterQuality.mjs`, `src/main.js` |
| Carrelli e zampe | 7 mesh per vagone e 13.264 triangoli, con geometrie raggruppate per materiale e condivise tra copie. Posa delle zampe precalcolata. | `src/rooms/coasterCart.mjs`, `src/player/coasterPaws.mjs` |
| Colonia di gatti | Un solo GLB opzionale a 44 m dal centro di un percorso. A 34 m e in campo, 2.636 triangoli e 1 draw per gatto più 1 draw condivisa per le ombre di contatto. Scheletri a 24 Hz fino a 16 m, a 12 Hz oltre. Posa fissa con movimento ridotto. Pausa durante volo, giostra, sott’acqua e a pagina nascosta. Rilascio dopo 30 s di gioco attivo fuori portata. | `src/rooms/catColony.mjs`, `catColonyModel.mjs` |
| Fontana: effetti | Massimo 30 Hz; sospensione per distanza, frustum, dimensione, splash, pagina nascosta o movimento ridotto. Massimo 16 gocce + 8 onde, 2 draw / 2.560 triangoli aggiunti; nessuna luce puntuale dedicata. La scultura ha LOD indipendenti. | `src/rooms/chocolateAnimation.mjs` |
| Acqua | Analitico a 10 Hz senza target; vicino due target half-float 64² a 15 Hz oppure 128² a 30 Hz (64/256 KiB per coppia). Allocazione pigra, al massimo un passo per tick, rilascio dopo 10 s inutilizzati. | `src/rooms/pondQuality.mjs`, `pondWater.mjs`, `deepPond.mjs` |
| Immersione | Scene subacquee dedicate con risorse condivise, senza renderizzare casa, vegetazione, cielo e corpo esterno. Oltre 1,2 m di immersione solo onde analitiche. L'omissione della superficie oltre 24 m è prevista dal controller del singolo lago ma non propagata alla copia della scena combinata: limite aperto, descritto nello stato. Non introdurre riflessi dell'intero mondo o caustiche senza misurarli. | `src/main.js`, `src/rooms/deepPond.mjs`, `asteroidCoaster.mjs` |
| Banco dei laghetti | 537.768 byte opzionali, richiesti entro 32 m dai bounds completi. Una draw e 25.072 triangoli in vista sott’acqua per 36 pesci. Formazione e code a massimo 24 Hz e rilascio dopo 30 s lontano. Un materiale e nessuna texture o luce dedicata. | `src/rooms/fishSchoolNpc.mjs`, `fishSchoolModel.mjs` |
| Videocitofono | Target 256², massimo 12 Hz, entro 4,5 m e in campo. Comprende ritratto e possibile sfondo: è un passaggio aggiuntivo da includere nel confronto. | `src/rooms/videoIntercom.mjs`, `intercomBackground.mjs` |
| Cielo | Scena separata, camera con sola rotazione, cielo prima del mondo: nessuna parallasse o stella davanti all'asteroide. | `src/spaceSky.mjs` |
| Sala informazioni | Navigazione autonoma con rilascio del renderer del mondo. Importare soltanto moduli condivisi leggeri, senza bootstrap, GLB e video del mondo. L'ingresso nella cabina resta nel mondo principale. | `src/start.js`, `src/contact/` |

Le soglie adattive sono locali: fontana riduce dopo 2 s sotto 28 FPS e recupera
dopo 8 s sopra 50; acqua dopo 2,5 s sotto 28 e 12 s sopra 48, con cooldown.
Mantenerne sospensione, isteresi e tetto del dispositivo. Non aumentare la
frequenza al crescere degli FPS del monitor e non recuperare i tick persi dopo
una pausa con molti aggiornamenti concentrati.

## Come verificare una modifica

1. **Salvare il prima**: commit/stato del checkout, server sorgenti o build,
   dispositivo/GPU/browser, viewport, dimensioni reali del buffer, pixel ratio,
   scena/camera, stato LOD/effetti e cache fredda o calda. Non confrontare
   inquadrature, risoluzioni o tier diversi senza dichiararlo.
2. **Ripetere le stesse viste** in `?review`: facciata, interni/finestre/ascensore,
   nuovo asset vicino/medio/lontano/fuori campo, fontana/alveare/tempietto,
   citofono attivo, giostra all'1/3/5% e nei tratti casa/lago, immersione/ritorno.
   Aggiungere un percorso continuo di movimento e le interazioni interessate.
   Le viste selezionate dal pannello non sostituiscono l'avvio normale fino ad ATTERRA.
3. **Separare le prove**: primo caricamento, dettaglio opzionale ed esplorazione
   stabilizzata. Per i confronti continui usare la stessa finestra di osservazione
   (ad esempio 30 s dopo il riscaldamento), ripetendola se i risultati oscillano.
   Provare anche pagina nascosta/rientro, scaricamento e nuovo avvicinamento.
4. **Annotare il dopo e il delta**: FPS, render CPU, draw, triangoli,
   geometrie/texture residenti, richieste/byte e collisioni; stalli e frame time
   da una traccia quando disponibili. I conteggi di memoria del renderer sono
   quantità di risorse, non una misura diretta dei byte VRAM.
5. **Controllare correttezza e dispositivi**: niente salti di LOD, buchi, perdita
   di collider, gesture o input; console/shader puliti. Viewport stretta per
   layout/proiezione, dispositivo touch reale per input e prestazioni mobile.
6. **Registrare** comando/esito dei test pertinenti, evidenze, regressioni e
   prove mancanti nel diario. Conservare campioni e acquisizioni in `art/`.

Aprire `/index.template.html?review` nel server sorgenti oppure
`/casa3d/?review` nella build locale; istruzioni in [BUILD_LOCAL.md](../BUILD_LOCAL.md).
Il pannello è disponibile su `localhost`/`127.0.0.1`; espone anche il JSON
`data-state` di `[data-testid="world-diagnostics"]` con LOD, errori, risorse,
collisioni, qualità della giostra e prestazioni.

**Interpretazione:** `renderMs`/«render CPU» misura un intervallo JavaScript
che comprende dettagli/animazione e chiamate di rendering; non è tempo GPU.
Draw e triangoli includono i passaggi del frame, compresi acqua/citofono.
Per dichiarare ms GPU occorre una misura separata, con strumento e dispositivo
espliciti. `?review&baseline` disattiva solo alcuni batch; mantiene instancing,
vetri semplificati, LOD e alcuni batch interni: è un confronto parziale.

I test da scegliere per famiglia sono nella [guida contenuti](WORLD_CONTENT.md#verifica-prima-di-integrare).
La suite generale resta `node --test casa3d/test/*.test.mjs` dalla radice.
L'esito corrente della suite e la diagnosi dei problemi risolti sono nello
[stato corrente](docs/PROJECT_STATE.md#test-e-debito-tecnico).
