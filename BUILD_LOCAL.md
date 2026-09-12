# Casa3D - Guida rapida

## Build

```powershell
Set-Location "C:\Users\Amministratore\y.worktrees\copilot-worktrees\animalhousestudio.github.io\animalhousestudio-expert-fortnight"
.\casa3d\deploy.ps1
```

## Build e push su GitHub main

Dalla stessa cartella:

```powershell
.\casa3d\deploy.ps1 -Push -Message "Aggiorna Casa3D"
```

Esegue build, `git add` di `casa3d/` e della guida, commit se necessario e
`git push origin HEAD:main`, senza cambiare branch locale e senza forzare.
Prima controllare `git status` e `git diff`: il push include tutti i commit
locali non ancora su main. Lo script si ferma se main ha aggiornamenti
non integrati o se ci sono gia file in staging; risolvere prima di riprovare.
Se il push fallisce, il commit resta locale. Non usare `--force`.

## Server

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

- Sorgenti: `casa3d/src/`; modello: `src/assets/models/exterior-home.glb`.
- HTML da modificare: `casa3d/index.template.html`, non `index.html`.
- Build generata: `casa3d/dist/`; copia pubblicabile: `casa3d/index.html` e `casa3d/assets/`.
- Il filtro `src/rooms/curvedExterior.mjs` nasconde il vecchio guscio esportato; GLB, Blender e collisioni non vengono rimodellati.

**Non eseguire `npm ci` a ogni build.** Solo alla prima installazione o dopo
un cambio del lockfile, fermare prima tutti i server Vite di questo worktree,
poi eseguire `npm.cmd --prefix .\casa3d ci`. Un server acceso blocca Rollup
su Windows e puo' causare `EPERM ... unlink`. Le dipendenze qui sono gia pronte.

Senza `-Push` build e server restano locali. Con `-Push` si aggiorna GitHub
`main`; la pubblicazione del sito segue la configurazione GitHub Pages e
puo' richiedere qualche minuto. Non aggiungere `node_modules/` o `dist/`.
