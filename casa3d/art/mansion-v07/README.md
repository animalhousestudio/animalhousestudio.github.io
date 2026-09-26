# Casa v07 — rifinitura e risorse condivise

Il progetto attivo è `mansion-v07-refined.blend`; il gioco usa `src/assets/models/mansion-v07.glb`.
La revisione precedente rimane in `art/mansion-v04/mansion-v06-interior-clean.blend`.

- Ricostruite 33 tavole curve attorno agli accessi, senza giunzioni aperte o facce interne duplicate.
- Corretto il collegamento delle facce di sei cornici sopra le finestre.
- Rimossi 15.452 tappi interni fra segmenti delle pareti e 20 facce collassate.
- Uniformati i materiali condivisi dei vetri. I vetri non proiettano ombre opache nel gioco.
- Pavimenti e soglie mantengono gli oggetti nominati; i vecchi piani di appoggio procedurali rimangono invisibili e servono solo al movimento.
- Collezioni separate per pavimenti/soglie, vetri dell'ascensore e corrimani/strumenti di taglio.
- Le copie archiviate sono recuperabili nella v06; sono state rimosse dalla nuova scena.

| Risorsa | v06 | v07 |
| --- | ---: | ---: |
| Triangoli della casa valutata | 412.887 | 370.385 |
| Geometrie distinte nel sorgente | 1.054 | 865 |
| GLB | 13.087.296 byte | 10.626.512 byte |

`polish_house.py` ricrea la revisione partendo dalla v06. Non eseguirlo sulla v07.
`export_house.py` riesporta la v07 valutando i modificatori solo temporaneamente: il sorgente rimane modificabile e le geometrie ripetute restano condivise.
Non rinominare liberamente porte, pavimenti, ascensore o oggetti `ACCESS_`: il gioco usa questi nomi per gli accessi e le animazioni.

Le rocce sono in `art/rocks-v01/rocks-natural.blend` e `src/assets/models/rocks-natural.glb`.
Il gioco carica due varianti, riusa geometrie/materiali in istanze suddivise per zona e verifica l'intero ingombro contro il campetto, comprese le porte e 75 cm di margine.
Le texture sono incorporate, limitate a 1024 pixel; il GLB complessivo pesa 566.308 byte.
Panchina, laghetto, ruscello, alberi, cespugli e fiori fatti da primitive sono stati eliminati dal giardino. Erba, campetto, UFO, tastiera, punchball e asset della casa sono conservati.

Controlli prima dell'avvio del server: topologia Blender senza facce collassate o spigoli condivisi da oltre due facce; test degli asset, appoggi delle soglie, rocce e campetto, geometrie specchiate, porte e accessi; build locale.
La revisione visiva in gioco spetta all'utente.
