# Stato del progetto e passaggio di consegne

Aggiornato il **12 novembre 2026**, a partire da `7c58fec`, dalle modifiche
locali del 20 ottobre e dall'integrazione del monolite musicale. La pagina
descrive il checkout locale.

Per lavorare: [indice](../README.md), [prestazioni](../PERFORMANCE.md),
[inserimento contenuti](../WORLD_CONTENT.md), [registro asset](ASSET_REGISTER.md),
[diario](DIARIO_DI_BORDO.md). I percorsi in codice sono relativi a `casa3d/`.

## Soluzione raggiunta

Il mondo principale è l'asteroide con `mansion-v10`, paesaggio, casa percorribile,
ascensore, giostra, due laghetti collegati, tempietto, palco e oggetti all'arrivo.
Il prototipo greybox, il suo modello, i sorgenti, i test e i pacchetti dedicati
sono rimossi. I vecchi URL `?scene=greybox` aprono il mondo principale;
le versioni eliminate restano recuperabili nella cronologia Git.

| Area | Stato corrente e riferimento |
| --- | --- |
| Organizzazione | 10 zone e 33 collocazioni: `src/world/catalog.mjs` e `content.mjs`. Distinte dal catalogo dei modelli riutilizzabili. |
| Arrivo | Monolite e jetpack presso il vialetto, stazione della giostra a destra. Cesto, alveare, tazza e cabina occupano radure separate. ATTERRA avvia il volo con bengala dalla visuale e fuochi sullo sfondo. Le raffiche accompagnano la giostra dal primo avvicinamento fino al rientro, fuori dai tunnel subacquei. La musica parte da 03.112. |
| Atmosfera esterna | Dopo l'atterraggio si attivano il fumo, i fari in quota con cadenza casuale e la sequenza dei quattro fari a terra. Tutti i fasci puntano sulla casa. L'area di atterraggio resta libera dal fumo. In volo la casa è in penombra. `?review&view=atmosphere`, `?review&view=atmosphere-house` e `?review&view=atmosphere-back`. |
| Casa | Modello v10 caricato all'avvio; correzioni runtime, vetri semplificati, istanze e batch spaziali. Collisioni catturate prima di sostituire le mesh. Cabina ascensore alta 3,20 m nel runtime. |
| Terreno | [Base v05](../art/asteroid-v05/README.md) con bordo e aperture preservati, triangoli con vertici condivisi e [dettaglio v06](../art/asteroid-v06/README.md) caricato da vicino. `?review&view=terrain` e `?review&view=terrain-ufo`. |
| NPC all'arrivo | Una scimmia con coda animata parte alle spalle a sinistra e percorre 25 montanti della giostra in entrambe le direzioni, con prese sopra metà palo. La prova locale segue il percorso con `?review&view=monkey`. |
| Gatti sull’asteroide | 24 gatti in nove radure, di cui uno presso l’atterraggio. Taglia aumentata del 20% rispetto alla prima versione, corporature e livree individuali, camminata, lavaggio di una zampa e riposo. Il modello condiviso si carica in prossimità. Viste locali `?review&view=cats`, `cats-groom` e `cats-rest`. [Sorgente e prove](../art/cat-colony-v01/README.md). |
| NPC nei laghetti | Lo squalo gira in circa 112 s. Passa sotto i binari e nuota in curva per oltre 10 s con la dorsale a filo d'acqua in ciascun laghetto. Viste locali `?review&view=shark`, `?review&view=shark-tunnel` e `?review&view=shark-surface`. |
| Banco nei laghetti | 36 pesci in 83,77 s, con movimenti sui tre assi. Corsie opposte a fianco del carrello e due curve nei laghetti. Uno spazio di nuoto distinto dallo squalo. Viste locali `?review&view=fish`, `fish-outbound`, `fish-return`, `fish-pond-near` e `fish-pond-far`. [Prove e conteggi](../art/banco-acquario-v01/README.md). |
| Dettaglio progressivo | Fontana, alveare e tempietto partono far e richiedono medium/near secondo dimensione proiettata; fallback, isteresi, coda limitata e rilascio degli opzionali. |
| Radure posteriori | Il tempietto della lince è a scala ×5, con una rampa d'accesso, e la fontana di cioccolata occupa una radura separata. `?review&view=temple` e `?review&view=fountain`. |
| Visibilità | Il registro nasconde solo decorazioni dichiarate sicure; bounds conservativi e fisica indipendente. Casa e superfici percorribili restano residenti. |
| Effetti | Fontana e acqua hanno limiti locali. Erba 3D temporaneamente disattivata. Giostra con profilo ridotto e scene dedicate sott'acqua. Le regole precise sono in `PERFORMANCE.md`. |
| Interazioni | Input e capsule condivisi; pickup, porte, ascensore, citofono e cabina mantengono controller propri. Le funzioni sono descritte in `WORLD_CONTENT.md`. |
| Sala informazioni | Il pulsante nella cabina lascia il mondo per discesa/sala autonoma. La sala riusa moduli leggeri senza caricare asset del mondo. Messaggio ancora bozza locale con invio disattivato. |
| Interfaccia del mondo | CREDITS in basso a destra nella schermata iniziale apre le attribuzioni. Nel gioco il pulsante `?` apre per tre secondi un avviso rosso a schermo intero. |
| Comandi | Su touch, azioni contestuali. Su desktop, gamepad con mappatura standard, movimento analogico, visuale progressiva e comandi dedicati al jetpack. Vedi `WORLD_CONTENT.md`. |
| Diagnostica | `?review` locale apre viste ripetibili, con pannello esplicito tramite `&panel` per FPS/render CPU, draw/triangoli, richieste LOD, risorse e collisioni. |

