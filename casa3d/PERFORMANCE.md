# Rendering e nuovi asset

## Pipeline attuale

- La casa sorgente contiene 2.125 mesh. Le geometrie ripetute diventano istanze; le altre parti statiche opache vengono unite per materiale e zona. Le ante e gli oggetti interattivi rimangono separati.
- L'erba è divisa in celle: quelle fuori dall'inquadratura vengono scartate, quelle lontane usano gradualmente meno istanze. La densità vicina al personaggio resta completa.
- Le trasformazioni locali statiche vengono calcolate una sola volta. Porte e pickup devono rimanere esclusi da questo passaggio.
- Durante il caricamento viene riprodotto soltanto il video; materiali e shader vengono preparati prima di abilitare ATTERRA. Al termine della dissolvenza il video viene fermato e scaricato.
- Stelle e nebulose appartengono a una scena di sfondo separata. La sua camera segue soltanto la rotazione del giocatore. Il mondo viene disegnato dopo il cielo, così nessuna stella può passare davanti all'asteroide.

## Aggiungere contenuti

1. Esportare geometrie e materiali condivisi per gli elementi ripetuti. Escludere pavimenti da esposizione, luci e oggetti di servizio.
2. Applicare `instanceStaticMeshes` e poi `batchStaticArchitecture` agli oggetti statici, dopo aver preparato collisioni e interazioni.
3. Marcare gli oggetti mobili/interattivi prima del raggruppamento e aggiornare il filtro `movable` se si introduce una nuova famiglia di animazioni. Non unire geometrie trasparenti, animate o con collisioni gestite tramite riferimenti al singolo oggetto.
4. Verificare la scala: l'ambiente è ingrandito di 5, il personaggio mantiene occhi a 1,65 m. Le dimensioni reali dei nuovi piccoli oggetti vanno divise per `WORLD_SCALE`.
5. Ogni caricamento deve usare il LoadingManager della scena ed essere completato prima del preriscaldamento dei materiali.

## Controllo locale

Aprire `/casa3d/?review`, scegliere “Facciata · prestazioni” e leggere FPS, tempo CPU del renderer, chiamate di disegno e triangoli. Per confrontare, aprire `?review&baseline` alla stessa risoluzione e dalla stessa posizione; questa modalità disabilita i nuovi raggruppamenti e il dettaglio dell'erba a distanza. È disponibile soltanto su localhost.

Le misure nel browser integrato dipendono anche dalla dimensione della finestra e dalla macchina: confrontare soprattutto chiamate e triangoli, poi verificare la fluidità durante il movimento. `node --test casa3d/test/*.test.mjs` verifica anche le trasformazioni specchiate, i rami animati e l'ingresso a diverse velocità e frequenze dei fotogrammi.
