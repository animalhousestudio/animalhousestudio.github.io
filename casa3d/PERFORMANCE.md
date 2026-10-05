# Rendering e nuovi asset

## Zone e dettaglio progressivo — 4 ottobre 2026

La guida operativa è [WORLD_CONTENT.md](WORLD_CONTENT.md). `src/world/` separa
zone, collocazioni e asset riutilizzabili; 19 contenuti sono registrati con
confini che i raggruppamenti del genitore non possono attraversare. Il campo
mantiene il batching interno; il prato conserva bounds della popolazione completa.
La visibilità usa ingombri conservativi: nessuna esclusione automatica dei piani
dietro i muri, nessuna modifica all'indice fisico quando un contenuto si nasconde.

Fontana e alveare hanno ora tre livelli geometrici:

| Asset | Near originale | Medium | Far | File iniziale prima → ora |
| --- | ---: | ---: | ---: | ---: |
| Fontana | 207.706 tri | 40.999 tri | 10.229 tri | 4.967.136 → 342.388 byte |
| Alveare | 112.756 tri | 24.746 tri | 10.444 tri | 5.419.764 → 544.296 byte |

Per questi due asset il livello iniziale scende da 320.462 a 20.673 triangoli
(−93,5%) e da 10.386.900 a 886.684 byte (−91,5%). Sono conteggi dei modelli/file,
non un guadagno FPS misurato, e non includono api, particelle o il resto del mondo.
L'appoggio e la scala di tutti i livelli derivano dai bounds del modello originale.

All'avvio si aspetta soltanto il far dei due modelli, insieme alle risorse ancora
richieste di terreno, casa e paesaggio. Medium/near arrivano in base alla dimensione
proiettata (80/260 pixel nominali, isteresi 15%), con due caricamenti simultanei
al massimo. Il dettaglio opzionale fuori uso si scarica dopo 20 secondi; errori
di rete conservano il fallback e ammettono un solo retry dopo almeno 15 secondi.
Geometrie, materiali e texture GPU vengono rilasciati rispettando i proprietari
condivisi; gli ImageBitmap non vengono chiusi forzatamente perché il loader può
condividerne la sorgente. Gli originali e gli asset strutturali restano preservati.

Il sistema non introduce ancora streaming dell'intera casa né occultamento
tra stanze. Le descrizioni del 1 ottobre sulla fontana senza LOD sono storiche:
gli effetti conservano il proprio controller, mentre la scultura ora usa i tier.
Script, hash e confronto visivo: [art/world-lod](art/world-lod/README.md).

### Verifica dell'integrazione

I 34 nuovi test di asset, zone e caricamento progressivo sono superati. La suite
completa registra **160/168 superati**, con gli stessi otto fallimenti della
baseline: `arrival`, `scale`, un caso `collision` e un caso `towerFloors` usano
aspettative/helper a 1,65 m mentre `EYE_HEIGHT` è 2 m; quattro casi `greybox`
usano conteggi, percorsi e quote della versione precedente del prototipo.
Questi casi restano visibili nella suite e non sono corretti da questo intervento.
La verifica mirata del controller dopo la gestione di `visibilitychange` è 14/14.
Build locale riuscita, verificata anche dal server preview; resta l'avviso Vite
sul chunk condiviso oltre 500 kB. Nessuna pubblicazione eseguita.

Il pannello `?review` include quattro viste sia della fontana sia dell'alveare e
diagnostica di livelli, tentativi, errori, risorse GPU e triangoli delle collisioni.
Le acquisizioni in gioco e i campioni sono conservati in
[art/world-lod/runtime](art/world-lod/runtime/README.md).

## Laghetto naturale e nuoto — 1 ottobre 2026

L'impronta ha il doppio dell'area del primo laghetto ellittico. Un unico contorno irregolare a 48 lati guida il foro nel terreno, il bacino, la superficie e le query di movimento. La riva in terra scende gradualmente nell'acqua; fondo e sponda condividono una mesh da 624 triangoli. Il fondo resta a circa metà dello spessore locale dell'asteroide, circa 65 m sotto il terreno. Gli alberi del giardino sono stati spostati nella fascia esterna per conservare dodici siti liberi.

Il nuoto usa controlli semplici: avanti segue anche l'inclinazione dello sguardo, Spazio/R sale, C/Ctrl scende; sul touch compaiono Sali/Scendi. Entrata e uscita avvengono lungo la sponda. Fondo e pareti sono vincolati dalle stesse query della geometria, senza consultare l'indice collisioni dell'intero mondo durante il nuoto. Da lontano la verifica si ferma all'ingombro rettangolare. Non ci sono consumo di ossigeno o simulazione fisica del corpo.

La superficie usa 240/528/1.104 triangoli secondo la qualità, un piccolo normal map condiviso 64² per le increspature e il modello ottico adattato da jeantimex/threejs-water (attribuzione in `src/assets/water-reference`). Il livello economico non usa render target; quelli vicini superiori impiegano solo due buffer half-float 64² a 15 Hz oppure 128² a 30 Hz, rispettivamente 64 e 256 KiB. I livelli si riducono in caso di carico sostenuto; distanza, frustum, pagina nascosta e movimento ridotto sospendono il lavoro. I buffer inutilizzati vengono liberati dopo dieci secondi.

