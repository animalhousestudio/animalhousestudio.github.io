# Accensione e spegnimento dei bengala

Nel [filmato](atterraggio.mp4) le fiammate rosse compaiono al bordo inferiore
appena finisce la transizione dalla schermata iniziale. Si accende prima il
getto centrale, seguito dalle coppie specchiate. Il fronte dei getti sale
fino alla lunghezza della v05 mentre il rosso diventa bianco e oro.

Prima dei primi fuochi dietro la casa, i getti perdono pressione e scoppiettano.
Le scintille già in aria continuano a cadere e a raffreddarsi. A 6,2 secondi
dall'inizio della discesa il fumo e i bengala liberano insieme le loro risorse.
Il filmato è acquisito a 864 × 520 con la traccia 03.112.

Le verifiche in Edge coprono la [vista orizzontale](desktop/report.json),
la [vista verticale](verticale/report.json) e il [movimento ridotto](ridotto/report.json).
Entrambi i voli in ogni formato rilasciano 19 risorse su 19. Il movimento
ridotto non alloca risorse per gli effetti. Nel [confronto GPU](tempi.json)
sulla UHD 630 a 960 × 580 la mediana passa da 24,66 ms a 24,07 ms, con
33,6 ms tra fotogrammi in entrambe le versioni. Resta la prova su telefono fisico.

Con la build e la preview di [BUILD_LOCAL.md](../../../BUILD_LOCAL.md) attive,
eseguire `node casa3d/art/arrivo-accensione-v06/check-browser.cjs desktop verticale ridotto`
e `node casa3d/art/arrivo-accensione-v06/measure-flight.cjs` con Edge e Playwright.
Per acquisire il filmato si usa il [registratore del volo](../arrivo-vortice-v02/record.cjs).
