# Basi rosse dei bengala

Nel [filmato](atterraggio.mp4) cinque getti salgono dritti lungo gli
assi del ventaglio. La base e le scintille attorno conservano il rosso
dall'accensione allo spegnimento. Più in alto il getto diventa bianco
e oro. Le scintille vicino alla punta si aprono meno, lasciando
visibile la direzione del getto.

Il fumo riceve una luce direzionale dopo la rimozione della stella e
della sua scia. Le braci dei bengala cadono fino alla dissolvenza del
fumo. Il filmato è registrato con la traccia 03.112.

Le verifiche in Edge coprono la [vista orizzontale](desktop/report.json),
la [vista verticale](verticale/report.json) e il [movimento ridotto](ridotto/report.json).
Il [confronto GPU](tempi.json) misura la v06 e la v07 a 960 × 580.

Con la build e la preview di [BUILD_LOCAL.md](../../../BUILD_LOCAL.md) attive,
eseguire `node casa3d/art/arrivo-basi-rosse-v07/check-browser.cjs desktop verticale ridotto`
e `node casa3d/art/arrivo-basi-rosse-v07/measure-flight.cjs` con Edge e Playwright.
Il filmato usa il [registratore del volo](../arrivo-vortice-v02/record.cjs).
