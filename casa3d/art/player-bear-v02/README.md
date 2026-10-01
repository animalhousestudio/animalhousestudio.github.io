# Giocatore v02 — orso quasi nero

Sorgente Blender autonomo del personaggio: orso dal colore quasi nero, zampe
ispirate all'immagine utente `2026-09-30 150607`, lecca-lecca tondo nella mano
sinistra e tazza nera nella destra. Il lecca-lecca conserva il logo Animal House;
la tazza conserva la scritta bianca **LAB**.

La revisione riutilizza la modellazione procedurale, il rig di 52 ossa e gli
accessori del prototipo `../player-v01/`, che resta conservato. Corpo, testa,
zampe e oggetti impugnati rimangono elementi modificabili; le prese sono
organizzate attorno agli attacchi delle mani.

Lavorazione in metri, Z verticale, fronte −Y e sinistra anatomica +X. La camera
di riferimento è a **2,00 m** dal suolo, coerente con `EYE_HEIGHT` già aggiornato
in `../../src/rooms/layout.mjs`. La quota degli occhi non indica l'altezza totale
del personaggio.

## Riferimenti e scelte

Le fotografie `IMG_5628.jpeg` e `IMG_5621.jpeg` guidano le impugnature;
`logo2.png` fornisce il logo. La forma finale del lecca-lecca è circolare,
senza il supporto quadrato della fotografia.

La [conversazione condivisa](https://chatgpt.com/share/6abc3582-b184-83eb-b846-9264ee6b22c1)
è un riferimento di partenza per la pipeline. Si mantengono la separazione fra
personaggio e accessori, il riuso del rig e la revisione visiva prima delle
animazioni e dell'integrazione. Il materiale di riferimento non costituisce
un'autorizzazione a svolgere ulteriori passaggi.

Il sorgente finale contiene **39.724 triangoli**, accessori inclusi, e **52 ossa**.
Altezza misurata: **2,212 m**, adeguata alla nuova quota camera. I pesi hanno al
massimo quattro influenze per vertice; nessun vertice privo di peso. Le prove
di movimento di braccia, gambe e dita e la stabilità degli accessori passano
in `audit.json`. Nessuna generazione a pagamento.

## File e uso

- `player-bear-v02.blend`: sorgente completo, con logo originale incorporato.
- `renders/01-full-body.png`: figura intera; `04-hands.png`: dettaglio prese.
- `renders/05-first-person.png` e `06-look-down.png`: viste dalla camera a 2 m.
- `build_bear.py`, `bear_geometry.py`, `bear_head.py`, `props.py`: costruzione riproducibile.
- `verification.json`, `audit.json`, `brief.json`: misure, verifiche e ambito.

La scena si apre sulla camera `Review_Full_Body`. `Player_Rig` è nascosto solo
nel viewport per la revisione; riattivarlo per lavorare in Pose Mode. Le mesh
sono `Body_Bear_Fur`, `Hands_Bear_Paws` e `Head_Bear_Separate`. Gli oggetti sono
collegati alle ossa `hand.L` e `hand.R`; non sono fusi con le zampe. Il clip
`Idle_Hold_Review` è un lieve respiro di prova, con fotogrammi 1–91 a 30 fps.

Le due camere in prima persona sono indipendenti dalla testa e poste poco
avanti rispetto al muso, per evitare occlusioni guardando in basso. Questo è
un riferimento di authoring: l'offset non è stato applicato al gioco. Il bordo
inferiore della tazza esce parzialmente dal quadro quando si guarda orizzontale.
Il modello ha superfici semplici e un lieve rilievo procedurale del pelo:
niente sistemi di capelli. Baking dei materiali e retopologia per movimenti
ampi restano passaggi successivi alla revisione della forma.

## Ambito e stato

Questa cartella riguarda esclusivamente il sorgente Blender e le sue immagini
di revisione. Il modello non è integrato nel gioco e non è esportato in GLB.
La modifica già effettuata all'altezza della camera è indipendente dall'asset.

L'approvazione visiva resta in sospeso. Locomozione, animazioni definitive,
ottimizzazione per il gioco e integrazione appartengono a un passaggio successivo.
La revisione è di un personaggio autonomo: non richiede i controlli di consegna
di una stanza completa. Le misure sopra derivano dal file Blender salvato.