## Cosa non è ancora risolto

- **Nessun occultamento per stanza/portali.** Il GLB della casa mescola interno
  ed esterno. Nascondere un piano romperebbe finestre, torri e vano ascensore.
- **Nessuno streaming integrale del mondo.** Casa, terreno, asset residenti e
  collisioni si caricano all'avvio; oggi si scarica il dettaglio opzionale dei
  tre modelli progressivi. Le richieste di rete già partite non vengono abortite.
- **Lifecycle completo dei minigiochi da progettare.** Il registro non gestisce
  da solo aggiunta/rimozione a caldo di collider, input, timer e risorse.
  `unregister` ripristina metadati/visibilità, non esegue queste operazioni.
- **Visibilità dell'acqua profonda da allineare.** `deepPond.mjs` omette la
  superficie oltre 24 m nella propria scena subacquea; il mondo attuale usa la
  scena combinata di `asteroidCoaster.mjs`, che ne sincronizza la geometria
  ma non quel flag di visibilità. Non considerare già applicato quel risparmio
  nella scena combinata. La discrepanza è emersa dall'audit dei sorgenti;
  impatto visivo/prestazionale e correzione restano da verificare.
- **Budget su dispositivi target da fissare.** Mancano una matrice concordata
  desktop/mobile e misure aggiornate comparabili di frame time/GPU/memoria.
  Le misure UHD 630 di settembre e quelle della giostra sono storiche.
- **Giostra: confronto finale prestazionale ancora da registrare.** I rapporti
  attestano le riduzioni introdotte; il prima locale di circa 20,5 FPS al 3%
  non attesta il risultato finale né prestazioni online.
- **Tempietto e cesto: QA finale browser ancora aperta nei rapporti.** I
  [rapporti tempietto](../art/lynx-temple-v01/final-report.json) e
  [cesto](../art/lollipop-basket-v01/final-report.json) indicano prove automatiche
  e build riuscite ma verifica finale combinata pending. Le immagini parziali
  non chiudono quel lavoro; il touch reale del cesto resta da provare.
- **Build:** permane l'avviso Vite sul chunk condiviso oltre 500 kB. Non è un
  errore di compilazione e non prova da solo un problema di FPS.

## Test e debito tecnico

Il 17 novembre 2026 la suite con la colonia di gatti dà **265 test, tutti
superati**. I due nuovi test coprono percorsi, appoggi e condivisione
della geometria.
La build locale è riuscita con il consueto avviso Vite sul chunk maggiore.

