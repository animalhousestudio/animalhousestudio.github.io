# Cesto di benvenuto e raccolta dei leccalecca

Creato in Blender su richiesta dell'utente, il 20 ottobre 2026. Il cesto in
rattan intrecciato contiene 24 leccalecca Animal House con inclinazioni e
altezze variate. Geometria e UV dei dolci derivano dalle funzioni già usate
in `../player-bear-v02/props.py`; il logo originale è incorporato senza modifiche.
Gli stecchi sono allungati per appoggiarsi all'interno del cesto profondo.

## Sorgenti ed esportazione

- `lollipop-basket.blend`: sorgente modificabile con misure reali e studio separato.
- `build_basket.py`: costruzione deterministica, export e render di confronto.
- `manifest.json`: hash SHA-256, geometria, dimensioni, materiali e disposizione.
- `renders/front.png`, `renders/oblique.png`: viste del sorgente.
- `renders/export-oblique.png`: GLB reimportato con la stessa camera e le stesse luci.

Eseguire dalla radice del repository con Blender 5.2:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python .\casa3d\art\lollipop-basket-v01\build_basket.py
```

Il GLB `../../src/assets/models/props/lollipop-basket.glb` contiene 32.407
triangoli, sei materiali PBR e una texture logo incorporata; pesa 1.077.088 byte.
Dimensioni massime, manici compresi: circa 1,246 × 1,123 × 1,128 metri.
Origine al centro del terreno, asse glTF +Y verticale e fronte +Z. Lo studio
rimane fuori dal GLB. Il modello viene caricato all'avvio senza ulteriori tier.

## Contratto nel gioco

La radice `LollipopBasket` appartiene a `outdoor:arrival` e rimane residente.
Sotto il giardino usa scala 0,2: WORLD_SCALE restituisce le misure reali.
Il cesto occupa la vecchia posizione dell'alveare, `(-4, 0, 206)` metri mondo;
l'alveare arretra di quattro metri verso la casa, mantenendo il jetpack fermo.
Una geometria fisica separata protegge l'ingombro del cesto; i dettagli visivi
non fanno parte delle collisioni.

Il personaggio arriva senza leccalecca. Entro tre metri si raccoglie con E,
clic/tocco sul cesto o pulsante contestuale. Il leccalecca originale completo
appare nella mano sinistra nella posa esistente. La tazza e la posizione del
giocatore non cambiano. Il cesto rimane pieno, la raccolta non si ripete e lo
stato dura per la sessione corrente. I gesti di trascinamento e multitouch sulla
scena non equivalgono a una raccolta; menu e atterraggio la bloccano.

## Verifiche

`../../test/lollipopPickup.test.mjs` usa anche il vero GLB del personaggio per
controllare visibilità di tutte le parti, caricamento asincrono, posa, raccolta
unica, distanza, occlusione con porte mobili e distinzione tocco/trascinamento.
`../../test/lollipopBasket.test.mjs` verifica hash, logo incorporato, misure,
budget geometrico, nuovo layout, collisioni e protezione dal batching.

Le prove browser sono disponibili con `?review` attraverso **Cesto · raccolta**
e **Leccalecca · in mano**. Il rapporto finale distingue verifiche automatiche,
prove browser e limiti; i render di Blender non sono prove del runtime mobile.
