# Test allineati al personaggio — 20 ottobre 2026

Voce **TEST-001** del [diario](../../docs/DIARIO_DI_BORDO.md).

- [Riepilogo e confronto degli hash](verification.json).
- [Log completo della suite](test-suite.txt): **237/237**, zero falliti,
  saltati o cancellati. Il caso aggiuntivo copre le collisioni della casa v10.

I quattro fallimenti precedenti dipendevano da aspettative/fixture rimaste a
1,65 m mentre il vero personaggio usa già 2 m. Il solver generico conserva
il proprio default; i test del personaggio ora passano le sue dimensioni
esplicite, come fa il runtime. Le asserzioni restano rigorose: pavimenti,
pareti, porte, bordi, fori e pali; l'atterraggio delle torri controlla anche
la quota finale. Non sono state allargate le tolleranze o escluse verifiche.

La comparazione prima/dopo copre tutti i 153 file in `src/` e l'HTML pubblicabile:
hash identici. Visuale, camera, altezza, movimento, asset e fisica del gioco
restano invariati. Il cambiamento riguarda test e documentazione, senza nuova
build o prova browser. Le altre QA aperte nello
[stato corrente](../../docs/PROJECT_STATE.md) restano da completare.
