# Organizzare e ampliare il mondo

Obiettivo: un asteroide esplorabile, una grande casa centrale e molte attrazioni.
Il costo del dettaglio deve dipendere da ciò che serve nella vista corrente.
Questa guida descrive il sistema introdotto il 4 ottobre 2026 e il punto in cui
inserire ogni nuovo contenuto.

## Tre cataloghi, tre responsabilità

| Catalogo | Contiene | Esempio |
| --- | --- | --- |
| `src/world/catalog.mjs` | Zone con ID stabile e punto di riferimento | `outdoor:arrival`, `house:living` |
| `src/world/content.mjs` | Oggetti collocati, zona proprietaria e politica di visibilità | `landing-beehive` appartiene all'arrivo |
| `src/world/assetCatalog.mjs` | Modelli riutilizzabili, URL dei livelli e soglie | `beehive`: far, medium, near |

L'asset è il modello; il contenuto è una sua collocazione nel mondo. Due copie
dello stesso modello devono avere ID di contenuto e radici distinti. Le funzioni
di costruzione restano in `src/rooms/`; la nuova cartella `src/world/` si occupa
di classificazione, visibilità e caricamento del dettaglio.

Le zone esterne sono arrivo, giardino, sport e asteroide. La casa distingue la
struttura condivisa e i cinque piani. Gli anchor descrivono posizioni locali del
modello, prima di `WORLD_SCALE = 5`: sono riferimenti organizzativi, non muri,
confini di collisione o volumi di occultamento. Una zona può contenere più
gruppi con ingombri e visibilità indipendenti.

## Cosa è già operativo

- Il catalogo registra 27 contenuti, compresi giostra, secondo laghetto e tazza.
- Solo le radici dichiarate `kind: 'decoration'` possono essere nascoste dal
  registro quando il loro ingombro è fuori dall'inquadratura. I figli nascosti
  dall'autore restano nascosti. I bounds sono calcolati alla registrazione,
  maggiorati di un margine e conservati; non si ricalcolano tutte le mesh a ogni frame.
- Pavimenti, terreno, struttura della casa, ascensore, percorso, campo e laghetto
  restano residenti. Le collisioni catturate non dipendono dalla visibilità.
- Fontana, alveare e tempietto caricano inizialmente il solo livello `far`. Il dettaglio
  maggiore arriva progressivamente quando occupano abbastanza spazio sullo schermo.
- I confini `streamingBoundary` proteggono ogni contenuto dal raggruppamento del
  genitore. È possibile ottimizzare **dentro** una radice passando quella radice
  a `instanceStaticMeshes` / `batchStaticArchitecture`.

Non c'è ancora occultamento per portali tra stanze: l'asset della casa mescola
superfici interne ed esterne. Non nascondere un piano solo perché il giocatore
si trova su un altro: finestre, torri e vano ascensore possono mostrarlo.
La casa, il terreno e gli altri asset senza livelli separati si caricano ancora
all'avvio. Lo streaming attuale riguarda il dettaglio visivo di fontana, alveare
e tempietto della lince.

## Caricamento e livelli di dettaglio

`visualLod.mjs` offre un controller indipendente dal GLTFLoader, verificabile con
caricamenti simulati. `createAssetVisual` collega il controller al catalogo GLB.

| Livello | Soglia nominale | Politica |
| --- | ---: | --- |
| far | 0 pixel | Necessario all'avvio; rimane disponibile come fallback |
| medium | 80 pixel | Caricamento su richiesta |
| near | 260 pixel | Modello originale, caricato su richiesta |

La misura è il diametro proiettato della sfera dell'asset, in pixel del buffer
di rendering; considera trasformazioni, FOV e dimensioni della vista. L'isteresi
del 15% usa soglie diverse all'avvicinamento e all'allontanamento: medium entra
a 92 pixel ed esce sotto 68; near entra a 299 ed esce sotto 221.

La coda condivisa esegue al massimo due caricamenti LOD contemporanei. Per ogni
oggetto si carica un livello alla volta. Durante l'attesa resta visibile il
miglior livello disponibile non superiore a quello richiesto. I materiali dei
livelli opzionali vengono compilati prima di mostrarli. Fuori campo, sott'acqua,
durante lo splash o a pagina nascosta non si richiede nuovo dettaglio.