La vista subacquea renderizza una scena contenente soltanto istanze del bacino e dell'acqua, con geometrie e materiali condivisi. Casa, vegetazione, cielo e corpo in prima persona non vengono disegnati; gli aggiornamenti degli effetti esterni sono sospesi. Oltre 1,2 m d'immersione la superficie usa solo onde analitiche; oltre 24 m viene omessa perché assorbita dalla foschia. Nessun passaggio di riflessione della scena o caustiche.

Verifica limitata ai controlli funzionali pertinenti e alla build locale: geometria, contorno/terreno, livelli e risorse GPU, ingresso/nuoto/fondo/uscita, alberi e percorso. In `?review`, “Laghetto · nuota” e “Laghetto · profondità” attivano i controlli direttamente in acqua.

## Fontana di cioccolato — 1 ottobre 2026

`chocolateAnimation.mjs` separa gli effetti dalla scultura e ne controlla il costo usando distanza dalla superficie dell'ingombro, dimensione proiettata e frustum della camera. Il controllo avviene dopo il movimento della camera. Fuori campo, oltre 60 m, sotto 28 pixel, durante il caricamento, con documento nascosto o movimento ridotto attivo: nessun aggiornamento delle particelle o del tempo del materiale. Soglie diverse al rientro (54 m / 36 pixel) evitano oscillazioni; la scultura rimane presente e usa il normale frustum culling. La visibilità parziale mantiene gli effetti; non viene calcolata l'occlusione dietro muri o altri oggetti.

| Dettaglio | Aggiornamenti massimi/s | Gocce | Onde | Draw effetti | Triangoli effetti |
| --- | ---: | ---: | ---: | ---: | ---: |
| L0 · fermo | 0 | 0 | 0 | 0 | 0 |
| L1 · solo riflesso | 12 | 0 | 0 | 0 | 0 |
| L2 · economico | 20 | 8 | 0 | 1 | 640 |
| L3 · bilanciato | 30 | 12 | 4 | 2 | 1.600 |
| L4 · completo | 30 | 16 | 8 | 2 | 2.560 |

I dettagli vicini entrano entro 22 m / sopra 110 pixel ed escono oltre 26 m / sotto 90 pixel. CPU fino a 4 thread o memoria dichiarata fino a 4 GB partono da L2; dispositivi touch/mobile e hardware sconosciuto da L3; desktop con almeno 8 thread da L4. Due secondi continuativi sotto 28 FPS abbassano un livello, fino a L2; otto secondi sopra 50 FPS ne recuperano uno, senza superare il limite del dispositivo. Si ignorano pause e periodi inattivi. Gli indizi hardware non sostituiscono una misura della GPU.

Rispetto alla versione precedente, gli effetti completi passano da 3.520 a 2.560 triangoli (−27%) e da un aggiornamento per frame a massimo 30 Hz. Le gocce accelerano, si allungano e scompaiono all'impatto; le onde seguono la cadenza degli impatti. Due mesh istanziate opache, ingombri conservativi fissi e buffer dinamici evitano raycast, ricalcolo degli ingombri e trasparenze. Il riflesso più tenue viene calcolato sui vertici; spariscono trigonometria per pixel e deformazione della geometria. Una lieve emissione sostituisce la luce puntuale dedicata, eliminando il suo contributo al costo di illuminazione del resto della scena.

Questi conteggi riguardano gli effetti aggiunti: il GLB della scultura rimane a 207.706 triangoli e non riceve un LOD geometrico. Non sono misure del tempo GPU o degli FPS dell'intero mondo.

Verifica: 7 test dedicati superati (cadenza a 60/120/144 Hz, sospensione/rientro, isteresi, scale e camera parentata, adattamento al carico, conteggi e ingombri delle istanze). Build locale generata e controllata nel browser a 1280×720 e 390×844, senza errori JavaScript o shader. Il contatore resta a zero durante il caricamento, fuori campo e a 90 m; riprende nella vista vicina. La vista a 42 m usa L1. La viewport verticale verifica l'inquadratura, non emula l'hardware di un telefono. Suite completa: 96/104 superati; gli 8 fallimenti riguardano arrivo, collisioni, greybox, scala e torrette, nei moduli estranei a questo intervento. Il pannello locale `?review` include quattro viste della fontana e un contatore di aggiornamenti per verificare vicino, media distanza, lontano e fuori campo.

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
4. Verificare la scala: l'ambiente è ingrandito di 5, l'altezza degli occhi viene da `EYE_HEIGHT` (attualmente 2 m). Le dimensioni reali dei nuovi piccoli oggetti vanno divise per `WORLD_SCALE`.
5. Distinguere risorse richieste e dettaglio opzionale: attendere tutte le prime prima del preriscaldamento iniziale. I tier opzionali usano un manager dedicato e vengono preparati prima della comparsa. Seguire [WORLD_CONTENT.md](WORLD_CONTENT.md) per registrazione, collisioni e ownership.

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
