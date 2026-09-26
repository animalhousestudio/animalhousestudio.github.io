# Casa v10 — ascensore circolare monoposto

Sorgente: `mansion-v10-circular-lift.blend`. Asset pronto per la prossima build:
`../../src/assets/models/mansion-v10.glb`. La v09 rimane conservata integralmente.

Il riferimento fornito dall'utente guida il vetro cilindrico e i montanti metallici.
Dimensioni effettive in gioco (il mondo moltiplica il modello per cinque):

| Parte | Dimensione |
| --- | --- |
| Cabina | diametro 1,60 m, altezza libera 2,30 m |
| Vano | diametro nominale 2,20 m |
| Apertura nei solai | diametro 2,30 m |
| Passaggio della porta | larghezza nominale 1,00 m |
| Raccordo circolare | 24 segmenti |

Il vano resta sull'asse precedente, con accesso sul lato +Z del gioco (-Y in
Blender) a tutti e cinque i piani: cantina, salotto, primo piano, galleria,
osservatorio. La simmetria circolare ha una sola eccezione funzionale: l'accesso
frontale e i relativi comandi. Le porte curve scorrono lateralmente lungo il vano.
La cabina e le porte mobili sono definite in `../../src/rooms/elevator.mjs`;
Blender contiene il vano fisso e le soglie. Il soffitto della cantina è generato
da `../../src/rooms/interior.mjs` con il medesimo foro circolare.

Le vecchie aperture quadrate dei solai sono state riempite mediante unione
booleana e poi ritagliate con il nuovo diametro. Anche il taglio nel tetto usa il
vano ridotto. Le soglie hanno forma di settore anulare, così non attraversano la
corsa della cabina. Le quote dei piani e il perimetro esterno della casa restano
quelli della v09.

Il giro di ottimizzazione scioglie suddivisioni quasi complanari entro 0,5 gradi,
preservando separazioni dei materiali, UV, cuciture e spigoli di ombreggiatura.
107 geometrie alleggerite: 17.208 triangoli ridondanti rimossi dal passaggio di
semplificazione, prima dell'aggiunta della nuova geometria circolare. Il modello
risultante conta 347.992 triangoli valutati nell'insieme destinato all'export.
`source-inventory.json` conserva l'inventario precedente; `change-report.json`
registra le operazioni e i conteggi ottenuti durante la scrittura degli asset.

Il giardino usa pietre da 96 triangoli anziché 112 e un centro senza triangoli
degeneri nell'area laghetto: risparmio di `16 × numero di pietre + 64` triangoli,
almeno 4.608 per bordo e laghetto, oltre al sentiero.

## Stato concordato

L'utente ha richiesto esplicitamente di fermarsi prima della build senza ulteriori
controlli. Eseguiti l'inventario mirato, le modifiche e la preparazione degli asset.
Non eseguiti build, test, render di revisione, prove in gioco o pubblicazione.
I test esistenti dell'ascensore sono aggiornati alle nuove dimensioni ma non
eseguiti. Nessuna approvazione visiva o runtime viene desunta dai conteggi.

Per rigenerare questa revisione, aprire la v09 ed eseguire `compact_elevator.py`:
salva il nuovo `.blend` ed esporta il GLB nei sorgenti, senza compilare il gioco.
