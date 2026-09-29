# Correzioni della scena — 29 settembre 2026

- Movimento: elimina la velocità verticale prodotta dall'urto contro spigoli arrotondati. La discesa segue il terreno solo sui tratti effettivamente in pendenza, evitando che il suolo sottostante annulli la salita su una soglia. Restano percorribili ingresso, veranda, voliera e torri.
- Vialetto: file alternate di due e tre pietre quasi circolari, alte circa 8 cm, mantenendo il percorso largo 1,4 m. Tre mesh condivise; il limite verificato passa da 75 mila a 150 mila triangoli per il maggior numero di pietre.
- Veranda: pavimento, vetri, cornici e tetto si prolungano insieme fino alla parete curva, mantenendo fisso il lato esterno.
- Terreno: il taglio geometrico segue il perimetro misurato della cantina, con 3 cm di sovrapposizione sotto i muri; la superficie visibile e il supporto del giocatore usano lo stesso profilo.
- Ascensore: altezza libera da 2,30 a 2,645 m (+15%), con cancelli, architravi, pannelli frontali e sommità del vano adeguati.
- Albero: posizione e radici invariate. Deformazione graduale dei rami e delle foglie vicini a veranda, voliera, torre ovest e casa; nessun taglio netto della chioma. Le geometrie corrette vengono acquisite anche dalle collisioni prima dell'ottimizzazione.

Le correzioni architettoniche sono applicate al caricamento della v10 in `src/rooms/exteriorRepairs.mjs`; il file Blender e il GLB originali non vengono riscritti.

## Verifica

Build locale completata. Controllo visivo nel browser della scena caricata a 1042 × 673, dimensioni della prima schermata segnalata. Nessun errore della scena rilevato nella console.

Test mirati: movimento su soglie di 2/8/20 cm a passo e corsa senza lancio verticale; percorso completo del vialetto; accessi alle torri; ingresso a 20/30/60 FPS; terreno lungo tutti i 256 punti del perimetro; raccordo della veranda; triangoli di rami/foglie esterni ai volumi architettonici; radici ferme; nuove aperture dell'ascensore a ogni piano.

La suite completa contiene quattro errori preesistenti in `test/greybox.test.mjs`, relativi al vecchio prototipo e ai suoi sorgenti non modificati. Gli altri test, inclusi quelli aggiunti per queste correzioni, passano.

## Schermate

- [Raccordo veranda](veranda.jpg)
- [Terreno agli angoli](terreno.jpg)
- [Vialetto](vialetto.jpg)
- [Chioma esterna alla voliera](voliera.jpg)
- [Cabina](ascensore.jpg)

Build preparata localmente, senza push o pubblicazione.