Dopo 20 secondi sul livello far o inattivo, i livelli opzionali caricati vengono
rimossi e le loro risorse GPU rilasciate; al ritorno possono essere caricati di
nuovo. Una risposta tardiva non può mostrare un livello non più richiesto.
Il fallimento di un livello opzionale conserva il fallback: un solo tentativo
aggiuntivo, dopo almeno 15 secondi, senza bloccare l'esplorazione. Un errore del
livello far richiesto segue invece la schermata di errore iniziale.

Ogni tier mantiene le coordinate del sorgente. Per normalizzare scala e appoggio
si usano sempre i bounds **originali** di `src/assets/models/lod/metadata.json`,
mai quelli della variante appena caricata. Questo evita salti di posizione o
dimensione. La pipeline riproducibile e gli hash sono in `art/world-lod/`.

Il tempietto conserva i propri bounds in `src/assets/models/lod/lynx-temple-metadata.json`
e la pipeline in `art/lynx-temple-v01/`. Il suo sorgente è già in metri: sotto
`garden` usa scala `1 / WORLD_SCALE`. Il riferimento di posa è il terreno a
quota zero, **non** il minimo dei bounds: questi includono il pozzo sotto il
pavimento. Spostarlo in base al minimo solleverebbe l'intero edificio.

## Tempietto della lince

La collocazione `lynx-temple`, radice `LynxTemple`, appartiene a `outdoor:garden`
ed è `structure`: gradini, pavimento e pareti rimangono percorribili anche
quando cambia il dettaglio visivo. Il layout è in `src/rooms/lynxTempleLayout.mjs`;
la posizione locale `(17, 0, -18)` corrisponde a `(85, 0, -90)` metri mondo,
con l'ingresso rivolto alla casa. L'erba lascia libero il basamento.

Il GLB fisico viene caricato insieme al tier `far`, prima di catturare le
collisioni. I tier visivi hanno `collisionDisabled`; il confine della radice
impedisce al batching del giardino di assorbirli. Il cambio LOD non sostituisce
il supporto del personaggio. Il modello conserva la forma e i materiali
dell'originale Blender, fermo al frame 1: la botola è chiusa, le profezie e
l'animazione dell'oracolo restano disattivate.

Le viste del tempietto nel pannello `?review` consentono il controllo di
esterno, interno, gradini, dettaglio vicino/medio/lontano e uscita dal campo.
Originale, script, hash e riscontri della verifica sono in `art/lynx-temple-v01/`.

## Cesto e raccolta all'arrivo

`lollipop-basket`, radice `LollipopBasket`, è un contenuto residente della zona
`outdoor:arrival`. Il GLB in metri usa scala `1 / WORLD_SCALE`; il centro è
`(-4, 0, 206)` metri mondo, la precedente posizione dell'alveare. L'alveare è
spostato di quattro metri verso la casa. Il jetpack conserva il proprio punto
di appoggio grazie all'anchor indipendente in `arrivalLayout.mjs`.

All'avvio della sessione il leccalecca del personaggio è nascosto, compresi
stecco e loghi. La raccolta rivela l'oggetto originale nella posa già realizzata;
lo stato si applica anche dopo il caricamento asincrono del personaggio.
Il cesto rimane pieno. Una ricarica del gioco avvia una nuova sessione.

Si raccoglie entro tre metri con **E**, clic/tocco sul cesto o con il pulsante
**Prendi un leccalecca**. Il comando touch già presente invia la stessa azione.
Il bersaglio deve essere visibile e raggiungibile senza pareti interposte;
il menu, l'atterraggio e i controlli bloccati impediscono la raccolta. Trascinamenti,
secondo puntatore e gesti annullati non attivano l'interazione sulla scena.
La raccolta è unica per sessione e non cambia posizione del giocatore.

