# Colonia di gatti sull’asteroide

Adattamento di [**Toon Cat FREE**](https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386)
di [Omabuarts Studio](https://sketchfab.com/omabuarts), distribuito in
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Casa3D riusa mesh, scheletro, texture e camminata. Aggiunge corporature,
mantelli, appoggi a terra e animazioni di riposo e pulizia.

| Dato | Sorgente attiva |
| --- | --- |
| GLB | [toon_cat_free.glb](../threejs-cat-master/assets/models/toon_cat_free.glb) |
| Licenza nel pacchetto ricevuto | [license.txt](../threejs-cat-master/assets/models/toon_cat/license.txt) |
| SHA-256 | `f76291f5d37d60fc58e8006a1111a5960958545fc4d9592988682ad3a9aaef81` |
| Ingombro | 205.288 byte, 1.810 vertici, 2.636 triangoli, 36 ossa |
| Materiale | 1 materiale, 1 texture 64×64 |
| Generazione runtime | [Percorsi](../../src/rooms/catColonyLayout.mjs), [pose e mantelli](../../src/rooms/catColonyModel.mjs), [caricamento e culling](../../src/rooms/catColony.mjs) |

## Verifica locale

Avviare il server sorgenti come in [BUILD_LOCAL.md](../../../BUILD_LOCAL.md).
Le viste sono `?review&view=cats` per l'arrivo, `cats-east`, `cats-garden`,
`cats-shore`, `cats-temple`, `cats-orchard`, `cats-southwest`,
`cats-southeast` e `cats-north` per le altre radure.
`cats-groom` e `cats-rest` inquadrano le due pose.

```powershell
node --test casa3d/test/catColony.test.mjs
node casa3d/art/cat-colony-v01/verify-browser.mjs casa3d/art/cat-colony-v01/redistribution 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
```

### Distribuzione attuale

Il [rapporto Edge con SwiftShader](redistribution/browser-report.json)
registra un gatto dopo l’atterraggio e 24 in nove radure. Nella vista di
arrivo un gatto e la sua ombra aggiungono 2 draw e 2.638 triangoli.
Restano da misurare i tempi su dispositivi fisici.

[Arrivo](redistribution/arrival.png) · [Sud-ovest](redistribution/southwest.png) ·
[Sud-est](redistribution/southeast.png) · [Nord](redistribution/north.png) ·
[Pulizia](redistribution/groom.png) · [Riposo](redistribution/rest.png)

### Prima distribuzione

Il [rapporto Edge con SwiftShader](browser-report.json) della prima versione
registra quattro gatti in ciascuna delle sei zone. Nella vista di arrivo il
delta per quattro gatti era di 5 draw e 10.552 triangoli.

[Arrivo iniziale](arrival.png) · [Alveare](east.png) · [Giardino](garden.png) ·
[Sponde](shore.png) · [Tempietto](temple.png) · [Retro della casa](orchard.png) ·
[Pulizia](groom.png) · [Riposo](rest.png)
