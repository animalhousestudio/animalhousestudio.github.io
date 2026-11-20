# Scimmia dei montanti · v03

Il [riferimento](riferimento.jpg) avvolge la parte anteriore di un muso con
orbite, sopracciglia, guance, naso e mandibola modellati. Le orecchie hanno
una conca interna. Sul corpo i colori ai vertici disegnano il dorso argentato
e la pettorina avorio. La trama del pelo occupa il margine superiore dello
stesso atlante del volto. [Ritratto](ritratto.png) · [Camminata animata in studio](camminata.webp).

Il [sorgente Blender](Scimmia_NPC_v03.blend) contiene le quattro azioni in
sequenza sulla timeline. In gioco il percorso controlla la traslazione.
Il passo avanza a 1,34 m/s con appoggio alternato delle nocche e una rotazione
del capo che compensa lo spostamento del peso. Il salto passa da compressione
a spinta, raccolta delle gambe, allungo di un braccio e assorbimento della
presa. Durante la pausa il personaggio si abbassa, guarda di lato e ritorna
alla stessa posa per il lancio successivo. [Salto in studio](slancio.png).

## Confronto

| Costo della scimmia | v02 | v03 |
| --- | ---: | ---: |
| Byte del GLB facoltativo | 569.620 | 730.424 |
| Triangoli | 13.822 | 13.668 |
| Draw call per il corpo completo | 1 | 1 |
| Materiali / ossa | 1 / 21 | 1 / 21 |
| Texture | 0 | 1 JPEG 768 × 1024 incorporato |

Il [manifest](runtime-export.json) lega riferimento, sorgente ed export con
SHA-256. L'aumento di 160.804 byte comprende atlante, UV e animazioni.
La presa vicina valuta la posa a un massimo di 12 Hz entro 12 m, durante le
soste da due a sette secondi. I quattro arti mantengono l'appoggio.

Nella build locale, Edge con SwiftShader a 960 × 580 ha caricato il GLB
e mostrato camminata, presa e volo. Sul primo palo il confronto a camera
ferma misura il contributo della scimmia disegnando la stessa scena con
l'NPC nascosto e visibile. Nella v02 i triangoli passano da 408.603 a 422.425,
nella v03 da 405.965 a 419.633. Le chiamate aumentano di una in entrambe le
versioni. Entrambi i rapporti registrano zero errori browser. Per il confronto
prestazionale sui dispositivi fisici restano da misurare tempi CPU e GPU.
[Rapporto v02](prima/browser-report.json) · [Rapporto v03](dopo/browser-report.json).

| In gioco | v02 | v03 |
| --- | --- | --- |
| Avvicinamento | [Camminata](prima/walk.png) | [Camminata](dopo/walk.png) |
| Primo montante | [Presa](prima/grip.png) | [Presa](dopo/grip.png) |
| Volo tra i montanti | [Salto](prima/leap.png) | [Salto](dopo/leap.png) |

Gli [ingombri campionati](ingombri.json) comprendono tutti i vertici del GLB
sulle quattro clip a 60 Hz. La massima distanza dal centro di culling è
0,971 m, entro il raggio disponibile di 1,50 m.

## Riproduzione

Il [generatore](build.py) assembla [geometria e atlante](model.py) usando
le primitive, il rig e il risolutore degli arti del pacchetto v01. Dalla radice
del repository, con Blender 5.2 e le dipendenze di Casa3D installate, eseguire

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup --python-exit-code 1 --python casa3d/art/scimmia-npc-v03/build.py -- --stills
node casa3d/art/scimmia-npc-v03/measure.mjs
node --test casa3d/test/scimmiaNpc.test.mjs
```

I test verificano le prese su entrambe le facce dei 25 pali in cinque momenti
della pausa, la sequenza di andata e ritorno e le distanze da pali, traverse,
massi e cabina durante i salti. Per seguire l'NPC nella build avviare
l'[anteprima locale](../../../BUILD_LOCAL.md) e aprire `?review&view=monkey`.