La geometria intrecciata è solo visiva; un cilindro stabile descrive l'ingombro
fisico. Il batching rimane all'interno della radice. Sorgente modificabile,
generatore, hash e render del GLB reimportato sono in `art/lollipop-basket-v01/`.
Le viste **Cesto · raccolta** e **Leccalecca · in mano** nel pannello `?review`
posizionano la camera, mantenendo la raccolta reale. `world-diagnostics`
riporta stato del leccalecca e posizione del personaggio per il controllo browser.

## Ascensore

Il richiamo compare entro tre metri dal punto di imbarco del piano corrente,
controllando separatamente la quota dei piedi. **Usa l’ascensore** è un pulsante
per mouse e touch; **E** e il clic sulla pulsantiera aprono la stessa scelta.
Menu, viaggio e altre interazioni bloccanti disattivano il richiamo. La cabina
ha 3,20 metri di altezza libera, con vetri, montanti e cancello della stessa altezza.
`?review&view=elevator` apre un punto di prova percorribile davanti alla cabina;
la diagnostica riporta disponibilità, piano, viaggio e quota della cabina.

## Porta e videocitofono

`entry-intercom`, radice `EntryVideoIntercom`, è un contenuto residente di
`house:shell`, fissato allo stipite destro della porta, separato dalle ante.
La geometria è costruita da `videoIntercom.mjs`; ingombri e sequenza sono in
`intercomLayout.mjs`. Le misure del pannello sono in metri e la scala sotto
la casa è `1 / WORLD_SCALE`. La lente si trova esattamente `EYE_HEIGHT` sopra
il pianerottolo `ENTRY_STEPS.top`, a quota mondo 9,95 m.

Il display usa una camera fissa alla lente e un render 256², aggiornato al massimo
a 12 Hz soltanto entro 4,5 m e inquadrato. Renderizza una copia indipendente del
vero personaggio: ripristina la testa per il display, sincronizza ossa, trasformazioni
e oggetti impugnati, mantenendo la testa nascosta alla camera in prima persona.
Le UV del display ribaltano orizzontalmente l'immagine. La camera del citofono
conserva la stessa quota degli occhi; non segue verticalmente il personaggio.

Entro 3 m, dalla parte esterna e senza ostacoli, E/clic/tocco o il pulsante
**Suona il videocitofono** iniziano la chiamata. Finché manca il filmato viene
mostrata una schermata di attesa di due secondi; il video definitivo andrà
inserito in quel passaggio. Durante la chiamata i comandi di movimento sono
bloccati, le pressioni ripetute non riavviano l'attesa e la porta resta chiusa.
Al termine le ante si aprono verso l'interno con le collisioni dinamiche esistenti.
Allontanandosi si richiudono e occorre una nuova chiamata per entrare; dall'interno
si può sempre uscire. La vicinanza dall'esterno da sola non apre più la porta.

La vista **Ingresso · videocitofono** in `?review` posiziona il personaggio sul
pianerottolo alla corretta altezza. La diagnostica riporta quota della lente,
posizione del giocatore, render eseguiti, fase della chiamata e angoli delle ante.
Prove e riscontri sono in `art/entry-intercom-v01/`.

## Giostra e laghetti collegati

`asteroid-coaster` è residente nella zona arrivo; la partenza è a destra
dell'atterraggio, `(9, 0.8, 207)` metri mondo. `coasterLayout.mjs` conserva il
percorso chiuso e i frame comuni a binari, carrelli e camera. Il giro dura 105 s:
E/clic/tocco su qualunque vagone o **Sali sul carrello** entro 7 m aprono
la conferma di partenza. Il viaggio si conclude automaticamente sulla pedana
laterale; non si può scendere prima. Il corpo ritorna verticale alla discesa.
Il posto centrale del primo carrello mantiene il punto di vista; altri tre carrelli
vuoti seguono i binari a distanza costante. Il rettilineo della pedana di 24 metri
allinea tutti i vagoni parcheggiati. Le zampe usano temporaneamente una posa
con palmi in basso sulla barra. Durante il giro gli oggetti in mano sono nascosti;
inventario e posa originale tornano alla discesa. Tasto destro/trascinamento touch
e frecce laterali ruotano la visuale di massimo 60° per lato. I sostegni sono esterni
al corridoio del personaggio, verificato sull'intero percorso.
Il tratto nello spazio è intenzionalmente sospeso.
Stelle e nebulose condividono una camera che segue solo l'orientamento del
visitatore: nessuna parallasse durante il viaggio. Le nebulose sono superfici
fisse sulla sfera celeste, non sprite rivolti alla camera; nelle curve e nelle
inclinazioni restano ancorate alle stelle. Verifiche in `test/spaceSky.test.mjs`.
`coasterQuality.mjs` limita gli asset progressivi al far nei passaggi vicini alla
casa e al lago, al medium negli altri tratti. Non cambia la geometria fisica della
casa. Durante il giro l'erba è spenta in quota e al massimo al 3% vicino al suolo,
solo nelle celle locali; dopo la discesa tornano dettaglio e densità normali.

