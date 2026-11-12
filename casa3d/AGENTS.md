# Lavorare su Casa3D

## Prima di modificare

Leggere nell'ordine `README.md`, `docs/PROJECT_STATE.md`, `PERFORMANCE.md`,
`WORLD_CONTENT.md` e le ultime voci di `docs/DIARIO_DI_BORDO.md`.
Per un asset consultare anche `docs/ASSET_REGISTER.md` e il suo pacchetto `art/`.
Lo storico e i vecchi README di produzione non sostituiscono il codice attuale.

## Contratto da preservare

- Aggiornare i cataloghi in `src/world/`: zone, collocazioni con ID stabili e
  asset riutilizzabili sono responsabilità distinte.
- Riutilizzare costanti e layout. `WORLD_SCALE = 5`, `EYE_HEIGHT = 2 m`;
  un asset in metri sotto il giardino normalmente usa `1 / WORLD_SCALE`.
- Separare geometria visiva e fisica. Catturare collisioni e riferimenti alle
  interazioni prima di instancing/batching; proteggere rami mobili e controllati.
- Rispettare `streamingBoundary`, `worldZone` e `staticDetail`; ottimizzare
  dentro le singole radici senza fondere contenuti o tier indipendenti.
- Conservare bounds completi, inclusi movimento e tutte le istanze, prima di
  ridurre `count`. Aggiornare il registro dopo variazioni degli ingombri.
- Preservare far residente, caricamento opzionale con fallback, soglie/isteresi,
  limiti di concorrenza e rilascio delle risorse descritti in `PERFORMANCE.md`.
  Nessun tier deve spostare l'oggetto o cambiare collisioni; i tier opzionali
  non devono bloccare l'avvio, mentre il far è richiesto.
- Conservare sospensione degli effetti, profili della giostra e scena subacquea
  dedicata. Non introdurre passaggi pesanti, luci, timer o richieste per frame
  senza strategia di costo e confronto registrato.
- Non occultare interi piani della casa: finestre e aperture richiedono una
  soluzione esplicita. Lo streaming completo di stanze/minigiochi non esiste ancora.
- Mantenere la sala informazioni indipendente dal bootstrap e dagli asset del mondo.

## Quando si conclude un intervento

- Per asset, rimozioni, attrazioni, ottimizzazioni e refactoring compilare una
  voce nel diario **nello stesso intervento**. Conservare originali, script,
  hash, metadati e confronti in `art/`; aggiornare il registro degli asset.
- Se cambia il comportamento o il contratto aggiornare anche la guida pertinente
  e `docs/PROJECT_STATE.md`. Evitare copie di soglie operative in più documenti.
- Eseguire i controlli pertinenti e, per rendering/caricamento/interazioni,
  la verifica in `?review`. Riportare comando, esito, nuovi fallimenti e prove
  mancanti. L'esito corrente è registrato in `docs/PROJECT_STATE.md`:
  non escluderli o indebolire i test per far apparire verde la suite.
- Distinguere conteggi, test funzionali, render CPU e misure GPU. Non dichiarare
  fluidità sui dispositivi reali da una viewport mobile o da un GLB più leggero.
- Modificare `index.template.html` e sorgenti. Seguire `../BUILD_LOCAL.md` per
  build e output; non eseguire `npm ci` a ogni build. Il greybox è dismesso:
  non reintrodurlo per soddisfare note o test storici.
- Le modifiche solo documentali richiedono controllo di riferimenti e coerenza,
  senza rigenerare il gioco se il runtime non cambia.
