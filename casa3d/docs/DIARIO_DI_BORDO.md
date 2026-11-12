# Diario di bordo Casa3D

Registro delle decisioni che cambiano contenuti, comportamento, caricamento o
costo del gioco. Le regole correnti restano in [PERFORMANCE.md](../PERFORMANCE.md)
e [WORLD_CONTENT.md](../WORLD_CONTENT.md); l'inventario in
[ASSET_REGISTER.md](ASSET_REGISTER.md), i lavori aperti in
[PROJECT_STATE.md](PROJECT_STATE.md).

## Come mantenerlo

- Aprire una voce per ogni asset aggiunto, sostituito o rimosso, attrazione,
  modifica di rendering/caricamento e refactoring. Chiudere la voce nello stesso
  intervento, anche quando alcune prove restano da fare.
- Usare data ISO e ID stabile; nuove voci sopra le precedenti. Indicare autore
  o AI/collaboratore quando noto, revisione di partenza e risultato finale.
- Separare **implementato**, **verificato** e **da verificare**. Un test passato,
  un render Blender e una misura GPU attestano cose diverse.
- Compilare i campi pertinenti; scrivere «non misurato» o «non applicabile»
  invece di inventare numeri. Collegare evidenze riproducibili in `art/`.
- Aggiornare registro/stato/guide se cambiano. Non riscrivere risultati storici
  come nuove misure: aggiungere una voce che li supera e rimandare ad essa.

## 2026-11-12 · ARRIVO-007 · Proporzioni del graffito

**Implementato:** scritta CAMBIA ridotta del 28%, graffi ingranditi del
40% e gruppo abbassato di 5,5 cm sul monolite. L'area cliccabile segue il gruppo.

**Costo:** un piano di due triangoli, con la stessa texture statica da
272 × 144.

**Verificato:** build locale, suite 247/247 e [prova in Chrome](../art/animale-artificiale-v01/runtime/change-tag-tuning/)
con il cambio disco in entrambe le direzioni dalla nuova posizione.

## 2026-11-12 · ARRIVO-006 · Graffi e scritta CAMBIA

**Implementato:** CAMBIA dimezzata e spostata a destra sotto l'elenco.
Quattro incisioni irregolari con bordi chiari sostituiscono il punto.
L'area cliccabile segue la nuova posizione.

**Costo:** un piano di due triangoli con CanvasTexture statica da
272 × 144, contro 544 × 232. Il disegno si esegue una volta all'avvio.

**Verificato:** build locale e suite 247/247. La [prova in Chrome](../art/animale-artificiale-v01/runtime/change-tag/)
mostra la scritta a destra e verifica il cambio disco in entrambe le direzioni.

## 2026-11-12 · ARRIVO-005 · Indicatore traccia e cambio disco

**Implementato:** il piccolo schermo mostra codice, glifi e stato del brano.
Il graffito CAMBIA alterna i dischi e avvia il primo brano. `animaleartificale01`
è il disco iniziale, con nove MP3 e copertina ritagliata dallo screenshot
del video del lago a 34:51.

**Costo:** due piani e due CanvasTexture per indicatore e graffito. La
seconda grafica JPEG occupa 86.418 byte. I 74.642.275 byte dei nove MP3
restano su disco e il browser carica il brano richiesto.

**Verificato:** hash identici ai nove file sorgenti, build locale e suite
247/247. I test coprono cambio disco, scelta predefinita e ripresa tra
mondo e sala informazioni. [Prova in Chrome](../art/animale-artificiale-v01/runtime/albums/)
con clic su CAMBIA in entrambe le direzioni, cambio copertina, Play/Pausa
sull'indicatore e avvio di `ANIMALOUD 1.mp3` durante il volo da ATTERRA.

## 2026-11-12 · ARRIVO-004 · Comandi del monolite

**Implementato:** Play/Pausa verde mantiene posizione e misura.
Dopo i tre puntini, Casuale, Precedente, Successivo e Ripeti operano sulla
stessa colonna sonora. Lo stato di ripetizione e l'ordine casuale passano
tra mondo e sala informazioni.

**Costo:** la riga usa un piano di due triangoli e un CanvasTexture RGBA
720 × 120, aggiornato solo quando cambia lo stato visivo.

