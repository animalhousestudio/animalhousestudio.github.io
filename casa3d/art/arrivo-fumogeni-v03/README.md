# Discesa verso l'asteroide

Il [filmato](atterraggio.mp4) mostra i banchi blu, turchesi, magenta e gialli
e i cinque bengala che si esauriscono prima di toccare terra. Nel volume di
arrivo la luce aumenta l'intensità del pigmento. Il cielo, la casa, i vetri,
l'illuminazione ambientale e la sala informazioni hanno la resa cromatica
precedente alla versione illustrata. La musica parte da 03.112.

Il 20 novembre 2026 la build locale ha superato 271 test. In Edge, due voli
consecutivi hanno rilasciato tutte le 19 risorse grafiche tracciate sia in
[orizzontale](desktop/report.json) sia in [verticale](verticale/report.json).
Con [movimento ridotto](ridotto/report.json) la camera ha compiuto la discesa
con zero risorse allocate per gli effetti. Il [confronto sulla UHD 630](tempi.json)
a 960 × 580 registra mediane GPU di 24,45 ms per la v02 e 25,28 ms per la v03.
Il tempo mediano tra fotogrammi è 33,3 ms in entrambe. Resta la prova su telefono fisico.

Per ripetere il confronto usare la preview descritta in [BUILD_LOCAL.md](../../../BUILD_LOCAL.md)
ed eseguire `node casa3d/art/arrivo-fumogeni-v03/check-browser.cjs desktop verticale ridotto`
e `node casa3d/art/arrivo-fumogeni-v03/measure-flight.cjs` con Edge e Playwright.
