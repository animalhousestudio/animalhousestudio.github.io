# Lavorare su Casa3D

Prima di aggiungere attrazioni, stanze o decorazioni leggere `WORLD_CONTENT.md`.
`README.md` è l'indice; `PERFORMANCE.md` distingue lo stato corrente dalle misure storiche.

- Aggiornare i cataloghi in `src/world/`: una zona organizza più contenuti;
  ogni collocazione ha un ID stabile e un asset può essere riutilizzato.
- Conservare trasformazioni e unità: l'ambiente usa `WORLD_SCALE`, il personaggio
  e le distanze del registro usano metri mondo. Riutilizzare le costanti dei layout.
- Separare geometria visiva e supporto fisico. Il cambio di LOD non deve
  spostare l'oggetto, alterare collisioni o bloccare l'avvio per un dettaglio opzionale.
- Rispettare `streamingBoundary` e `worldZone`: catturare le collisioni prima
  del batching, ottimizzare dentro le singole radici e preservarne l'identità.
- Non nascondere automaticamente interi piani della casa: finestre e aperture
  richiedono una soluzione esplicita prima dell'occultamento per stanza.
- Per nuovi tier mantenere originali, script riproducibile, hash, metadati e
  riscontro visivo in `art/`. Conservare bounds completi prima di ridurre istanze.
- Eseguire i test pertinenti e verificare in `?review` i cambi che incidono su
  caricamento o rendering. Riportare separatamente eventuali fallimenti preesistenti.
- Modificare `index.template.html` e i sorgenti, non il JavaScript generato.
  Non eseguire `npm ci` a ogni build; seguire `../BUILD_LOCAL.md`.
- Aggiornare la guida dei contenuti quando cambia il contratto di integrazione.