**Verificato:** build locale e suite 245/245. I test coprono pausa durante
il cambio brano, ripetizione, fine album e ordine casuale tra documenti.
La [prova nel browser](../art/animale-artificiale-v01/runtime/transport/)
verifica i cinque comandi, la posizione dei puntini e la riga in scena.

## 2026-11-12 · ARRIVO-003 · Bengala in volo e giostra

**Implementato:** 12 lanci bianco oro partono vicino alla visuale e
puntano verso la casa. 20 fontane distribuite sull'asteroide accendono
scintille in sequenza, con orientamento variabile nel tempo. Gli effetti
si liberano al termine dell'intro. Sulla giostra sono stati rimossi il
pannello di avanzamento, le etichette del percorso e il messaggio finale.

**Costo:** i bengala condividono le due chiamate di rendering dei fuochi.
Totale temporaneo di 7.844 punti e 11.544 segmenti, 1.855.920 byte di
attributi statici. Zero geometrie delle scintille residenti dopo il volo.

**Verificato:** colonna sonora in riproduzione prima, durante e dopo il
giro, con lo stesso elemento audio e passaggio naturale alla traccia
successiva. Il test è entrato dalla conferma di partenza e ha accelerato
il percorso per verificare il ritorno automatico. [Prova giostra](../art/animale-artificiale-v01/runtime/coaster-soundtrack/).
La [prova bengala](../art/animale-artificiale-v01/runtime/arrival-sparks/)
acquisisce tre momenti del volo nella build locale e verifica la rimozione
dei fuochi e del canvas all'atterraggio. Nessun errore di shader registrato.
Suite 243/243. Prestazioni GPU e dispositivi mobili da misurare.

## 2026-11-12 · ARRIVO-002 · Volo e colonna sonora

**Implementato:** il video con il logo precede ATTERRA. Il logo sparisce
al clic, mentre il video termina la dissolvenza. Il volo usa nastri
curvi fin dall'inizio, pianeti e 32 raffiche di scintille tridimensionali,
con una raffica finale prima dell'atterraggio. All'atterraggio canvas,
geometrie e materiali del volo vengono rimossi. Il monolite alterna Play
e Pausa sul pannello, senza dialogo o pulsanti a schermo. La musica parte
con ATTERRA e prosegue durante il gioco. La sala informazioni riprende
traccia e tempo nel documento successivo.

**Costo:** due draw per 3.840 punti e 5.760 segmenti durante il volo,
860.160 byte di attributi statici. Nessuna seconda scena, luce o texture
per i fuochi. A terra resta soltanto il costo del comando sul monolite.
Il budget del Canvas 2D è in [PERFORMANCE.md](../PERFORMANCE.md).

**Verificato:** build locale con `.\casa3d\deploy.ps1` e
`node --test casa3d/test/*.test.mjs` con 243/243 test. Il controllo dei
buffer verifica anche lo smontaggio delle geometrie e dei materiali.
La [prova del primo volo](../art/animale-artificiale-v01/runtime/flight/browser-verification.json)
attesta avvio dell'audio, continuità dopo l'atterraggio, Play/Pausa e
ripresa in sala informazioni e al ritorno.
La [prova dei fuochi](../art/animale-artificiale-v01/runtime/flight-fireworks/)
mostra il volo e l'atterraggio nella build locale a 1100 × 660. Le
acquisizioni Chrome con rendering software verificano l'aspetto e il
ciclo di vita, senza misurare le prestazioni su hardware.

**Da misurare:** prestazioni GPU e prova su telefono fisico.

## 2026-11-12 · ARRIVO-001 · Monolite musicale in Casa3D

**Base:** `7c58fec` con modifiche locali preesistenti. Il monolite si trova
3,10 m a sinistra e 8,80 m avanti rispetto al punto di atterraggio, rivolto
verso chi arriva. Cesto, alveare, jetpack e tazza sono più a sinistra. I clic
generici nel mondo non producono più etichette di ambiente. I messaggi delle
interazioni restano disponibili.

**Audio:** il pannello apre il player con 13 brani da Drive. L'ordine segue
la numerazione dei file sorgenti. Una copia MP3 per brano, 12.491.749 byte in
`casa3d/audio/animale-artificiale/`. I WAV restano fuori dal repository.
Una sola sorgente audio nel browser, caricata su richiesta. Il dialogo
mette in pausa alla chiusura e restituisce i comandi al giocatore.

