# Tempietto della lince — integrazione in Casa3D

Il modello selezionato dall'utente è conservato in `Tempio_della_Lince.blend`.
Il file originale esterno non viene modificato. `integration-review.json`
registra la richiesta di inserimento, distinta dalla precedente revisione
del solo modello conservata in `source-evidence/`.

Il tempietto è collocato nel giardino a `(85, 0, -90)` metri mondo, ingresso
rivolto alla casa. Mantiene il fotogramma 1, la botola chiusa e le profezie
disattivate. Nessun accesso ai sotterranei o nuova animazione è attivato.

## Esportazione riproducibile

Con Blender 5.2 eseguire da questa cartella:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup .\Tempio_della_Lince.blend --python .\export_temple.py
```

Lo script valuta modificatori e curve, fissa le coordinate originali dei
materiali, prepara atlanti colore e normali e produce i tre GLB in
`../../src/assets/models/`. Studio, cutter e profezie future sono esclusi.
Nessuna luce di studio viene aggiunta al gioco.

| Livello | Triangoli | Texture colore/normali |
| --- | ---: | ---: |
| near | 324.328 | 2048² |
| medium | 87.568 (27%) | 1024² |
| far | 30.808 (9,5%) | 512² |
| collisioni | 11.296 | nessuna |

`manifest.json` registra dimensioni, byte e SHA-256 di ogni file. I tier
conservano origine, UV e sei materiali. I bounds originali sono circa
`[-5.4, -1.28, -5.4] → [5.4, 10.32, 5.4]`: la quota minima comprende il pozzo
sotto il pavimento e non deve diventare il riferimento per l'appoggio.

Il GLB fisico mantiene le vere aperture della cella, tre livelli di gradini,
colonne, basamento dell'oracolo e lastra della botola. I collider sono residenti
e indipendenti dai GLB visivi. La scala `1 / WORLD_SCALE` viene applicata una
sola volta; il registro conserva i bounds originali durante tutti i cambi LOD.

## Verifiche

`authoring-review/` contiene confronti del sorgente e dei tier con le medesime
camere e luci. `render_review.py` li rigenera. Le viste interne verificano
anche statua e aperture. Le immagini di Blender non sostituiscono la prova
con la camera del personaggio nel gioco.

I test in `../../test/lynxTemple.test.mjs` controllano file reali, hash,
materiali, coordinate, gradini, botola, collisioni e attraversamento del
portale con il controller del giocatore. Il pannello locale `?review` include
le viste **Tempietto · vicino/media distanza/lontano/interno/ingresso/fuori campo**.
I risultati browser e la conclusione delle verifiche sono registrati nel
rapporto finale dell'integrazione. Nessun dato di questo pacchetto costituisce
una misura delle prestazioni su telefoni reali o un'approvazione umana della
pubblicazione.
