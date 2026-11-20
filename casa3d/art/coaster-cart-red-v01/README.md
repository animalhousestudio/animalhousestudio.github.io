# Carrelli rossi della giostra

La [foto fornita](riferimento.png) ha guidato il muso affusolato, la
carrozzeria rosso laccato e l'abitacolo aperto. Il gioco usa tre sedili
affiancati. Il centrale accoglie il personaggio con la barra e il punto
di vista della versione precedente. La scocca segue sezioni curve lungo
il carrello. I fari seguono la superficie, con prese d'aria, sedili
imbottiti e ruote su un telaio scuro. Il cartello e i suoi montanti sono
stati rimossi dalla pedana.

| Angolazione | Prima | Dopo |
| --- | --- | --- |
| Esterno | [Carrelli blu](prima-carrelli.jpg) | [Carrelli rossi](carrelli.jpg) |
| Dalla pedana | [Con cartello](prima-stazione.jpg) | [Pedana attuale](stazione.jpg) |
| In corsa | | [Posto centrale](a-bordo.jpg), [immersione](in-immersione.jpg) |

La [prova in Edge](report.json) ha aperto la conferma con E e con clic
sul muso. Dopo la conferma, l'occhio si è posizionato a quota 2,08 m
rispetto al carrello, sull'asse centrale. La prova ha raggiunto il tratto
subacqueo accelerando il contatore del giro e ha verificato la discesa
automatica sulla pedana. Le copie subacquee condividono le stesse
geometrie dei carrelli. I conteggi passano da 13.264 a 11.252 triangoli
per carrello e rimangono sette draw ciascuno. Resta la verifica su telefono fisico.

## Riprodurre

Usare la preview di [BUILD_LOCAL.md](../../../BUILD_LOCAL.md), quindi
eseguire `node casa3d/art/coaster-cart-red-v01/check-browser.cjs` con
Edge e Playwright. La base del confronto è l'asset
`index-CrDpK_MY.js`. La foto esterna usa una camera libera con le zampe
nascoste durante l'acquisizione. Per l'imbarco viene ripristinata la
vista del giocatore.

| Sorgente | SHA-256 |
| --- | --- |
| [Riferimento](riferimento.png) | `322b1c17db22b176377039e61c8438c45f995e2cd9a4580f500a0ecf41a8f2a9` |
| [Carrozzeria](../../src/rooms/coasterCart.mjs) | `7ccc4e57957f027c103eb064f6df3d6a5db155e8d78cba95ac0430e05928be61` |
| [Stazione](../../src/rooms/asteroidCoaster.mjs) | `9dc7dd85b0c810e997d01227d56415b529a029266adcff04a5a608aac106d785` |