**Costo residente:** GLB 17.500 byte e JPG 113.738 byte, 378 triangoli
visivi e 12 di collisione. Il player aggiunge un'interfaccia DOM, senza
animazione della texture o render pass dedicati. Nei campioni desktop
1280 × 720 all'arrivo, le chiamate passano da 1.021 a 1.025, i triangoli
disegnati da 1.283.192 a 1.283.650 e quelli di collisione da 712.058 a
712.070. I due campioni sono presi da server sorgenti e build locale con
gli stessi tier attivi. Sono istantanee di scena, non un confronto GPU.

**Verificato:** `node --test casa3d/test/*.test.mjs` 240/240.
`.\casa3d\deploy.ps1` riuscito con l'avviso Vite già noto sul chunk
condiviso. Nel browser, atterraggio normale, vista ravvicinata e prova
camminando contro il collider. Play e riga del display avviano il brano
corretto, tutti i 13 MP3 avanzano, il primo passa al secondo, Esc mette
in pausa, E apre il player. La tazza è indisponibile davanti al monolite
e raccoglibile nella nuova posizione. Un clic sul terreno non genera
etichette di stanza. [Evidenze](../art/animale-artificiale-v01/runtime/).

**Da verificare:** input touch su dispositivo fisico e prestazioni GPU.
Build locale, senza pubblicazione.

## 2026-11-12 · ART-001 · Monolite di Animale Artificiale

**Contesto:** prototipo visivo per il collettivo, su base `7c58fec` con
modifiche locali preesistenti.

**Implementato in Blender:** [pacchetto del monolite](../art/animale-artificiale-v01/README.md).
Corpo nero verticale, schermo a quota occhi, tredici tracce e copertina tratta
dall'anteprima del filmato al tempo sorteggiato di 00:53:50.142.

**Verificato in authoring:** file aperto in Blender 5.2, geometria dei cinque
glifi, immagine e font incorporati, appoggio a pavimento. Render Cycles
[del monolite](../art/animale-artificiale-v01/monolite.jpg) e
[del display](../art/animale-artificiale-v01/player.jpg).

**Da fare:** eventuale approvazione visiva e integrazione successiva in Casa3D.
Costo runtime non misurato. Nessun asset di gioco introdotto.


## 2026-10-20 · TEST-001 · Test allineati al personaggio attuale

**Contesto:** richiesta di risolvere i quattro fallimenti mantenendo visuale
e personaggio già corretti. Base `7c58fec` con il precedente lavoro locale;
nessun nuovo commit o push. La fase DOC-001 sotto resta lo storico precedente.

**Diagnosi:** arrivo e scala attendevano ancora 1,65 m. I test di casa e torri
calcolavano posizioni con `EYE_HEIGHT = 2` ma chiamavano `CollisionWorld.move`
senza le opzioni che il vero `Player` già passa. Il solver generico usava
quindi 1,65 m: nella casa quota finale inferiore di 35 cm; nella torre, dopo
la breve discesa, piedi ancora 15 cm sopra il fondo e `grounded = false`.

**Implementato:** corrette le quattro fixture, con dimensioni esplicite del
personaggio e aspettative attuali. Il test di scala usa il v10; le verifiche
di collisione coprono sia v09 ancora selezionabile sia v10 attivo. Conservati
controlli di terreno, bordi, piani, muri, porte dinamiche, fori e pali;
aggiunto il controllo della quota finale sul pianerottolo. Nessuna tolleranza
allargata e nessun test escluso. I test generici del solver restano a sé.

**Verificato:** test mirati di arrivo/scala 5/5 e collisioni/torri 18/18;
suite completa finale **237/237**, zero falliti, saltati o cancellati.
Il caso aggiuntivo della casa v10 spiega l'aumento da 236 a 237.
Gli hash dei 153 file in `src/` e dell'HTML pubblicabile sono identici prima
e dopo: visuale, altezza occhi a 2 m, movimento, collisioni runtime e asset
non sono stati modificati. Non occorre rigenerare il gioco per questi test.

**Evidenze:** [pacchetto di verifica](../art/player-test-alignment-2026-10-20/README.md).
**Prestazioni:** costo runtime invariato; nessuna nuova misura FPS/GPU.
**Documenti aggiornati:** stato corrente, guida per usare la capsula nei test,
questo diario e riferimenti all'esito della suite.
**Lavoro aperto:** restano le QA browser e i limiti riportati nello stato;
la suite verde non li chiude automaticamente.

