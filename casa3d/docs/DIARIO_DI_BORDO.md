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

## 2026-11-17 - UI-001 - Crediti nella schermata iniziale

**Implementato.** La scritta CREDITS in basso a destra apre un pannello
con una lista di attribuzioni. La prima voce accredita *Toon Cat FREE*,
Omabuarts Studio e la licenza CC BY 4.0.

**Verificato.** In Edge headless con `?review`, a 960×580 e 390×844,
la scritta compare sotto ATTERRA. L’apertura, la chiusura con Esc o
Chiudi e il ritorno del focus sono verificati. ATTERRA avvia il volo
dopo la chiusura del pannello.

## 2026-11-17 - ASSET-011 - Gatti più grandi e più distribuiti

**Implementato.** I 24 gatti hanno dimensioni lineari maggiorate del 20%,
con falcata, ombre e margini dei percorsi adeguati alla nuova taglia.
Rimane un tigrato vicino all’atterraggio. I tre compagni si spostano in
radure distinte a sud-ovest, sud-est e nord, per nove radure complessive.

**Verificato.** 265 test superati. Edge headless con `?review` verifica un
solo gatto dopo l’atterraggio effettivo, 24 complessivi e i gruppi di
tutte le nove radure. Nella vista di arrivo un gatto e la sua ombra
aggiungono 2 draw e 2.638 triangoli. Nella prima distribuzione quattro
gatti e le ombre ne aggiungevano 5 e 10.552.
[Rapporto e schermate](../art/cat-colony-v01/README.md).
Build locale con `deploy.ps1` riuscita, con il consueto avviso Vite
sul chunk oltre 500 kB.

**Da misurare.** Frame time e GPU su dispositivi fisici.

## 2026-11-17 - ASSET-010 - Colonia di gatti sull’asteroide

**Implementato.** Codex, base `364a720` con modifiche locali in corso.
La colonia ha 24 esemplari nelle sei radure. Il primo gruppo si vede dopo
l’atterraggio. Ogni gatto ha un mantello e una corporatura distinti,
cammina su un percorso proprio, si lava una zampa e si accuccia. Durante
le pause muove la coda e, a riposo, respira e socchiude gli occhi.
I percorsi verificano terreno e ostacoli durante la preparazione.

**Costo.** Un download opzionale da 205.288 byte per *Toon Cat FREE* di
Omabuarts Studio, CC BY 4.0. Mesh da 2.636 triangoli e texture 64² condivise,
pose indipendenti e ombre di contatto in un batch. Zero nuovi collider.
Il controller limita disegno e animazione per prossimità e inquadratura.

**Verificato.** 265 test superati. In Edge headless il GLB viene richiesto
una sola volta dopo l’atterraggio. Tutti e quattro i gatti si vedono
nella visuale di arrivo e in ciascuna delle sei viste dedicate si inquadra
il gruppo della zona. Con quattro gatti inquadrati, nella stessa vista
si passa da 647 a 652 draw e da 1.114.461 a 1.125.013 triangoli.
[Rapporto e schermate](../art/cat-colony-v01/README.md).
Build locale con `deploy.ps1` riuscita, con il consueto avviso del chunk
Vite oltre 500 kB. La build è locale.

**Da misurare.** Frame time e GPU su desktop e mobile reali.

## 2026-11-17 - ASSET-009 - Banco più fitto e movimento tridimensionale

**Implementato.** Il banco passa da 19 a 36 pesci. Le sagome sono più grandi
del 29–48%, con distanze sfalsate, variazioni in altezza, deriva laterale,
accelerazioni relative e movimenti di beccheggio e rollio. Piccoli gruppi
seguono il percorso con anticipi e ritardi, inclinando il corpo nelle discese.
La curva nel secondo laghetto è più continua. Il giro dura 83,77 s.

**Costo.** Stesso GLB opzionale e una draw call. Le copie riusano le mesh
leggere. In vista, 25.072 triangoli invece di 22.641 e 72 ossa invece di 38.
I campioni del percorso sono condivisi da ogni gruppo.

