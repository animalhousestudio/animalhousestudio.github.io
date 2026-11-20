# Scimmia NPC v01

La [v03 attiva](../scimmia-npc-v03/README.md) sostituisce il GLB di gioco.
Questa cartella conserva le prime due versioni e le rispettive prove.

Prototipo di authoring per il primo NPC di Casa3D. Il volto riprende il panda
allegato alla richiesta del 12 novembre 2026: orecchie tonde, maschere nere,
iridi ambra, ghigno con denti dorati e ciuffi scolpiti. Il corpo ha le braccia
lunghe e la postura bassa di una scimmia che cammina sulle nocche.

## Prova nel gioco

Il [GLB](../../src/assets/models/props/scimmia-npc.glb) contiene la mesh e
quattro azioni senza traslazione del root. [L'exporter](export_runtime.py) usa
il [sorgente Blender v02](Scimmia_NPC_v02.blend) e imposta prese e lanci per
i montanti quadrati da 32 cm.
[Il percorso](../../src/rooms/scimmiaRoute.mjs) riusa le coordinate dei
25 montanti istanziati del tratto continuo verso il lago. Il motore sposta
e orienta il personaggio in gioco, mentre la coda usa quattro ossa animate.
Per seguirlo aprire `/index.template.html?review&view=monkey` sul server Vite.
La [prova browser](runtime/check-browser.cjs) usa Chrome e Playwright.
Il [rapporto v02](runtime/v02/browser-report.json) registra l'atterraggio
normale, tutte le 25 prese e il confronto a camera fissa su Intel UHD 630.
Il [rapporto v01](runtime/browser-report.json) include atterraggio reale, giro
completo, richieste di rete e confronto a camera fissa. In Chrome su Intel
UHD 630, a 1080 × 720, le chiamate passano da 588 a 589 e i triangoli per
fotogramma da 922.315 a 935.925 con la scimmia in presa. Entrambi i campioni
restano intorno ai 30 FPS. Questa è una verifica della posa fissa e del
relativo costo di disegno. Il tempo GPU e il confronto su mobile restano
da misurare.

[Conteggi e hash v02](verification-v02.json) ·
[Camminata v02](renders/v02/camminata.png) · [Presa sopra il masso](runtime/v02/grip-over-rock.png)

## Revisione in Blender v01

Aprire [Scimmia_NPC.blend](Scimmia_NPC.blend) e premere **Spazio** per avviare
il tour di 14 secondi. La camera segue l'NPC. In Timeline i marker
individuano le azioni. Per isolare o modificare un'azione, selezionare
`Scimmia | rig` e aprire il Nonlinear Animation Editor. Per vedere il
volto da vicino è disponibile anche la camera `Ritratto`.

| Fotogrammi (24 fps) | Azione |
| --- | --- |
| 1–97 | Due cicli di camminata con appoggio alternato di piedi e nocche |
| 97–193 | Presa e arrampicata sul primo palo, poi scavalcamento |
| 193–245 | Caricamento, volo tra i pali e atterraggio |
| 245–301 | Salto dal secondo palo al tetto |
| 301–337 | Assestamento e sguardo verso la camera |

[Video del tour](renders/Scimmia_Tour.mp4) ·
[Ritratto](renders/Scimmia_Ritratto.png) · [Camminata](renders/camminata.png) ·
[Arrampicata](renders/arrampicata.png) · [Salto](renders/salto.png) ·
[Tetto](renders/tetto.png)

Pavimento, pali e tetto sono appoggi della scena di prova, raccolti insieme
in una collezione distinta. Le azioni hanno un osso root con spostamento
incorporato nella scena. Prima di riutilizzarle nel mondo, riallineare root,
durate, distanze e prese alle posizioni effettive dei pali e della casa.
Il sorgente è in metri, Z verticale e fronte verso −Y.

## Geometria e verifica

Una mesh skinnata con 13.610 triangoli e 7.288 vertici, un materiale opaco
con colori ai vertici, zero texture, 17 ossa di cui 16 deformanti e massimo
due influenze per vertice. Altezza in posa di riposo 1,70 m. La silhouette
del pelo è modellata. La soluzione analitica delle articolazioni è applicata
durante la generazione delle azioni e salvata come keyframe ogni due
fotogrammi. Il rig del file riproduce le azioni senza dipendenze esterne.

[verification.json](verification.json) riporta SHA-256, conteggi e bounds
campionati su tutti i fotogrammi. Gli errori misurati riguardano i punti di
controllo degli arti, con massimo 1,96 cm durante la camminata e quote
raggiunte alle caviglie nei fotogrammi di atterraggio. Queste misure riguardano
la scena di prova. Riaprendo il sorgente, una verifica ogni sei fotogrammi
conferma che la sagoma resta interamente nella camera del tour. La review
visiva e il posizionamento nel gioco restano da approvare. In caso di
integrazione, misurare costo e leggibilità in `?review`,
controllare l'intero percorso e stabilire se basta un singolo livello di
dettaglio. Mesh, luci e geometrie degli appoggi di studio sono separate.

Rigenerazione della v02 con Blender 5.2 dalla radice del repository.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python-exit-code 1 --python casa3d/art/scimmia-npc-v01/build_scimmia.py -- --stills
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python-exit-code 1 --python casa3d/art/scimmia-npc-v01/export_runtime.py
```