## 2026-10-20 · DOC-001 · Consegna documentale e ritiro greybox

**Contesto:** richiesta di rendere il progetto continuabile da collaboratori
con le loro AI e di eliminare il prototipo superato. Base `7c58fec`, checkout
con modifiche locali già presenti; nessun commit/push eseguito dall'intervento.

**Implementato:** indice dalla radice e in Casa3D, istruzioni AI, regole di
prestazione separate dallo storico, fotografia dello stato, registro asset e
questo diario con modello riutilizzabile. Corrette indicazioni superate su
conteggi, scena attiva e stato di alcune produzioni.
Rimosso il prototipo greybox: ramo di avvio, sorgenti, GLB, test, pacchetto
di produzione e output esclusivi. I vecchi URL ricadono sul mondo principale.

**Decisione:** conservare soluzioni funzionanti e storia delle misure;
documentare le verifiche mancanti. La rimozione del prototipo è esplicita,
non un'esclusione di test del gioco ancora attivo. Recupero dalla cronologia Git.

**Verificato:** suite completa prima **240/232/8** (totali/passati/falliti),
dopo **236/232/4**, con i quattro fallimenti principali invariati e nessun test
saltato. Build locale senza push riuscita; warning chunk >500 kB persistente.
Controllo dei riferimenti documentali e degli import/output del prototipo.
Log, riepilogo e inventario delle rimozioni sono nel
[pacchetto di verifica](../art/handoff-2026-10-20/README.md).

**Prestazioni:** nessuna modifica alle strategie del mondo principale e nessuna
nuova misura FPS/GPU. Il ritiro elimina i pacchetti del prototipo dalla nuova
build; non si attribuisce un guadagno FPS alla sola riduzione dei file.

**Riscontro dell'audit:** la soglia di visibilità acqua oltre 24 m del singolo
lago non viene propagata alla scena subacquea combinata; registrata come
limite da verificare/allineare, senza cambiare il runtime in questo intervento.

**Da fare:** quattro test principali, QA finale tempietto/cesto, baseline su
dispositivi target e confronto finale giostra: vedere lo stato del progetto.
Le modifiche locali preesistenti della cabina e gli altri asset estranei
non sono parte del riordino.
**Seguito:** i quattro test sono stati risolti nella successiva voce TEST-001;
gli altri lavori aperti restano nello stato corrente.

## Interventi precedenti ricostruiti dalle evidenze

Le voci seguenti rendono rintracciabile la soluzione iniziale del diario.
Non sono nuove esecuzioni delle prove né una ricostruzione completa di tutta
la storia del repository. La data del rapporto non equivale sempre alla data
del primo inserimento; per byte/hash/tier usare il registro e i manifest.

### 2026-10-20 · REC-004 · Cielo e giostra

- **Implementato:** stelle e nebulose ancorate a una camera con sola rotazione;
  nebulose sulla sfera celeste durante curve e inclinazioni.
- **Fonti:** commit `7c58fec`, [spaceSky.mjs](../src/spaceSky.mjs),
  [test del cielo](../test/spaceSky.test.mjs).
- **Verifica:** test del cielo compresi nella suite attuale; nessun benchmark
  prestazionale separato attribuito a questa voce.

### 2026-10-20 · REC-003 · Cabina contatti e sala informazioni

- **Implementato:** cabina residente nell'arrivo, modello Blender a scala 2,
  porta con fisica dinamica e due pulsanti nel mondo. Solo SALA INFORMAZIONI
  scarica il mondo e apre discesa/sala autonoma; MESSAGGIO resta bozza locale.
- **Costo/strategia:** modello unico economico, collisioni semplici separate;
  sala senza bootstrap, GLB o video del mondo. Dettagli nel registro.
- **Fonti e verifiche storiche:** [pacchetto cabina](../art/contact-booth-v01/README.md),
  [rapporto browser](../art/contact-booth-v01/runtime/browser-report.json) e
  riscontri integrati nella stessa cartella. Suite allora 228/236.
  Alcuni rapporti descrivono la prima versione autonoma, superata dall'integrazione.
- **Aperto:** invio del messaggio intenzionalmente disattivato; nessuna misura
  GPU su dispositivi reali dedotta da build e test.

### 2026-10-20 · REC-002 · Riduzione costo durante la giostra

