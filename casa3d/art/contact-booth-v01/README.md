# Cabina contatti — integrazione locale

## Contratto corrente (ultima revisione utente)

Cabina e pulsanti sono integrati nel mondo principale. Le targhette riportano
soltanto **MESSAGGIO** e **SALA INFORMAZIONI**. Il primo apre il modulo locale;
il secondo è l'unica azione che lascia il mondo per la discesa e la sala vuota.
Attraversare la porta non cambia pagina. I vetri sono ora trasparenti anche nel
sorgente Blender e nel GLB: rigenerazione con `update_glass.py` dopo l'export
iniziale. `contactBoothControls.mjs` aggiunge le mesh dei pulsanti alla parete.
`?review&view=booth-controls` verifica la camera reale davanti ai pulsanti.
I rapporti e screenshot della vecchia cabina autonoma restano come storico:
descrivono la prima implementazione, superata da questa revisione.
La porta parte chiusa e ha un ingombro dinamico solidale all'anta. L'apertura
avviene con E/clic/tocco prima dell'ingresso. Al ritorno dalla sala separata si
ripristina anche lo stato aperto della porta, senza sovrapporla al personaggio.
Uscendo dalla cabina la porta si richiude automaticamente appena la capsula
libera l'area di movimento dell'anta. Le istruzioni sono disponibili soltanto
nel pulsante **?** accanto al menu, identico nel mondo e nella sala: tutte le
azioni usano **E** oppure il clic sull'oggetto; nessun riquadro compare all'avvio.
Verifica corrente: `runtime/integrated-controls.png` e
`runtime/door-closed-integrated.png`, catturati nella pagina reale dal browser
integrato. Il modulo messaggio mantiene lo stesso URL del mondo; il secondo
pulsante apre prima `?experience=contact&travel=down`, quindi la sala autonoma.

## Implementazione precedente (storico)

Esterno approvato dall'utente e integrato nel mondo. `contact-booth.blend` è il sorgente finale; `export_exterior.py` esporta `src/assets/models/props/contact-booth.glb` e registra hash e geometria in `exterior-metadata.json`. Caricare prima il file di revisione o eseguire `build_review.py` in una scena nuova; eseguire l'esportatore una sola volta su quella bozza. I file `*-review` conservano la prima proposta.

La scala della collocazione nel gioco è **2×**, come richiesto dopo la prima verifica: base 3,28 × 3,28 m e altezza 6,30 m. Il GLB resta in metri autore; `CONTACT_BOOTH.scale` governa visivo e ingombri fisici. L'ingresso mantiene la quota umana. Collocazione finale: `(-14, 0, 193)` metri mondo, sul disco dell'asteroide, a sinistra dell'arrivo.

La richiesta successiva sostituisce il telegrafo con due pulsanti rossi su basi gialle, frontali e con targhette. Interno Three.js autonomo (`?experience=contact`), discesa animata verso la sala vuota (`?experience=chamber`), ritorno alla cabina e ripristino della posizione precedente nel mondo. La sala è 8 × 8 m e ha movimento desktop/touch.

L'utente ha chiesto di rimandare l'invio email: il primo pulsante apre soltanto una bozza in memoria con invio disattivato, destinazione futura `mail@animalhouselab.art`. Nessun provider collegato e nessuna email inviata. Il testo non viene memorizzato, spedito o inserito negli URL.

Il bootstrap distingue i tre ingressi prima di importare il mondo. Navigazioni complete e rilascio del renderer separano gli ambienti. Il controllo browser registra le richieste reali e rifiuta GLB, video e moduli main/rooms/world/player negli ingressi autonomi. Questa verifica riguarda i download e il codice attivo, non garantisce lo svuotamento della cache interna del browser.

Test dedicati: `node --test casa3d/test/contactBooth.test.mjs`. Verifica browser: `runtime/check-browser.cjs`; ingresso/ritorno nel mondo: `runtime/check-world.cjs`. Screenshot e rapporti sono nella stessa cartella. La build locale si genera con `casa3d/deploy.ps1`, senza push.

