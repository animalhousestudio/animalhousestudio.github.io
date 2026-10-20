# Contratto locale: tempio della lince

Questa è una bozza autoriale Blender, costruita proceduralmente per una revisione concreta. La richiesta dell’utente autorizza la creazione del modello e richiede di fermarsi prima dell’inserimento nel gioco. Non sono autorizzati o previsti servizi a pagamento, Meshy, esportazioni runtime, pubblicazione o modifiche alla scena dell’asteroide.

## Aspetto e gerarchia

La fotografia caricata guida il basamento circolare, il colonnato aperto, il tamburo e la cupola. Una pietra calda e bronzo antico con patina turchese danno carattere al santuario. La lince è l’unico fulcro interno; orecchie appuntite con ciuffi, muso felino, gorgiera e postura seduta ne rendono leggibile la specie. I bagliori ciano devono rimanere piccoli e subordinati alla scultura.

## Ingombri, circolazione e aperture

Unità in metri, asse verticale Z, arrivo da -Y. Basamento raggio5.4m; pavimento z0.62; cella cava raggio interno3.2m e parete0.30m. Dieci colonne su raggio4.65m con offset18° dall’asse d’ingresso mantengono libera la campata frontale. Lo spazio tra parete e colonne forma il deambulatorio. L’ingresso vero, tagliato prima della cornice, misura2.5m di larghezza e3.55m di altezza nel codice iniziale (da verificare eventuale correzione a3.60m) e rivela0.3m di parete. La lince è arretrata a y0.65 e parte dal piano del piedistallo z1.62; ingombro verticale della scultura2.5m. Il tetto include una lanterna e termina a z10.32. Il fusto delle colonne va da z0.90 a4.28; abaco fino a4.56, trabeazione4.52–4.98, tamburo4.80–6.72, cupola6.77–9.29. Non è presente un soffitto piano a4.9: l’interno prosegue verso la cupola. Il tamburo ha dieci finestre vere, ognuna0.49x1.10m. Il varco frontale tra le basi delle colonne è circa2.15m: eccezione funzionale documentata per il portico anulare aperto; il varco della cella resta2.5m.

La botola è un portale orizzontale da1.3x1.7m attraverso tutti gli strati del pavimento/basamento, con un pozzo visibile fino a z-1.28, cioè1.90m sotto il pavimento. Centro finale di costruzione(1.80,0.35). Sono presenti parapetti sui lati posteriore e destro. Non aggiungere scala o sotterranei completi. Il foro laterale non deve interrompere il percorso assiale; la collisione e la protezione del giocatore verranno definite nell’integrazione futura.

## Movimento, testo e controllo

Zampa anteriore mobile, lingua e supporto del testo sono parti distinte con pivot e nomi stabili. Muovere la zampa aziona l’uscita della lingua dalla cavità della bocca. La dimostrazione Blender può usare un controllo, driver e animazione; la relazione deve essere ispezionabile nel file. Le sei profezie originali sono in prophecies.json. Mostrare una frase diversa a ogni ciclo di attivazione della dimostrazione. Non dichiarare implementata una logica di gioco, un input del giocatore o un’interazione runtime.

## Camera, verifica e readiness

Camera esterna a tre quarti per il volume complessivo; vista interna per statua, zampa, lingua e foro. Per controllare lo spazio occorrono pianta dal vero modello, proiezione del soffitto, prospetto, dettagli delle aperture, quattro viste ampie interne e tre viste del soffitto. Le misure finali devono provenire dalle mesh valutate, non dai soli parametri del builder.

Le approvazioni Function, Form e Runtime restano pending fino a esplicita approvazione umana. Il successo di un render non è un’approvazione. Il validatore upstream richiede generazione Meshy anche per questa bozza locale: documentare l’incompatibilità senza falsificare provenienza, budget o assenso. Questa deroga tecnica non autorizza esportazione o runtime; il lavoro termina alla consegna della bozza Blender e delle sue immagini di revisione.
