# Bengala durante la discesa

Il [filmato](atterraggio.mp4) mostra i cinque bengala in tempo reale,
con la musica 03.112. Il fumo colorato resta volumetrico e i filamenti
geometrici del vortice sono stati rimossi. Dalla foto di riferimento sono
ripresi il nucleo bianco e oro, l'alone e le scintille che si staccano dal
getto. Tre quarti delle 1.920 scintille partono nella zona della base.

Le prove in Edge coprono due voli in [orizzontale](desktop/report.json),
due in [verticale](verticale/report.json) e il [movimento ridotto](ridotto/report.json).
Il browser ha registrato il rilascio di 19 risorse su 19 per volo. Con
movimento ridotto le risorse allocate per l'effetto sono zero. Nel
[confronto GPU](tempi.json) sulla UHD 630, a 960 × 580, la mediana passa
da 25,37 ms a 24,43 ms. Il tempo mediano tra fotogrammi resta intorno
a 33,5 ms. Resta la prova su telefono fisico.

Con la build e la preview di [BUILD_LOCAL.md](../../../BUILD_LOCAL.md) attive,
eseguire `node casa3d/art/arrivo-bengala-v04/check-browser.cjs desktop verticale ridotto`
e `node casa3d/art/arrivo-bengala-v04/measure-flight.cjs` con Edge e Playwright.
Il filmato usa [il registratore del volo](../arrivo-vortice-v02/record.cjs)
a 864 × 520 e 30 fotogrammi al secondo, con il brano originale montato sul video.
