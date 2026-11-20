# Cinque bengala a ventaglio

Nel [filmato](atterraggio.mp4) il getto centrale sale verticale. A destra
e a sinistra i due getti interni arrivano alla stessa altezza. I due esterni
si aprono di più e rimangono più bassi. Il nucleo dei getti è circa il 18%
più largo rispetto alla versione v04. I 1.920 punti incandescenti sono
leggermente più grandi e tre quarti partono vicino alla base.

Le verifiche in Edge coprono il volo in [orizzontale](desktop/report.json),
in [verticale](verticale/report.json) e con [movimento ridotto](ridotto/report.json).
I rapporti includono le coordinate proiettate delle punte e il rilascio
delle risorse. Il test automatico controlla anche il formato ultrawide.
Due voli per inquadratura hanno rilasciato tutte le 19 risorse tracciate.
Con movimento ridotto il volo ha allocato zero risorse per gli effetti.
Nel [confronto GPU](tempi.json) sulla UHD 630 a 960 × 580 la mediana passa
da 24,02 ms a 23,73 ms e il 95º percentile da 34,55 a 35,18 ms.
Resta da verificare su telefono fisico.

Con la build e la preview di [BUILD_LOCAL.md](../../../BUILD_LOCAL.md) attive,
eseguire `node casa3d/art/arrivo-ventaglio-v05/check-browser.cjs desktop verticale ridotto`
e `node casa3d/art/arrivo-ventaglio-v05/measure-flight.cjs` con Edge e Playwright.
Il filmato è acquisito con il [registratore del volo](../arrivo-vortice-v02/record.cjs)
a 864 × 520 con la traccia 03.112.