`landing-mug` è una tazza minimale a terra vicino all'atterraggio. Riutilizza
`createLollipopEquipment` e `createLollipopPickup` con i nodi della mano destra:
all'inizio è assente dalla mano; E/clic/tocco/pulsante la raccolgono una sola volta.

`garden-pond-exit` usa lo stesso profilo organico del primo lago a `(-120, 80)`
metri mondo. Entrambi i fori sono sottratti alla superficie reale dell'asteroide.
`basinPortal.mjs` apre le sponde; il corridoio allagato ha pareti, pavimento,
soffitto e luci e si può attraversare anche nuotando. La camera subacquea
condivide geometrie dei due laghetti e della giostra, senza disegnare la roccia
esterna. Pavimenti e soffitto del corridoio fanno parte dei vincoli del nuoto.
I binari sono visivi; la piattaforma di partenza ha supporti fisici separati.

`?review&view=coaster` apre direttamente la partenza. Le viste di spazio,
tunnel e secondo lago servono alla verifica; la diagnostica riporta progresso,
stato subacqueo e lunghezza. Test dedicati in `test/coaster.test.mjs`.

## Cabina contatti e sala separata

`contact-booth`, radice `ContactBooth`, è una struttura di `outdoor:arrival`.
L'esterno è modellato in Blender e caricato da `contact-booth.glb` (6.684
triangoli, 428 kB); sorgente, generatore e hash sono in `art/contact-booth-v01/`.
Il layout conserva i metri mondo in `CONTACT_BOOTH`: posizione `(-14, 0, 193)`,
scala `2 / WORLD_SCALE` sotto il giardino e fronte rivolto all'arrivo. La cabina
è ingrandita uniformemente al doppio: base 3,28 × 3,28 m e altezza 6,30 m.
Gli ingombri fisici e lo spazio libero seguono la stessa scala; i punti di
ingresso e ritorno mantengono la quota degli occhi del personaggio. La posizione
è arretrata rispetto alla prima proposta per appoggiare sul disco dell'asteroide.
Gli ingombri fisici semplici rimangono separati dalle mesh visive. L'erba libera
la zona. `?review&view=booth` apre il punto di verifica davanti all'ingresso.

Entrare nella cabina mantiene attivi ambiente, camera e personaggio del mondo.
La porta parte chiusa sia nel sorgente Blender sia nel gioco. E/clic/tocco su
**Apri la porta della cabina** la aprono verso l'esterno; il suo ingombro segue
la cerniera tramite collisione dinamica. L'ingresso guidato attende che la porta
sia aperta. La zona conserva bounds comprensivi dell'intera apertura dell'anta.
Quando il visitatore esce, la porta si richiude automaticamente dopo che l'intera
capsula ha liberato la traiettoria dell'anta. Non si richiude subito dopo la
sola apertura dall'esterno; attende una visita effettiva all'interno.
Si può camminare liberamente attraverso la porta oppure usare E/clic/tocco sul
comando **Entra nella cabina** per posizionarsi davanti ai controlli. Non avviene
alcuna navigazione all'ingresso. I vetri dell'asset Blender hanno alpha 0,10 e
il runtime mantiene la trasparenza senza scrivere profondità o proiettare ombre
opache: dall'interno si vede realmente il mondo esterno.