- **Problema:** vista locale al 3% circa 20,5 FPS, 851 draw e 1.340.531 triangoli
  prima dell'intervento, nel browser integrato.
- **Soluzione:** massimo medium durante il giro, far nei tratti casa/lago;
  erba locale fino al 3% e assente in quota; carrelli da 38 a 7 mesh con
  10.096 triangoli invariati; posa zampe precalcolata.
- **Fonti:** [rapporto v1](../art/coaster-performance-v01/report.json),
  [rapporto v2](../art/coaster-performance-v02/report.json) e
  [storico](PERFORMANCE_HISTORY.md).
- **Verifica storica:** build riuscita, suite 216/224 con otto errori allora noti.
  Confronto completo finale e tempi online ancora da registrare. Percorso,
  risoluzione e collisioni della casa non sono stati ridotti da questa strategia.

### 2026-10-20 · REC-001 · Stato documentato di tempietto e cesto

- **Inserimento:** tempietto con far/medium/near e collider residente indipendente;
  cesto con GLB unico e raccolta del leccalecca originale. Date del primo
  inserimento non ricostruite qui: il 20 ottobre è la data dei rapporti finali.
- **Fonti:** [tempietto](../art/lynx-temple-v01/final-report.json),
  [cesto](../art/lollipop-basket-v01/final-report.json), manifest e sorgenti
  collegati dal registro asset.
- **Verificato nei rapporti:** export/authoring, test automatici e build locale.
  **Aperto:** QA finale combinata browser e prova touch reale del cesto.
  Non convertire questi pending in approvazioni sulla base di immagini parziali.

### 2026-10-04 · REC-000 · Cataloghi e LOD iniziali

- **Soluzione:** zone/collocazioni separate dai modelli; confini per il batching,
  bounds completi, fallback far e dettaglio opzionale di fontana e alveare.
  Successivamente il contratto è stato riutilizzato per il tempietto.
- **Costo dei due modelli iniziali:** da 320.462 a 20.673 triangoli e da
  10.386.900 a 886.684 byte all'avvio; nessuna equivalenza diretta con FPS.
- **Fonti:** [pipeline LOD](../art/world-lod/README.md),
  [verifica runtime 4–5 ottobre](../art/world-lod/runtime/README.md),
  [storico prestazioni](PERFORMANCE_HISTORY.md).
- **Limite conservato:** nessuno streaming completo della casa o occultamento
  automatico dei piani. I 19 contenuti della voce storica sono oggi 28.

## Modello per il prossimo intervento

Copiare il modello sopra le voci esistenti e sostituire i campi tra parentesi.
Per una modifica documentale compilare solo i campi applicabili.

```markdown
## YYYY-MM-DD · ID-STABILE · Titolo concreto

**Responsabile e revisione:** [collaboratore/AI, base, commit finale se esiste,
stato locale e vincoli rilevanti].
**Obiettivo e decisione:** [problema, comportamento atteso, scelta e motivo].
**Implementato:** [cosa è cambiato; prima/dopo; file e sistemi coinvolti].

**Contenuto/asset:** [aggiunta/sostituzione/rimozione; ID, radice, zona;
sorgente e provenienza/licenza; script export; GLB/manifest/SHA-256].
**Posa e fisica:** [unità, scala, origine, layout condiviso, bounds completi;
collider e disponibilità all'avvio; parti mobili/interazioni escluse dai batch].
**Costo e ciclo di vita:** [triangoli/byte/materiali/texture per tier, costo
residente e opzionale, collisioni; istanze/batch; effetti, frequenze, luci,
render target; chi aggiorna e chi libera risorse/listener/timer].

**Confronto prima/dopo:** [dispositivo/GPU/browser, revisione, viewport/buffer,
pixel ratio, camera/percorso, cache e tier; FPS/render CPU/draw/triangoli,
risorse e richieste; GPU solo se misurata con metodo esplicito; delta e limiti].
**Verificato:** [comandi, conteggi pass/fail, elenco nuovi o vecchi fallimenti;
avvio normale, viste review, interazioni/collisioni, desktop/touch;
link a report, campioni e immagini].
**Da verificare / problemi:** [prove non eseguite, regressioni, limiti].
**Documenti aggiornati:** [registro, stato e guide pertinenti].
**Prossimo passo e recupero:** [lavoro residuo, strategia di ripristino,
fallback o revisione recuperabile; evitare istruzioni distruttive generiche].
```
