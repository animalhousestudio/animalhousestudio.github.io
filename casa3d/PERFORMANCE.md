# Rendering e nuovi asset

## Pipeline attuale

- La casa v10 sorgente contiene 1.862 nodi mesh e 347.992 triangoli. Prima delle collisioni e dei raggruppamenti vengono rimossi soltanto i triangoli di area esattamente zero: 2.550 triangoli in meno, senza cambiare vertici, sagoma, UV o materiali.
- I vetri della casa usano trasparenza normale con trasmissione fisica disattivata. La trasmissione richiedeva un ulteriore passaggio sull'intero mondo opaco, anche quando erano visibili pochi pannelli.
- Le geometrie ripetute diventano istanze; quelle della casa con più di 100 triangoli per copia vengono divise in celle di 10 unità del modello. I piccoli montanti rimangono condivisi, per contenere le chiamate di disegno. Le altre parti statiche opache vengono unite per materiale e zona. Le ante e gli oggetti interattivi rimangono separati.
- L'erba è divisa in celle: quelle fuori dall'inquadratura vengono scartate, quelle lontane usano gradualmente meno istanze. La densità vicina al personaggio resta completa.
- Le trasformazioni locali statiche vengono calcolate una sola volta. Porte e pickup devono rimanere esclusi da questo passaggio.
- I tre testi tridimensionali della macchina da pugni rimangono separati dai raggruppamenti. Dopo la cattura delle collisioni scompaiono sotto 1,5 pixel di altezza dei caratteri e tornano visibili sopra 2 pixel. La misura considera profondità della camera, campo visivo, risoluzione e scala del mondo, anche ai bordi dell'inquadratura; il corpo della macchina resta presente.
- Durante il caricamento viene riprodotto soltanto il video; materiali e shader vengono preparati prima di abilitare ATTERRA. Al termine della dissolvenza il video viene fermato e scaricato.
- Stelle e nebulose appartengono a una scena di sfondo separata. La sua camera segue soltanto la rotazione del giocatore. Il mondo viene disegnato dopo il cielo, così nessuna stella può passare davanti all'asteroide.

## Aggiungere contenuti

1. Esportare geometrie e materiali condivisi per gli elementi ripetuti. Escludere pavimenti da esposizione, luci e oggetti di servizio.
2. Applicare `instanceStaticMeshes` e poi `batchStaticArchitecture` agli oggetti statici, dopo aver preparato collisioni e interazioni.
3. Marcare gli oggetti mobili/interattivi prima del raggruppamento e aggiornare il filtro `movable` se si introduce una nuova famiglia di animazioni. Il marcatore `userData.staticDetail` protegge i rami con visibilità controllata da entrambi i passaggi. Non unire geometrie trasparenti, animate o con collisioni gestite tramite riferimenti al singolo oggetto.
4. Verificare la scala: l'ambiente è ingrandito di 5, il personaggio mantiene occhi a 1,65 m. Le dimensioni reali dei nuovi piccoli oggetti vanno divise per `WORLD_SCALE`.
5. Ogni caricamento deve usare il LoadingManager della scena ed essere completato prima del preriscaldamento dei materiali.

## Controllo locale

Aprire `/casa3d/?review` nella build locale, oppure `/index.template.html?review` nel server sorgenti, scegliere “Facciata · prestazioni” e leggere FPS, tempo della chiamata render, chiamate di disegno e triangoli. `?review&baseline` disabilita il raggruppamento opaco, ma mantiene instancing, vetri semplificati e livelli di dettaglio: non riproduce la versione precedente a tutte le ottimizzazioni. È disponibile soltanto su localhost.

Le misure nel browser integrato dipendono anche dalla dimensione della finestra e dalla macchina: confrontare soprattutto chiamate e triangoli, poi verificare la fluidità durante il movimento. `node --test casa3d/test/*.test.mjs` verifica anche le trasformazioni specchiate, i rami animati e l'ingresso a diverse velocità e frequenze dei fotogrammi.

## Verifica del 28 settembre 2026

Su Intel UHD 630, Edge con WebGL 2 e viewport 1280×720, la facciata passa dalle precedenti 901 chiamate e circa 47–48 ms GPU a 492 chiamate e circa 22,5 ms GPU. Il tempo GPU è misurato con query temporali, separatamente dal tempo JavaScript; non equivale agli FPS e non garantisce gli stessi risultati su altri dispositivi.

Il confronto dei soli raggruppamenti locali mostra un compromesso: davanti alla facciata si passa da 476 a 492 chiamate, mentre nella torre da 165 a 151 chiamate e da 401.856 a 353.336 triangoli eseguiti. I tempi GPU dei due raggruppamenti sono simili nelle prove; il guadagno principale misurato resta la semplificazione dei vetri.

La build locale è stata generata e verificata nel browser senza errori JavaScript: 492 chiamate e 675.763 triangoli nella vista della facciata. I tre testi della macchina da pugni scompaiono da lontano e ricompaiono da vicino, mantenendo invariato il numero di triangoli delle collisioni. La suite completa registra 69 test superati su 73; i quattro fallimenti appartengono al prototipo alternativo greybox e riguardano file invariati rispetto alla revisione iniziale. I test delle ottimizzazioni sono superati.

Non è attiva un'esclusione degli interni nascosti dietro i muri. I gruppi `Interior_1`–`Interior_4` sono vuoti; le superfici importate condividono interno ed esterno. Per aggiungere esclusione per stanza servono appartenenza degli oggetti e aperture esplicite, mantenute anche dopo i raggruppamenti. Un semplice interruttore basato sul piano toglierebbe parti visibili dalle finestre, dalle torri o dall'ascensore.

## Pavimenti e torrette — 29 settembre 2026

La rifinitura dei pavimenti usa una mappa colore 1024² e un bump 512² condivisi. I 34 solai, soglie e passaggi ricevono il parquet sulle sole facce calpestabili, senza geometria per listello. Dopo la cattura delle collisioni i gruppi di materiale dei pavimenti vengono separati e riuniti nei normali raggruppamenti spaziali. Le due torrette aggiungono complessivamente 932 triangoli per fori, pali e raccordi; la cantina segue il profilo reale della casa per eliminare gli angoli sporgenti.

Nel confronto locale alla stessa inquadratura della facciata e viewport 1440×900, le chiamate passano da 477 a 482 e i triangoli disegnati da 648.713 a 655.270. Questi conteggi non sono direttamente confrontabili con quelli sopra a 1280×720 e non costituiscono una nuova misura del tempo GPU.

La build è verificata in dodici viste, senza errori JavaScript. Sedici attraversamenti nella collisione completa del gioco confermano i quattro fori liberi accanto ai pali; i piani inferiori rimangono solidi. La suite conta 85 test superati e gli stessi quattro fallimenti del prototipo greybox. Dettagli di intervento e dimensioni sono in `art/floor-refinement/`.