`contactBoothControls.mjs` monta due veri pulsanti Three.js rossi su basi gialle
sulla parete interna posteriore, fuori dai batch statici. Sotto hanno soltanto
due piccole targhette nel mondo: **MESSAGGIO** e **SALA INFORMAZIONI**, senza
titoli o spiegazioni sovrapposti. Controlli HTML trasparenti seguono la proiezione
dei pulsanti per tastiera e touch; clic sulla mesh, E guardando il comando e
tocco attivano la medesima azione. Si attivano soltanto dall'interno, entro tre
metri e con linea di vista libera. Le targhette non alterano le collisioni.

**MESSAGGIO** apre una piccola bozza HTML senza lasciare il mondo. Il testo resta
in memoria, destinato in futuro a `mail@animalhouselab.art`; invio disattivato
su richiesta dell'utente. Nessun servizio esterno riceve il messaggio.

Solo **SALA INFORMAZIONI** lascia il mondo: salva posizione e inventario, scarica
il renderer, mostra la discesa (`?experience=contact&travel=down`) e apre
`?experience=chamber`, un ingresso
autonomo per il futuro minigioco. Carica soltanto Three.js, navigazione e stanza
vuota; neppure la geometria della cabina viene importata. La stanza 8 × 8 m ha
lo stesso `Player`, `setupInput`, velocità e indicazioni del mondo principale:
WASD/frecce, Shift per correre, tasto destro per guardare; su touch la stessa
leva a sinistra e trascinamento a destra. La stessa capsula fisica collide con
pavimento e pareti. Esc apre il menu standard. La sala non contiene ancora
arredi o elementi di gioco. Sono condivisi soltanto questi moduli leggeri,
senza importare modelli, corpo del personaggio o mondo esterno.

Mondo e sala condividono il pulsante **?** accanto al menu, in alto a destra.
Le istruzioni compaiono soltanto aprendo questo aiuto: movimento e visuale,
poi la regola unica **E oppure clic sull'oggetto** per le azioni. Non si mostra
più il riquadro automatico delle istruzioni all'ingresso.

**Risali nella cabina** ricarica il mondo e ripristina
posizione, orientamento, leccalecca, tazza e jetpack precedenti usando una voce
temporanea di sessione consumata al ritorno. Lo stato del viaggio non include
testi privati. Il ritorno al mondo ne richiede il caricamento; la sala separata
non mantiene il mondo attivo. Movimento ridotto abbrevia il viaggio. Il vecchio
URL `?experience=contact` rimanda alla cabina integrata. `?review&view=booth-controls`
apre la verifica dei pulsanti dalla vera camera di gioco.

Verifiche: `test/contactBooth.test.mjs`, script browser e riscontri in
`art/contact-booth-v01/runtime/`. I controlli di rete sulla discesa e sulla sala
devono continuare a escludere il bootstrap del mondo, GLB e video. Il controller,
gli input, le costanti di layout e le collisioni condivise sono ammessi.

## Inserire un nuovo contenuto

1. Scegliere una zona esistente. Aggiungerne una al catalogo soltanto se ha una
   responsabilità distinta; usare un ID stabile, non il nome di una versione GLB.
2. Dare all'oggetto una radice con nome univoco. Definire posizione e dimensioni
   nel modulo di costruzione. Sotto `world`/`garden` una misura reale di un metro
   corrisponde a `1 / WORLD_SCALE`; distanze e margini del registro sono invece
   in metri mondo. Non duplicare coordinate già definite nei layout condivisi.
3. Registrare in `WORLD_CONTENT` ID, nome radice, zona, `kind` ed eventuale asset.
   Usare `structure` per superfici percorribili, elementi mobili necessari al
   gioco e contenuti la cui visibilità è già gestita da un sistema dedicato.
   Usare `decoration` solo quando spegnere l'intera radice è visivamente sicuro.
4. Per un modello costoso, conservare il sorgente e generare varianti medium/far
   con materiali, UV, origine e trasformazioni coerenti. Aggiungere gli URL e i
   metadati all'asset catalog. Come prima misura, puntare a medium sotto il 30%
   e far sotto il 12% dei triangoli originali, verificando il risultato alla
   dimensione reale sullo schermo. Questi rapporti non sono un budget FPS.