**Verificato.** 263 test. I volumi di nuoto restano separati da squalo,
carrelli, rotaie, sostegni e sponde. La verifica fra pesci campiona tre giri.
Il browser headless conferma 36 pesci, il movimento, le due corsie, entrambi
i laghetti e una sola draw aggiuntiva.
[Rapporto browser](../art/banco-acquario-v01/runtime-v02/browser-report.json).

**Da misurare.** Frame time e GPU su dispositivi reali.

## 2026-11-17 - ASSET-008 - Banco animato nei laghetti

**Implementato.** Codex, base `364a720` con lavoro locale in corso. I 19 pesci
compiono un giro chiuso di 84,33 s a 2,05 m/s. Passano a 3,12 m dall’asse
del corridoio sul lato opposto a ogni traversata, all’altezza del carrello e
sopra il transito dello squalo. Ai laghetti il banco curva prima di rientrare.
All’imbarco la fase viene impostata in modo da incontrarlo all’andata.

**Costo.** Il [GLB](../art/banco-acquario-v01/runtime-export.json) aggiunge
537.768 byte su richiesta, 22.641 triangoli e una draw call in vista sott’acqua.
La mesh usa un materiale, zero texture, 38 ossa e nessun collider. Aggiorna le
code fino a 24 Hz in vista e rilascia la mesh dopo 30 s lontano.

**Verificato.** 262 test superati, compresi la chiusura del percorso, il volume
di nuoto, la separazione interna della formazione e l’inviluppo dell’intera
giostra, rotaie, sostegni e squalo animato. Edge in modalità headless ha
mostrato le due corsie, entrambi i laghetti e il banco durante la corsa dal
carrello. [Verifica browser](../art/banco-acquario-v01/runtime/browser-report.json).
Build locale con `deploy.ps1` senza pubblicazione. Rimane l’avviso Vite sul
chunk oltre 500 kB.

**Da misurare.** Frame time e GPU su dispositivi reali.

## 2026-11-17 - ASSET-007 - Banco d’acquario in Blender

**Implementato.** Codex, base `364a720` con lavoro locale in corso. Lo
[studio Blender](../art/banco-acquario-v01/README.md) comprende tre pagliacci,
tre chirurghi blu e due farfalla fra i 19 pesci. Il secondo farfalla sostituisce
il sarago giallo nel suo percorso. Le sei acciughe mantengono la livrea
semplice. Il conteggio di authoring passa da 15.722 a 44.985 triangoli, con
un materiale visibile condiviso e zero texture raster.

**Verificato.** Due render di confronto a parità di fotogramma, dettaglio del
farfalla giallo e apertura della copia in Blender 5.2. Il controllo BVH delle
mesh deformate rileva zero intersezioni fra coppie di pesci ai 240 fotogrammi
interi del ciclo. [Script, hash e dati](../art/banco-acquario-v01/verification.json).

**Da fare.** Prima dell’integrazione fissare budget, livelli di dettaglio,
bounds, caricamento e strategia di aggiornamento. Export, verifica in
`?review` e misure su dispositivi restano da fare. Il costo aggiunto nel
runtime attuale è zero.

## 2026-11-14 - ASSET-006 - Nuoto in superficie nei laghetti

**Implementato.** Codex, base `364a720` con ASSET-005 nel checkout. Lo squalo
descrive una curva in ciascun laghetto e rallenta gradualmente a circa 0,95 m/s
quando è vicino alla superficie. Il percorso completo dura circa 112 s.
La maggiore permanenza in vista aumenta il tempo di rendering dello squalo
lungo il giro. Il costo massimo per fotogramma resta quello di ASSET-005.

**Verificato.** `node --test casa3d/test/shark.test.mjs` registra 16,48 s
continui alla quota di emersione nel primo laghetto e 11,62 s nel secondo,
in movimento. Le prove con la mesh animata confermano lo spazio libero da
sponde, rotaie, sostegni e carrelli e almeno 22,7 cm di immersione della coda
e del corpo rispetto al livello nominale.
La suite completa passa con 259 test e la build locale è riuscita. In Chromium
senza finestra, `?review&view=shark` conferma lo squalo visibile vicino alla
superficie in due istanti distanti dieci secondi in ciascun laghetto.

