# Pavimenti e torrette — 29 settembre 2026

Correzioni applicate al caricamento della casa v10 nel gioco, prima di acquisire
le collisioni e raggruppare le geometrie. Il GLB e i file Blender restano la fonte
autoriale precedente; le trasformazioni sono riproducibili nei moduli runtime.

- I blocchi marroni davanti alla casa erano gli angoli della cantina
  rettangolare, visibili oltre la facciata curva. Il suo involucro chiuso segue
  ora il contorno misurato del solaio del salotto, con pareti rivolte verso
  l'interno. Quote, finiture e apertura dell'ascensore sono conservate.
- Il tremolio delle torrette proveniva dai tappi delle basi sovrapposti ai
  pavimenti. I tappi sono diventati anelli esterni, con una sola superficie
  calpestabile interna. I piani inferiori restano solidi.
- I due piani superiori di ciascuna torretta hanno un foro centrale di 1,60 m
  di diametro. Un palo di ottone satinato di 7 cm attraversa i fori, fissato alla
  base e alla copertura. La logica per usarlo sarà aggiunta separatamente.
- Il parquet usa listelli da 18 × 90 cm simulati in due mappe condivise, con
  scala coerente anche nella torretta più piccola. Riguarda 34 superfici di
  pavimenti, soglie, veranda, voliera, balcone e passaggi. Non aggiunge triangoli
  e non riveste soffitti, arredi, cantina o osservatorio.
- Le tre soglie dell'ascensore dei piani rifiniti sono separate di 2 mm dalle
  superfici coincidenti sottostanti.

`openings.json` descrive i quattro passaggi. I controlli sono in
`test/basementFootprint.test.mjs`, `test/towerFloors.test.mjs` e
`test/floorFinishes.test.mjs`; verificano anche il passaggio della capsula reale
del personaggio accanto ai pali e la conservazione delle aperture dell'ascensore.

Per la visita locale usare `?review`: i punti “Torre destra · foro” e
“Torre sinistra · foro” portano ai piani intermedi. La visita ordinaria mantiene
gli stessi controlli del gioco.

Osservazione riutilizzabile: gli involucri generati a partire da un rettangolo
di ingombro possono emergere da una facciata curva; una rimozione visiva senza
ricostruire il volume lascerebbe la cantina aperta. Qui il perimetro deriva dal
contorno reale del solaio. Questa nota è un'osservazione del lavoro, non una
nuova regola di progetto approvata.
