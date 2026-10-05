# Verifica in gioco — 4–5 ottobre 2026

Browser integrato, scena principale da `index.template.html?review`, viewport
1280 × 720 e 390 × 844. `samples.json` conserva i dati esposti dal pannello locale.
È una verifica funzionale, non un benchmark di FPS, tempo GPU o hardware mobile.
La build finale è stata generata con `deploy.ps1` senza `-Push`, poi controllata
anche da `http://127.0.0.1:4186/casa3d/?review`: avvio completato con entrambi
gli asset far e nessuna richiesta opzionale prima di ATTERRA; nella vista vicina
la fontana carica medium e near senza modificare le collisioni.

## Risultati osservati

- Prima di ATTERRA entrambi gli asset sono far; medium e near hanno zero tentativi.
- Fontana: near a circa 495 pixel, medium a 130, far a 61. Dopo il periodo di
  inattività i tier opzionali tornano idle e le geometrie del renderer scendono
  da 537 a 525. Tornando vicino si ricaricano entrambi i tier.
- Alveare: near a circa 551 pixel, medium a 138, far a 41. Il primo campione far
  precede lo scaricamento. Dopo 29,5 secondi fuori campo entrambi gli asset hanno
  solo far residente: geometrie da 565 a 525 e texture da 52 a 40. Un nuovo
  avvicinamento ricarica il dettaglio dell'alveare.
- Collisioni: 703.398 triangoli in tutti i campioni, indipendentemente dal livello
  e dai contenuti nascosti. I conteggi di memoria sono dell'intero renderer e
  possono includere altre risorse inizializzate durante la visita.
- Fuori campo il registro esclude fino a sette radici decorative; salotto,
  finestre e vano ascensore restano presenti nelle viste di controllo.
- Sott'acqua entrambi i controller tornano far senza domanda di nuovo dettaglio.
- La vista verticale conserva l'allineamento dell'alveare e seleziona near.
- Nessun nuovo errore JavaScript o shader durante questa sequenza. Il log
  conservava due errori di connessione/import Vite del server precedentemente
  interrotto, risolti prima della sequenza con server attivo e ricaricamento.

Il cambio di livello non ha mostrato spostamenti, parti staccate o materiali
mancanti nelle viste ispezionate. Le acquisizioni sono:

- [Fontana vicina](fountain-near.png) e [lontana](fountain-far.png).
- [Alveare vicino](beehive-near.png), [lontano](beehive-far.png) e
  [viewport verticale](beehive-portrait.png).
- [Salotto](living-room.png), [vano ascensore](elevator-cabin.png) e
  [immersione profonda](pond-underwater.png).
- [Fontana nella build finale](production-fountain-near.png).

Non sono test di attraversamento di ogni passaggio, del ciclo completo
dell'ascensore o di occultamento dietro pareti. Quest'ultimo non è implementato.
Il caso pagina nascosta è gestito con `visibilitychange` per fermare subito
la domanda, anche se il RAF è sospeso; i test del controller coprono richieste
disabilitate, accodate e risposte tardive. Non è stato simulato un cambio scheda
del browser né un guasto di rete durante questa sequenza; i fallback di errore
sono verificati dai test automatici.
