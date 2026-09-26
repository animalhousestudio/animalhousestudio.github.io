# Casa v08 — aperture, collisioni e raccordi

Progetto modificabile: `mansion-v08-refined.blend`. Il gioco carica per impostazione predefinita `src/assets/models/mansion-v08.glb`. La v07 è conservata nella cartella precedente.

- Ricostruite le quaranta tavole della facciata conservando la curvatura misurata; sei finestre hanno aperture passanti, una sola superficie di vetro, imbotti continui e davanzali.
- Rimossi 204 componenti obsoleti: generazioni sovrapposte di finestre, pannelli finti, vecchi vasi e piante a cono. Conservati campetto, voliera, vegetazione rifinita e altri asset.
- Lasciato un margine nascosto fra pareti e stipiti laterali per eliminare le facce coincidenti; completata la cornice interna del portone e la decorazione del retro delle ante. Le parti interrate dei tettucci sono state tagliate al limite interno della parete.
- Vano e pianerottolo dell'ascensore estesi alla quota reale della cantina, -6,6. Il soffitto runtime ha un'apertura quadrata corrispondente; cabina a filo piano, ingresso libero e cancelli mobili ai piani non serviti. Soglia della torre est raccordata al pavimento.
- Cinque gatti con tre pose condivise e cinque mantelli: seduto, accovacciato, addormentato. Mantengono nomi e collocazione; materiali degli occhi, muso e orecchie condivisi.
- Collisioni costruite dopo il caricamento degli asset, prima che il rendering raggruppi gli oggetti. Una capsula controlla tutto il corpo, anche in volo; griglia spaziale e piccoli passi limitano il costo e gli attraversamenti nei frame lenti. Porte, cabina e cancelli aggiornano il loro ingombro; le rocce istanziate sono incluse.
- Le due rocce riutilizzabili sono adagiate sulla base larga, inclinate e affondate del 18–38% in base alla posa e al terreno. Il loro ingombro completo conserva liberi campetto e percorsi.

| Risorsa | v07 | v08 |
| --- | ---: | ---: |
| Triangoli valutati | 370.385 | 353.406 |
| Geometrie distinte nel sorgente | 865 | 696 |
| GLB | 10.626.512 byte | 9.643.468 byte |

## Modifiche future

Aprire il progetto v08 per modifiche manuali; `export_house.py` esporta mantenendo geometrie condivise e modificatori editabili. Non rinominare portone, pavimenti, `ACCESS_`, parti dell'ascensore o gatti: il gioco riconosce questi oggetti per nome.

Per ricreare la revisione dalla v07: eseguire `repair_architecture.py`, poi caricare `refine_cats.py` e chiamare `refine_cats()`, infine eseguire `finalize_source.py` e `export_house.py`. `repair_architecture.py` richiede deliberatamente il sorgente v07 e non va eseguito sulla revisione corrente.

42 test mirati superati prima della build: muri e porte reali, collisioni di asset bassi e istanze, movimento in volo, accessi, ascensore, sei finestre passanti, rocce/campetto e condivisione delle geometrie. Controllo topologico su 110 oggetti riparati senza facce collassate o spigoli con più di due facce. Le anteprime PNG sono render del modello con i vetri nascosti per leggere le aperture, non screenshot del gioco.

Build e server: istruzioni in `BUILD_LOCAL.md` alla radice. La prova finale in gioco resta all'utente, senza ulteriori verifiche automatiche dopo che il server è pronto.
