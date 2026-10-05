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

- Il catalogo registra 19 contenuti senza spostarli o cambiarne le trasformazioni.
- Solo le radici dichiarate `kind: 'decoration'` possono essere nascoste dal
  registro quando il loro ingombro è fuori dall'inquadratura. I figli nascosti
  dall'autore restano nascosti. I bounds sono calcolati alla registrazione,
  maggiorati di un margine e conservati; non si ricalcolano tutte le mesh a ogni frame.
- Pavimenti, terreno, struttura della casa, ascensore, percorso, campo e laghetto
  restano residenti. Le collisioni catturate non dipendono dalla visibilità.
- Fontana e alveare caricano inizialmente il solo livello `far`. Il dettaglio
  maggiore arriva progressivamente quando occupano abbastanza spazio sullo schermo.
- I confini `streamingBoundary` proteggono ogni contenuto dal raggruppamento del
  genitore. È possibile ottimizzare **dentro** una radice passando quella radice
  a `instanceStaticMeshes` / `batchStaticArchitecture`.

Non c'è ancora occultamento per portali tra stanze: l'asset della casa mescola
superfici interne ed esterne. Non nascondere un piano solo perché il giocatore
si trova su un altro: finestre, torri e vano ascensore possono mostrarlo.
La casa, il terreno e gli altri asset senza livelli separati si caricano ancora
all'avvio. Lo streaming attuale riguarda il dettaglio visivo di fontana e alveare.

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
   massimo delle animazioni e le varianti geometriche.
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
node --test casa3d/test/worldAssets.test.mjs casa3d/test/worldZones.test.mjs casa3d/test/visualLod.test.mjs casa3d/test/optimization.test.mjs
```

I test coprono i GLB reali, conservazione di coordinate/materiali, bounds, confini
dei raggruppamenti, fallback, caricamenti tardivi, isteresi e rilascio condiviso.
La suite completa resta `node --test casa3d/test/*.test.mjs`; gli otto fallimenti
preesistenti sono descritti in `PERFORMANCE.md` e non vanno nascosti.

Nel server sorgenti aprire `/index.template.html?review`. Attendere ATTERRA e
verificare che entrambi i modelli siano ancora far; provare le viste di fontana e
alveare vicino/media distanza/lontano/fuori campo, attendere lo scaricamento e tornare vicino.
Il pannello mostra livelli e contenuti visibili; `data-state` dell'elemento
`world-diagnostics` riporta anche richieste, errori, memoria e triangoli fisici.
Controllare passaggi, finestre, ascensore e vista subacquea. Ripetere con viewport
stretta; questo controlla la proiezione, non simula le prestazioni di un telefono.

Per valutare FPS o tempo GPU serve una misura separata sui dispositivi target.
Conteggi di triangoli, file scaricati e test funzionali non sostituiscono quella misura.