5. Creare un gruppo visivo separato dagli ingombri di collisione. Le collisioni
   necessarie al gioco devono essere pronte all'avvio e restare valide per tutti
   i livelli. Attendere `visual.ready` nel caricamento richiesto; registrare il
   controller in `garden.userData.visualLods` per l'aggiornamento centrale.
6. Conservare il confine prima di qualsiasi ottimizzazione del genitore. Prima
   catturare collisioni e riferimenti alle interazioni, poi raggruppare le mesh
   statiche **dentro** il contenuto. Non fondere tier, oggetti mobili o oggetti
   appartenenti a stanze diverse. Il campo da calcio mostra questo ordine.
7. Chiamare `worldZones.refreshBounds(root)` dopo spostamenti o aggiunte che
   cambiano l'ingombro. Per istanze con densità variabile conservare i bounds
   della popolazione completa prima di ridurne `count`; includere il movimento
   massimo delle animazioni e le varianti geometriche. Per asset con tier diversi
   impostare `root.userData.worldLocalBounds` con un `Box3` completo nello spazio
   locale della radice. Il registro lo copia con `localBounds` e applica la
   trasformazione mondo anche durante `refreshBounds`: l'evizione del dettaglio
   non può così restringere l'ingombro registrato.
8. Aggiornare questa guida/cataloghi se cambia il contratto. Conservare script,
   hash, conteggi e immagini di confronto nell'apposita cartella `art/`.

Esempio di voce, dopo aver costruito una radice chiamata `GardenKiosk`:

```js
{ id: 'garden-kiosk', root: 'GardenKiosk', zone: Z.GARDEN,
  kind: 'decoration', asset: 'kiosk' }
```

Per contenuti registrati fuori dal bootstrap, il registro espone anche:

```js
worldZones.register('outdoor:garden', root, {
  contentId: 'garden-kiosk', decorative: true, margin: 3,
});
// Al momento della rimozione, chi possiede il contenuto ne libera le risorse:
worldZones.unregister(root);
visual.dispose();
root.removeFromParent();
```

`unregister` ripristina i metadati e la visibilità; non distrugge risorse o
collisioni. L'aggiunta/rimozione a caldo di collider e il ciclo completo dei
minigiochi sono le priorità successive, non funzioni già fornite dal registro.
Non collegare nuovi controlli o timer globali al gestore dei livelli visivi.

## Verifica prima di integrare

Eseguire dalla radice del repository:

```powershell
node --test casa3d/test/worldAssets.test.mjs casa3d/test/worldZones.test.mjs casa3d/test/visualLod.test.mjs casa3d/test/optimization.test.mjs casa3d/test/lynxTemple.test.mjs casa3d/test/lollipopPickup.test.mjs casa3d/test/lollipopBasket.test.mjs
```

I test coprono i GLB reali, conservazione di coordinate/materiali, bounds, confini
dei raggruppamenti, fallback, caricamenti tardivi, isteresi e rilascio condiviso.
La suite completa resta `node --test casa3d/test/*.test.mjs`; gli otto fallimenti
preesistenti sono descritti in `PERFORMANCE.md` e non vanno nascosti.

Nel server sorgenti aprire `/index.template.html?review`. Attendere ATTERRA e
verificare che i tre modelli siano ancora far; provare le viste di fontana,
alveare e tempietto vicino/media distanza/lontano/fuori campo, attendere lo
scaricamento e tornare vicino.
Verificare poi atterraggio con mano vuota, rifiuto della raccolta da lontano,
raccolta vicino al cesto con E/clic/pulsante, mano equipaggiata e tazza invariata.
Ricaricare e ripetere a viewport stretta; sul dispositivo touch verificare anche
tocco sul modello, trascinamento per guardare e uso simultaneo della leva.
Il pannello mostra livelli e contenuti visibili; `data-state` dell'elemento
`world-diagnostics` riporta anche richieste, errori, memoria e triangoli fisici.
Controllare passaggi, finestre, ascensore e vista subacquea. Ripetere con viewport
stretta; questo controlla la proiezione, non simula le prestazioni di un telefono.

Per valutare FPS o tempo GPU serve una misura separata sui dispositivi target.
Conteggi di triangoli, file scaricati e test funzionali non sostituiscono quella misura.
