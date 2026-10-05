# Casa3D - Guida rapida

Per aggiungere contenuti partire da [casa3d/WORLD_CONTENT.md](casa3d/WORLD_CONTENT.md).
L'indice del progetto è [casa3d/README.md](casa3d/README.md).

## Build

```powershell
Set-Location "C:\Users\Amministratore\y.worktrees\copilot-worktrees\animalhousestudio.github.io\animalhousestudio-expert-fortnight"
.\casa3d\deploy.ps1
```

## Build e push su GitHub main

Dalla stessa cartella:

```powershell
.\\casa3d\deploy.ps1 -Push -Message "Aggiorna Casa3D"
```

Esegue build, `git add` di `casa3d/` e della guida, commit se necessario e
`git push origin HEAD:main`, senza cambiare branch locale e senza forzare.
Prima controllare `git status` e `git diff`: il push include tutti i commit
locali non ancora su main. Lo script si ferma se main ha aggiornamenti
non integrati o se ci sono gia file in staging; risolvere prima di riprovare.
Se il push fallisce, il commit resta locale. Non usare `--force`.

## Server

Per lavorare sui sorgenti (con aggiornamento automatico), dalla radice:

```powershell
npm.cmd --prefix .\casa3d run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Aprire `http://127.0.0.1:5174/index.template.html?review`. Il pannello locale
mostra anche zone/contenuti e livelli di dettaglio. Controllare prima che non
sia già attivo un server sulla porta. Il server seguente serve invece la build.

Solo se non e gia attivo, dalla stessa cartella:

```powershell
npm.cmd --prefix .\casa3d run preview -- --host 0.0.0.0 --port 4186 --strictPort --base=/casa3d/
```

Lasciare il terminale aperto. `Ctrl+C` ferma il server.
In un secondo PowerShell:

```powershell
Start-Process "http://127.0.0.1:4186/casa3d/"
```

LAN attuale: `http://192.168.1.12:4186/casa3d/` (stessa rete e firewall abilitato).

## File e dipendenze

- Sorgenti: `casa3d/src/`; modello attivo: `src/assets/models/mansion-v10.glb`.
- Progetto Blender: `casa3d/art/mansion-v10/mansion-v10-circular-lift.blend`; la v09 rimane recuperabile.
- Revisione v10: ascensore circolare monoposto e ottimizzazione geometrica. Modifiche preparate prima della build; test, render di controllo e verifica in gioco non eseguiti su richiesta.
- Alberi condivisi: `casa3d/art/trees-v01/trees-natural.blend` e `src/assets/models/trees-natural.glb`.
- Vialetto, giardino, prato e spazio laghetto: `casa3d/src/rooms/landscapeLayout.mjs`; dettagli e attribuzione FluffyGrass in `casa3d/art/landscape-v01/README.md`.
- HTML da modificare: `casa3d/index.template.html`, non `index.html`.
- Build generata: `casa3d/dist/`; copia pubblicabile: `casa3d/index.html` e `casa3d/assets/`.
- Le collisioni seguono la geometria della casa e degli asset dopo il caricamento; porte, cabina e cancelli dell'ascensore aggiornano il proprio ingombro quando si muovono.
- Correzioni del 29/09/2026: movimento senza rimbalzo sui piccoli dislivelli, vialetto con file da 2/3 pietre, terreno sagomato sulla casa, veranda raccordata, cabina alta 2,645 m (+15%). `src/rooms/exteriorRepairs.mjs` applica i raccordi e rimodella rami e foglie prima delle collisioni; tronco e radici restano al loro posto. Il GLB/Blender v10 originale rimane la base sorgente.
- Foto della verifica locale e dettagli: `casa3d/art/scene-fixes-2026-09-29/README.md`. I punti di controllo sono disponibili con `?review` su localhost.

**Non eseguire `npm ci` a ogni build.** Solo alla prima installazione o dopo
un cambio del lockfile, fermare prima tutti i server Vite di questo worktree,
poi eseguire `npm.cmd --prefix .\casa3d ci`. Un server acceso blocca Rollup
su Windows e puo' causare `EPERM ... unlink`. Le dipendenze qui sono gia pronte.

Senza `-Push` build e server restano locali. Con `-Push` si aggiorna GitHub
`main`; la pubblicazione del sito segue la configurazione GitHub Pages e
puo' richiedere qualche minuto. Non aggiungere `node_modules/` o `dist/`.
