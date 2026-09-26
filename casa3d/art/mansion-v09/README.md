# Casa v09 — albero numero 5

Il progetto corrente è `mansion-v09-trees.blend`; il gioco usa `src/assets/models/mansion-v09.glb`. Mantiene le riparazioni architettoniche e le collisioni della v08.

`tree (5).glb` sostituisce i due vecchi oggetti `M01_Reuse_TREE_Left_*`. La nuova coppia `M09_HouseTree_Number5_Branches` / `M09_HouseTree_Number5_Leaves` si trova nella collezione `M09_01_Packed_House_Tree`. Altezza 18,5 unità del modello, proporzioni originali, radice leggermente inserita nel terreno. La posizione lascia libera la facciata.

La libreria di origine con texture incorporate è `../trees-v01/trees-natural.blend`. Il gioco distribuisce altri sei alberi sull'asteroide attraverso `src/rooms/naturalTrees.mjs` e `treePlacement.mjs`.

Per ricreare la casa, eseguire `replace_tree.py` sulla v08 dopo aver costruito la libreria degli alberi, quindi `export_house.py`. L'esportazione conserva le geometrie condivise e i modificatori editabili. La v08 rimane disponibile come copia precedente.

34 controlli mirati superati: file e materiali degli alberi, posizionamento, collisione dei tronchi, casa aggiornata, porte, finestre, ascensore e percorsi. Prova finale in gioco lasciata all'utente dopo la build e la conferma del server.
