# Casa approvata: prova di navigazione

La scena predefinita carica `src/assets/models/house-greybox.glb`, esportato da `Casa_Greybox_Spazi_Ampi.blend`. Le versioni precedenti `Casa_Forme_Raffinate.blend` e `Casa_Greybox_Game.blend` sono preservate. Camere di ispezione, testi e helper sono esclusi dall'export.

## Ampliamento degli spazi

Le ali laterali sono state ampliate di 1,30 m per lato, mantenendo intatti il nucleo scala, i pianerottoli, tutte le quote, l'ingresso e l'osservatorio. I raccordi dei tetti seguono i nuovi muri; bay e serra si spostano con le rispettive facciate. Nessun ingrandimento del giocatore o dei gradini.

Superficie utile approssimativa del corpo principale, esclusi muri, intero vano scala, ingresso, bay e serra:

| Piano | Prima | Ora | Aumento |
| --- | ---: | ---: | ---: |
| Cantina | 35,69 m² | 51,50 m² | 44,3% |
| Ingresso / cucina | 55,09 m² | 76,88 m² | 39,6% |
| Soggiorno / studio | 50,53 m² | 71,64 m² | 41,8% |
| Stanze | 35,52 m² | 56,11 m² | 58,0% |

Il livello dell'osservatorio resta un accesso di servizio, non un ulteriore piano residenziale. Le misure sono stimate su griglia di 4 cm e documentate in `expanded-manifest.json`; non sono misure catastali. Tutti i piani principali superano 50 m² e l'aumento minimo richiesto del 20%.

## Scala e geometria

- 1 unità di gioco = 1 metro; nessun ingrandimento del modello.
- Pavimenti a -2,35 / 0,20 / 3,10 / 6,00 / 8,90 m; sommità a 12,85 m.
- 72 mesh architettoniche, 3.100 triangoli visibili, oggetti separati.
- Nove semplici collisioni invisibili: otto rampe per le due rampe di scale fra ciascuna coppia di piani, una per la soglia d'ingresso.
- Pareti, solai con aperture e pianerottoli usano la geometria statica a bassa risoluzione. I gradini restano visibili e invariati, ma il movimento segue le rampe invisibili.
- Corpo giocatore alto 1,80 m, raggio 0,22 m, visuale a 1,65 m; velocità normale 2,2 m/s.

La scala collega cantina, ingresso, soggiorno, stanze/serra e osservatorio. La serra approvata si raggiunge dal livello 2; l'osservatorio dal livello 3, senza attraversare la serra.

## Prova locale

Da `casa3d`, eseguire `./deploy.ps1` per preparare la build locale, senza `-Push`. Avviare `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base /casa3d/` e aprire `http://127.0.0.1:4173/casa3d/`.

WASD/frecce per camminare, tasto destro premuto per guardare, Shift per correre, Esc per la pausa, R per tornare all'ingresso. Su touch: leva a sinistra e trascinamento a destra. Le scale si percorrono camminando, senza selezionare un piano.

Il vecchio ambiente è conservato ed è disponibile con `?scene=legacy`. La prova della casa usa un piano esterno essenziale e non carica gli arredi e le scale del vecchio ambiente, la cui scala era diversa.

## Verifiche

`node --test test/greybox.test.mjs` controlla il GLB reale, la scala, il percorso completo con il controller fisico (esterno, cantina, tutti i piani, osservatorio, serra e ritorno), l'accessibilità delle nuove zone, le collisioni contro pareti e la mancata occlusione della cantina da parte del terreno. Il manifest registra l'export. Nessuna pubblicazione remota è necessaria per la prova locale.