La skill generica impone Meshy e una suite architettonica completa non corrispondente a questo asset. Il suo validatore non è stato dichiarato superato: l'approvazione dell'utente autorizza esplicitamente l'integrazione Blender/Three.js. Nessun servizio a pagamento utilizzato e nessuna pubblicazione remota eseguita.

## Prima proposta storica (superata dai requisiti sopra)

## Proposta visiva

Cabina rossa 1,64 × 1,64 × 3,15 m, tetto curvo e insegna TELEGRAMMI. Porta a riquadri con maniglia in ottone; apertura verso l'esterno. Posizione proposta sul prato a sinistra dell'arrivo: (-14, 0, 204) metri mondo, da verificare con i sostegni della giostra. Il riferimento utente guida forma e posizione, non contiene istruzioni aggiuntive.

`contact-booth-review.blend` conserva la bozza in una scena dedicata; `build_review.py` la riproduce e genera il render. `plans/lower-room.svg` proietta gli ingombri reali della bozza a quota 1,2 m; gli altri diagrammi sono schematici. In `masks/openings.svg`: ingresso a sinistra, finestra sinistra al centro, finestra destra a destra. Questi diagrammi non attestano aperture Boolean finali.

## Contratto dell'interno

- Esterno Blender soltanto. Interno e telegrafo sono costruiti in Three.js, con banco in legno, base del telegrafo appoggiata sul banco, leva, bobine e dettagli in ottone.
- Ingresso E/clic/tocco o pulsante entro tre metri, soltanto dal fronte e senza ostacoli. Collisioni semplici separate dal modello visivo e dai livelli di dettaglio.
- All'ingresso import dinamico dell'interno e scena dedicata: il prato e la casa non vengono renderizzati. Non si nascondono singoli piani della casa. Vetri interni satinati evitano di promettere una vista del mondo esterno assente.
- Camera interna davanti al banco, senza camminata; visuale controllabile. Uscita esplicita ed Escape ripristinano posizione, orientamento e controlli precedenti. Nessun blocco del puntatore durante la scrittura.
- Il telegrafo apre un modulo HTML accessibile: nome facoltativo, email di risposta, messaggio. Campi con etichette, tastiera e touch. Animazione della leva e suono Morse facoltativo accompagnano la scrittura; non serve conoscere il Morse.
- Messaggi privati: nessuna bacheca pubblica, nessun contenuto in URL o diagnostica, nessuna persistenza del testo nel browser. Conservare il testo in memoria in caso di errore e cancellarlo dopo invio confermato.

## Invio email

Destinazione fissa: **contatti@animalhouselab.art**. La casella non basta a inviare dal sito statico. Nel progetto non è stato trovato un endpoint di invio.

L'implementazione deve usare un servizio server o un provider per moduli, con destinatario fissato sul server, validazione, limiti di dimensione, protezione anti-spam e segreti fuori dal client. Il modulo mostra successo solo dopo conferma del servizio; conserva il testo se il servizio fallisce. Un collegamento mailto può essere un'alternativa esplicita, ma non equivale a un invio diretto.

Da definire: servizio disponibile per ricevere il modulo. Non inserire credenziali nel repository o in chat.

## Revisione richiesta

La skill build-3d-game-rooms richiede approvazione esplicita della pianta e dei riferimenti prima della composizione finale; successivamente richiede approvazione Form prima dell'esportazione. Tutte le approvazioni restano in attesa. Il validatore generico impone anche Meshy: qui è intenzionalmente escluso perché l'utente richiede Blender e Three.js. Nessuna conformità completa è dichiarata.

Prossima revisione: forma, scala, posizione e flusso di interazione. Prima dell'integrazione definitiva: aperture vere, collisioni, confronto in `?review`, ingresso/uscita e ritorno dalla scena interna, input desktop/touch, risposte di successo/errore dal servizio email, hash del GLB e budget geometrico.