## 2026-11-14 - ASSET-005 - Squalo nei laghetti collegati

**Implementato.** Codex, base `364a720`. L'NPC `pond-shark` percorre un giro di
circa 80 s a 2,55 m/s. Attraversa il corridoio sotto i binari con due corsie e
risale lateralmente in entrambi i laghetti, facendo affiorare la dorsale.
Il modello originale è lungo circa 2,88 m alla scala del gioco e non ha collider.
Il [GLB](../art/squalo-v01/runtime-export.json) aggiunge 337.244 byte, 9.128
triangoli e al massimo una draw call quando in vista. Ha otto ossa e zero texture.
Il caricamento è differito in prossimità del percorso e la posa è campionata fino
a 30 Hz soltanto in vista. Riusa la scena subacquea della giostra e il rendering
dell'acqua esistente. Nessun passaggio di rendering aggiuntivo.

**Verificato.** `node --test casa3d/test/shark.test.mjs` controlla la chiusura
del giro e le due emersioni. (1.600 campioni del percorso, 64 fasi di nuoto per
l'inviluppo contro rotaie, sostegni, scocca e sedili.) Il margine minimo da
pareti, pavimento e soffitto del corridoio è 13,8 cm. Coda e corpo sono almeno
22,7 cm sotto il livello nominale dove l'NPC è visibile dalla superficie,
oltre il limite di 21,5 cm di abbassamento del livello per le onde.
La build locale e tutti i 259 test passano. In Chromium senza finestra ho
verificato lo squalo sotto i binari e la sola dorsale sopra il secondo lago.
La punta della dorsale è più alta nell'export di gioco per restare leggibile
fra le onde.

**Da misurare.** Costo GPU e frame time su dispositivi reali.

## 2026-11-13 - ASSET-004 - Nuoto dello squalo in Blender

**Implementato:** Codex, base `364a720` e sorgente `Squalo.blend` della
voce ASSET-003. [Squalo animato](../art/squalo-v01/README.md) con otto ossa,
ciclo di nuoto sul posto di 32 fotogrammi e dimostrazione di 12 secondi
con traiettoria e quota separate. Il costo nel gioco resta zero in questa fase.

**Verificato:** generazione in Blender 5.2, apertura nella sessione attiva
e tre render di prova. [Rapporto](../art/squalo-v01/animation-verification.json):
576 campioni della mesh deformata, chiusura del ciclo e almeno 7,55 cm
di immersione per tutte le parti diverse dalla dorsale.

**Da fare:** export e verifica del percorso effettivo, delle onde e delle
camere del gioco. Nessuna misura di prestazioni del runtime in questa fase.

## 2026-11-13 - ASSET-003 - Modello Blender dello squalo

**Implementato:** Codex, base `364a720`. [Squalo v01](../art/squalo-v01/README.md)
modellato da zero in Blender, lungo 3,43 m, con pinna dorsale principale
alta rispetto alla coda. Studio con vista dell'animale intero e piano
d'acqua di prova. Modello di authoring con 9.128 triangoli, un materiale
opaco e nessuna texture. Costo aggiuntivo nel gioco pari a zero in questa fase.

**Verificato:** generazione in Blender 5.2 e apertura nella sessione attiva.
Controllo di mesh, triangoli e quote delle parti. Esaminati entrambi i render:
emergono 29,2 cm di dorsale a riposo e la coda resta sotto il piano.
Conteggi e hash nel [rapporto](../art/squalo-v01/verification.json).

**Da fare:** rig e nuoto, export e percorso nel corridoio allagato. Verificare
ingombri in movimento e leggibilità della pinna con le onde, dalla riva
e dalla scena subacquea. Nessun test o benchmark del gioco per questa fase.

## 2026-11-13 - INPUT-002 - Rotazione della visuale con lo stick

**Implementato:** Codex, base `6b1d643` con l'input gamepad locale. Curva
progressiva per lo stick destro, velocità orizzontale massima ridotta di circa
il 24%, risposta verticale più lenta, accelerazione e frenata brevi. Il
contributo di un singolo frame alla rotazione è limitato a 33 ms di input.
Il filtro si azzera quando la visuale viene bloccata o si perde il focus.
Nessun passaggio di rendering o ciclo di aggiornamento aggiunto.

**Verificato:** `node --test casa3d/test/*.test.mjs`, 257 test superati, e
build locale da `index.template.html`. I test confrontano l'angolo a 30, 60
e 120 FPS, lo scatto con un frame lento e l'arresto dello stick. In Chrome,
con stick simulato alla stazione della giostra, misurati meno di 3° per frame
in orizzontale e nessuna rotazione residua dopo il reset dell'input.

**Da verificare:** sensazione con il controller fisico e prestazioni su GPU reale.

## 2026-11-13 - INPUT-001 - Comandi touch e gamepad

**Implementato:** Codex, base `6b1d643`. Su touch rimangono movimento e azioni
contestuali. Su desktop lettura del gamepad standard dal ciclo esistente,
due stick analogici, Azione, R1 per corsa e boost, comandi per il jetpack.
Nessun asset o ciclo di aggiornamento aggiunto.

**Verificato:** `node --test casa3d/test/*.test.mjs`, 255 test superati, e
build locale da `index.template.html`. Gamepad simulato in Chrome su giostra
e jetpack, inclusi selezione, conferma e arresto alla disconnessione. In viewport
touch, leva visibile e nessun suggerimento o pulsante generico a riposo.

**Da verificare:** mappatura del controller fisico e prova su telefono reale.

## 2026-11-13 - SCENA-014 - Chiusura automatica dell'avviso

**Implementato:** Codex, base `b020a2c`. L'avviso del pulsante `?` si chiude
dopo tre secondi e restituisce i comandi. Clic ed Escape chiudono in anticipo
e annullano il timer della singola apertura.

**Verificato:** `node --test casa3d/test/*.test.mjs`, 253 test superati,
e build Vite locale da `index.template.html`. In Chrome, nella scena del
tempietto, chiusura dopo 3.001 ms, ripristino dei comandi, clic, Escape e
riapertura.

## 2026-11-13 — SCENA-013 — Tempietto, fontana, carrelli e avviso

**Implementato:** Codex, base `fdf1ac8`. Tempietto ×5 nella radura dietro
la casa, con raccordo del terreno e rampa. Fontana spostata in una seconda
radura posteriore, fuori dalla zona del palco. Le barre dei carrelli ora hanno
bracci e perni sui sedili. Aggiunti dettagli a sedute, fiancate e assali.
Il pulsante `?` apre il solo messaggio rosso su tutta la finestra.

**Costo:** rampa da 18 triangoli. Carrello da 10.096 a 13.264 triangoli,
sempre con 7 mesh per copia, geometrie condivise e nessun nuovo GLB.

**Verificato:** `node --test test/*.test.mjs`, 253 test superati, e build Vite
da `index.template.html` con l'avviso esistente sui chunk sopra 500 kB. In Chrome
controllati ingombri rispetto a oggetti, alberi, rocce, binari e montanti,
carrelli alla stazione e avviso a schermo intero.
[Catture della prova](../art/lynx-temple-v01/runtime/scene-adjustments/).

**Da verificare:** prestazioni su dispositivi reali e sul sito pubblico.

## 2026-11-13 · ARRIVO-013 · Ventaglio dei bengala e accesso alla giostra

I cinque getti partono sotto l'inquadratura, con angoli laterali distinti
attorno alla direzione tridimensionale della casa e la stessa inclinazione
verticale di quella direzione. Rimosso il richiamo a schermo della giostra.
Restano il cartello della stazione, il tasto E, clic o tocco sul vagone e
la conferma della partenza. Nessun asset aggiunto.

**Verificato:** 253 test superati, build locale da template e prova Chrome
del volo e dell'apertura della conferma con E senza il richiamo.

## 2026-11-13 · ASTEROIDE-007 · Superficie continua e dettaglio per settori

**Implementato:** i bengala convergono verso la casa partendo sotto il
bordo inferiore della visuale. Foschia colorata rialzata, ancorata ai
fumogeni con maschera libera all'atterraggio. Il terreno condivide
vertici e normali tra facce adiacenti e conserva le aperture previste.
La [v06 di Blender](../art/asteroid-v06/README.md) aggiunge microrilievo,
fratture e pietrisco distribuito, soprattutto vicino al cratere.

**Costo:** una texture 512² e fino a tre settori opzionali residenti.
Due richieste simultanee globali, rilascio dopo dieci secondi fuori
portata. I 22 GLB pesano 2,38 MB complessivi e vengono richiesti a zone.
Il terreno principale ha 113.479 triangoli e 57.071 vertici indicizzati.
I buffer degli attributi e degli indici occupano circa 3,42 MB, contro
13,87 MB della superficie v05 senza indici. Sono conteggi del terreno,
non misure complessive della GPU.

**Verificato:** 253 test e build locale. In Chrome confronto tra
panoramica, cratere e risorse liberate, con controllo dell'origine dei
bengala e della coincidenza tra sorgenti di foschia e fumogeni.

## 2026-11-12 · ASTEROIDE-006 · Prima prova v05 nel gioco

**Implementato:** materiali di colore cotti in Blender, fianco v05 e
rilievo campionato ogni 0,5 unità locali. La griglia integra la differenza
rispetto al profilo di gioco e aggiorna il terreno e la quota di appoggio
dell'UFO insieme. Restano i ritagli di casa e laghetti e i raccordi piatti
del bordo, del tempietto e della cabina. Foschia bassa neutra dopo l'arrivo.

**Costo:** [export v05](../art/asteroid-v05/runtime-export.json) da
1.568.284 byte contro 1.050.448 byte del GLB precedente. La griglia occupa
40.401 byte decodificata. Foschia in un batch senza altre texture o passaggi
a schermo intero. Frammenti e caricamento per settori rinviati.

**Verificato:** 253 test superati e build dal template. Le
[viste Chrome](../art/asteroid-v05/runtime/report.json) confrontano
superficie, supporto, UFO, ritagli e punto d'atterraggio.

## 2026-11-12 · ASTEROIDE-005 · Roccia bruna, rilievo e impatto dell'UFO

**Implementato in Blender:** palette marrone scuro con polvere centrale più
chiara. Rilievo a partire dalle quote di gioco, attenuato su fondazione,
arrivo, campo, rive e palco. Cratere UFO con conca asimmetrica e bordo di
detriti irregolare. Posizione e posa del modello di riferimento lette dal
gioco. La grana è nel materiale; i 123 frammenti semisepolti sono in una
collezione separata, per 1.476 triangoli di dettaglio ravvicinato.

**Verificato:** volume a bordo saldato chiuso, 160 vertici del bordo
conservati e 18.846 triangoli di terreno nella scena di studio.
La [scena v05](../art/asteroid-v05/Asteroide_v05.blend) e i
[render](../art/asteroid-v05/README.md) documentano la composizione.
L'integrazione dovrà sincronizzare rilievo, collisioni e appoggi per evitare
di sommare il cratere di Blender a quello procedurale.

## 2026-11-12 · ASTEROIDE-004 · Prima revisione di superficie e fianco

**Implementato in Blender:** copia della v03 con due materiali procedurali,
basalto scuro, polvere calda attorno alla casa e sul lato d'arrivo, strati
inclinati e frattura scolpita nel fianco sudorientale. Casa v10 in una
collezione di riferimento e tre camere per la revisione.

**Verificato:** piano e bordo comune identici alla v03 vertice per vertice.
Volume chiuso nella verifica a bordo saldato. Due mesh e 10.560 triangoli.
Render Cycles della panoramica, della superficie e della frattura.

**Stato:** prima revisione in [Asteroide_v04.blend](../art/asteroid-v04/Asteroide_v04.blend).
Il [pacchetto](../art/asteroid-v04/README.md) comprende script e verifiche.
Bake, settori e prestazioni in gioco da verificare dopo la revisione della forma.

## 2026-11-12 · ARRIVO-012 · Puntamento dei bengala e giro dei fari

**Implementato:** i cinque getti seguono direzioni tridimensionali verso la
facciata e sono già spenti a 11,9 s su 14. Quattordici postazioni sui montanti
ad almeno 85 m di quota puntano verso la casa e si alternano casualmente.
Quattro fari a terra ruotano in senso orario, uno per lato, dal decimo secondo
dopo l'atterraggio e con turni di quattro secondi. Cinquantadue sorgenti
coprono anche retro e margini, con dissolvenza fino a 68 s. L'ellisse
dell'atterraggio esclude sia le sorgenti sia il fumo che vi deriva.

**Costo:** bengala ancora in due draw. Rispetto alla versione precedente,
al massimo un cono e uno SpotLight in più, senza ombre. Il fumo resta in
un draw con la stessa texture. I 544 quad aggiunti valgono 1.088 triangoli
e 23.936 byte di attributi istanziati. La prova Chrome registra circa
16–23 fps nelle tre inquadrature. Il costo GPU del fumo non è stato isolato.

**Verificato:** 253 test superati, build dal template, volo e spegnimento
prima del suolo in Chrome. Verificati il passaggio tra i primi due turni
durante l'arrivo reale e la sequenza completa nel test automatico. Inquadrati
i banchi sul retro e l'arrivo libero.

**Evidenze:** [volo](../art/animale-artificiale-v01/runtime/house-light-sequence/flight.png),
[atterraggio](../art/animale-artificiale-v01/runtime/house-light-sequence/atmosphere.png),
[retro](../art/animale-artificiale-v01/runtime/house-light-sequence/atmosphere-back.png)
e [report](../art/animale-artificiale-v01/runtime/house-light-sequence/report.json).

## 2026-11-12 · ARRIVO-011 · Bengala a fontana e fari sulla giostra

**Implementato:** cinque getti a nucleo bianco e base dorata con scintille
ramificate. La luce ambiente e direzionale calano durante il volo. Al suolo
tornano gradualmente e partono le sequenze dei fari e del fumo da tempo zero.
Dieci fari sono fissati sotto la traversa di altrettanti montanti della giostra
e puntano a zone della casa o del terreno. Ventotto sorgenti emettono banchi
con deriva orizzontale e dissolvenza fino a 42 s per particella.

**Costo:** due draw per i cinque bengala, con 10 triangoli e 650 segmenti.
Due SpotLight senza ombre, due coni e un batch per il fumo. Il passaggio da
180 a 392 quad aggiunge 9.328 byte di attributi delle istanze e 424 triangoli
al batch. La texture procedurale resta 64×64. Il costo GPU della trasparenza
non è stato misurato separatamente.

**Verificato:** suite 253/253 e build dal template. In Chrome i cinque
bengala sono visibili durante il volo con fari e fumo spenti. Il primo faro
sale di intensità al contatto col suolo. Le inquadrature esterne mostrano
fasci sul terreno e sulla casa, con un faro a circa 122 m in quota.

**Evidenze:** [volo](../art/animale-artificiale-v01/runtime/coaster-lighting/flight.png),
[terreno](../art/animale-artificiale-v01/runtime/coaster-lighting/atmosphere.png),
[casa](../art/animale-artificiale-v01/runtime/coaster-lighting/atmosphere-house.png)
e [report](../art/animale-artificiale-v01/runtime/coaster-lighting/report.json).

## 2026-11-12 · ARRIVO-010 · Cinque bengala, atmosfera e pausa del prato

**Implementato:** cinque getti più grandi, aperti a ventaglio dalla visuale.
Venti sorgenti di fumo distribuite sull'asteroide con dissolvenza fino a 13,8 s
per particella. Fasci più ampi con lo stesso limite di due fari. Ultima modifica:
erba 3D disattivata al caricamento tramite `MEADOW_ENABLED`.

**Verificato:** 253 test, build locale e arrivo in Chrome con cinque getti e
spegnimento al suolo. A 1100×720 nella stessa vista esterna si passa da 26.000
matrici dell'erba a zero (1.664.000 byte di buffer JS rimossi). Modello e
texture dell'erba non vengono richiesti. Il contatore scende da circa 949 a
867 draw e da 1,237 a 1,174 milioni di triangoli, senza variazione delle
collisioni. Il confronto non misura la memoria GPU complessiva.

**Evidenze:** [Volo](../art/animale-artificiale-v01/runtime/palm-flare-meadow/five-bengals.png),
[prato attivo](../art/animale-artificiale-v01/runtime/palm-flare-meadow/meadow-on.json)
e [prato disattivato](../art/animale-artificiale-v01/runtime/palm-flare-meadow/meadow-off.json).

## 2026-11-12 · NPC-005 · Prese sopra metà palo

**Implementato:** prese rialzate su tutti i 25 montanti. L'arco del primo
salto dura 1,30 s. Sui montanti più bassi la salita nei salti si riduce
per tenere spazio sotto le traverse.

**Verificato:** ogni vertice della mesh in posa di presa resta sopra metà
montante. Campioni a 60 Hz per andata e ritorno, inclusi pali, traverse e rocce.

## 2026-11-12 · ARRIVO-009 · Bengala, fuochi lungo la giostra e atmosfera

**Implementato:** 19 lanci di bengala dalla visuale durante il volo, con
direzioni diverse. Le raffiche della giostra iniziano al primo avvicinamento
alla casa, dal 10% al 98,5% del giro, con coppie di scoppi ogni 0,51 s.
Sott'acqua si sospendono. Otto postazioni per i fari e otto sorgenti di fumo
rosa, giallo, blu e rosso attivano i loro effetti a intervalli.

**Costo:** 1.368 punti e 2.052 segmenti dei bengala aggiungono due chiamate
e 306.432 byte di attributi durante il volo. In giostra due chiamate e
finestre di cinque secondi, con fino a 32 raffiche per buffer incluse
le code. Per l'atmosfera fino a quattro chiamate, due SpotLight senza
ombre, 72 quad di fumo e una texture RGBA 64×64.

**Verificato:** suite 253/253, build dal template e verifica Chrome di
bengala, fari, fumo e raffiche lungo la giostra.
[Misure e immagini](../art/animale-artificiale-v01/runtime/asteroid-atmosphere/).

## 2026-11-12 · NPC-004 · Ritorno sui montanti

**Implementato:** approvata la scimmia con coda. Ai due estremi del tratto
inverte il verso dopo la sosta. Il ritorno usa gli stessi archi e gli stessi
punti di presa in ordine inverso. Il GLB resta da 13.822 triangoli.

**Verificato:** campionamento a 60 Hz delle 48 tratte in entrambe le direzioni
e controllo di montanti, traverse e rocce. Chrome conferma l'inversione al lago
e il ritorno al primo palo con la [prova accelerata](../art/scimmia-npc-v01/runtime/return-verification.json).

## 2026-11-12 · ARRIVO-008 · Radure, fuochi dietro l'asteroide e ordine dei dischi

**Implementato:** alveare, cesto, tazza e cabina distribuiti in quattro radure.
Le collocazioni fisse lasciano libero lo spazio davanti al palco. Fuochi
più grandi in coordinate mondo, oltre il piano posteriore di casa e asteroide.
Nella giostra ripartono fra il 57,5% e il 65% del giro. La musica parte da
`03.112`, prosegue su `03.113` e passa al disco da nove tracce dalla `01.101`.

**Costo:** due chiamate di disegno durante ciascuna sequenza. In arrivo
3.840 punti e 5.760 segmenti, 860.160 byte di attributi. In giostra metà
dei punti, segmenti e byte. I buffer vengono liberati al termine.

**Verificato:** suite 251/251 e build Vite dal template. Chrome conferma
le radure, l'avvicinamento alla cabina, la raccolta di tazza e leccalecca,
il dettaglio vicino dell'alveare, il passaggio reale tra i dischi e il ciclo
dei fuochi dall'avvio al rilascio dei buffer.
[Prova browser](../art/animale-artificiale-v01/runtime/rear-fireworks/browser-report.json).

## 2026-11-12 · NPC-003 · Coda animata e percorso in avanti

**Implementato:** torso più affusolato, spalle raccordate e coda a quattro
ossa animata durante la camminata e i salti. Dopo il primo palo, la scimmia
alterna salti in avanti e laterali su 25 montanti esistenti (campate 176–164).
Si ferma sull'ultimo palo prima del tratto del lago senza montanti consecutivi.
Accanto al masso, la quota delle prese deriva dagli ingombri delle rocce
istanziate. I salti tengono conto dello spazio sotto le traverse.

**Costo:** 13.822 triangoli (+212), 21 ossa (+4), 569.620 byte (+20.724),
un materiale opaco e zero texture. Calcolo delle traiettorie a inizializzazione,
con pose visibili valutate fino a 30 Hz come nella versione precedente.

**Verificato:** suite 250/250 e build Vite dal template. Gli appoggi sono
verificati sulle sezioni dei montanti. L'intero percorso è campionato a 60 Hz
per gli ingombri rispetto a montanti, traverse, rocce e cabina.
Chrome su UHD 630 ha completato il percorso e l'atterraggio normale. A
1080 × 720, con camera ferma sulla prima presa, 588 → 589 chiamate di
disegno e 922.315 → 936.137 triangoli per frame, circa 30 FPS in entrambi
i campioni. [Rapporto browser](../art/scimmia-npc-v01/runtime/v02/browser-report.json).

## 2026-11-12 · NPC-002 · Prima scimmia sui montanti della giostra

**Implementato:** la scimmia parte dietro a sinistra al termine del volo.
Cammina a terra, salta sul primo montante e percorre un circuito di quattro
montanti esistenti. La presa è adattata alle due facce adiacenti dello
spigolo da 32 cm. Resta attaccata da due a sette secondi a ogni sosta.

**Costo:** GLB opzionale richiesto al clic su ATTERRA, 548.896 byte,
13.610 triangoli, una mesh skinnata con un materiale, zero texture e nessun
collider. Posa fissa nelle soste e aggiornamento delle azioni fino a 30 Hz
in campo entro 65 m. Niente passaggi d'ombra aggiunti.

**Verificato:** prova delle prese sulla geometria reale, campioni a 60 Hz
della salita e dei quattro salti, partenza nel punto cieco e intervallo delle
soste. Suite 250/250 e build Vite dal template. In Chrome su UHD 630 a
1080 × 720, prova a camera fissa con scimmia in presa: 588 → 589 chiamate e
922.315 → 935.925 triangoli per frame, circa 30 FPS in entrambi i campioni.
[Rapporto browser](../art/scimmia-npc-v01/runtime/browser-report.json).

**Da verificare:** prestazioni su hardware mobile e GPU target. La seconda
scimmia e il percorso sui tetti restano per un intervento successivo.

## 2026-11-12 · NPC-001 · Scimmia in Blender

**Implementato:** primo NPC in una scena Blender autonoma, con volto ispirato
alla reference allegata. Camminata sulle nocche, arrampicata sul primo palo,
salto tra due pali e salto sul tetto di prova, con assestamento finale.
[Sorgente, procedura e render](../art/scimmia-npc-v01/README.md).
Baseline locale `fdf1ac8`.

**Costo in authoring:** 13.610 triangoli, 17 ossa, un materiale opaco con
colori ai vertici e zero texture. Costo residente aggiunto al gioco zero.
La soluzione delle prese avviene durante la generazione delle azioni.

**Verificato in Blender:** sequenza di 337 fotogrammi a 24 fps, controllo dei
pesi, bounds campionati e scarti dei punti di controllo durante camminata
e atterraggi. [Conteggi e hash](../art/scimmia-npc-v01/verification.json).

**Da verificare:** approvazione della forma e delle animazioni, appoggi e
traiettoria sul mondo effettivo, esportazione e prestazioni nel browser.

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
