# Casa v11 — rifinitura strutturale

Scena modificabile: `mansion-v11-refined.blend`.
Copia della v10 iniziale, recuperata dal file versionato presente all'inizio del lavoro: `baseline-v10.blend`.

La revisione conserva disposizione degli ambienti, arredi, piante, gatti, materiali,
nomi degli oggetti e quote dei cinque piani. Nessun oggetto aggiunto o eliminato.

## Correzioni

- Saldati vertici coincidenti in due solai, nell'arco frontale e in quattro
  raccordi del ponte. Ripulita una trave della veranda dal residuo piatto prodotto
  da un precedente taglio contro la facciata. Le otto geometrie sono ora chiuse.
- Sollevata di 2 mm in scala di gioco la sola superficie superiore delle cinque
  soglie dell'ascensore, separandola dalle superfici coincidenti degli anelli e
  dei solai. Le fermate e le aperture restano alle quote precedenti.
- Abbassata di 2 mm in scala di gioco la superficie dell'anello perimetrale
  dell'osservatorio per eliminare la sovrapposizione con il pavimento interno.
- Raccordata l'apertura esistente del tetto alla parete dell'osservatorio: il
  tetto non penetra più all'interno. Vertici/facce di base e modificatori
  conservati, ingombro esterno invariato.
- Rimossi gli spigoli di lunghezza zero dei poli dei petali e di quattro
  sostegni delle pensiline. Le sei fioriere mantengono forme e istanze condivise.
- Corrette le normali invertite del piano di presentazione.

| Misura | Prima | Dopo |
| --- | ---: | ---: |
| Triangoli valutati nell'insieme destinato al gioco | 347.992 | 345.404 |
| Poligoni valutati nello stesso insieme | 168.391 | 168.388 |
| Oggetti totali nella scena | 1.877 | 1.877 |
| Triangoli degeneri nelle mesh visibili | 2.552 | 0 |

Risparmio: **2.588 triangoli**, senza nuovi arredi o decorazioni.
I conteggi per il gioco escludono gli oggetti di servizio e presentazione.

## Verifica e ambito

`verification.json` registra i controlli eseguiti sulla scena Blender effettiva,
inclusi i modificatori: 3.600 raggi lungo il perimetro interno dell'osservatorio,
576 controlli su sei aperture/supporti dell'ascensore, distacco delle soglie,
continuità delle mesh riparate e conservazione di nomi, trasformazioni e materiali.
`audit-before.json`, `audit-after.json` e `changes.json` conservano le misure.

Le immagini in `renders/` sono viste di controllo strutturale in Workbench.
Per ispezionare gli interni i vetri sono stati nascosti temporaneamente, poi
ripristinati. Le foglie con trasparenza non hanno il loro aspetto finale in
queste viste. I bordi aperti intenzionali di foglie, vetri e moduli decorativi
non sono stati riempiti indiscriminatamente.

L'intervento riguarda il sorgente Blender. Nessuna esportazione GLB, modifica
del gioco, build o pubblicazione. I render non costituiscono approvazione umana
né certificazione del comportamento in gioco.

Per riprodurre le modifiche dalla copia iniziale: `refine_scene.py`,
`refine_roof.py`, `cleanup_degenerate.py`, quindi `verify_scene.py`.
`finalize_scene.py` salva il risultato e le evidenze dopo la verifica.