Esecuzione del 12 novembre 2026 dalla radice:

```powershell
node --test casa3d/test/*.test.mjs
```

**Esito del 12 novembre: 253 test, 253 superati, zero fallimenti**, nessuno saltato
o cancellato. Il 20 ottobre erano 237. Il [pacchetto di allineamento](../art/player-test-alignment-2026-10-20/README.md)
conserva log, diagnosi e confronto degli hash dei sorgenti runtime.
Tre test dell'NPC coprono l'ordine dei 25 montanti, le prese, la coda animata
e gli ingombri durante i salti.

I quattro fallimenti rimasti dopo il ritiro greybox sono risolti nelle fixture:

| Test | Causa e correzione |
| --- | --- |
| `test/arrival.test.mjs` | Spawn e quota attesa erano ancora a 1,65 m. Ora usano `EYE_HEIGHT`, mantenendo avanzamento e caduta oltre il bordo. |
| `test/scale.test.mjs` | L'asserzione finale pretendeva 1,65 m. Ora verifica i 2 m attuali, conserva supporto/quote dei piani e usa il v10 attivo. |
| `test/collision.test.mjs` | Posizioni calcolate per occhi a 2 m ma capsula del solver a 1,65 m: scarto di 35 cm. Ora passa le dimensioni del vero `Player` e verifica sia v09 sia v10, con gli stessi controlli di muri, pavimenti e porta. |
| `test/towerFloors.test.mjs` | Stessa incoerenza della capsula: la breve discesa terminava 15 cm sopra il fondo. Ora usa le dimensioni attuali e verifica sia appoggio sia quota finale, oltre a fori e palo. |

Visuale, personaggio, fisica del runtime e default generici del solver sono
invariati. Le tolleranze non sono state allargate. Il test aggiuntivo sul v10
porta il totale da 236 a 237. Quando si simula il personaggio con chiamate
dirette al solver, passare esplicitamente le sue dimensioni: il default
generico `eyeHeight = 1.65` non rappresenta il personaggio corrente.

Per confronto storico: prima del ritiro greybox **240/232/8**
(totali/superati/falliti), subito dopo **236/232/4**. Il
[pacchetto di ritiro](../art/handoff-2026-10-20/README.md) conserva quella fase;
non è più l'esito corrente. Sono stati eliminati solo i test del prototipo,
mentre i quattro test del mondo principale sono stati corretti e mantenuti.

Build locale rigenerata con `deploy.ps1` senza `-Push`; nessuna pubblicazione
eseguita da questo intervento. La rimozione del prototipo richiede nuova build:
non basta cancellarne il ramo nei sorgenti e lasciare l'HTML pubblicabile vecchio.
L'allineamento successivo modifica soltanto test e documentazione, quindi
non richiede una nuova build o una variazione della visuale.

## Prima del refactoring e delle prossime attrazioni

1. Ripartire da una revisione identificabile, registrare lo stato locale e
   completare le prove aperte sopra e rieseguire la suite dalla baseline verde.
2. Concordare dispositivi/viewport e budget di frame time, memoria e caricamento;
   acquisire il prima con il protocollo di [PERFORMANCE.md](../PERFORMANCE.md).
3. Mappare dipendenze e proprietà: bootstrap, fisica, cataloghi, rendering,
   interazioni e risorse. Preservare il contratto condiviso invece di copiare
   il ciclo principale per ogni attrazione.
4. Procedere per interventi circoscritti, confrontabili e reversibili;
   verificare avvio, LOD, attraversamenti, pickup/porte, immersione e ritorno
   dalle esperienze autonome dopo ogni cambiamento rilevante.
5. Prima di contenuti caricati/rimossi a caldo, definire esplicitamente chi
   monta/smonta collider, input e risorse. Una zona catalogata non è già uno
   streaming manager per minigiochi.
6. Registrare per ogni passo decisione, risultato e prossimo lavoro nel diario.
   Aggiornare questa fotografia quando cambia la soluzione effettiva.

Questa è una sequenza di preparazione; il refactoring non è stato eseguito
durante il riordino documentale.
