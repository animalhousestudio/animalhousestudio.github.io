# Casa3D - Guida rapida

## Build

```powershell
Set-Location "C:\Users\Amministratore\y.worktrees\copilot-worktrees\animalhousestudio.github.io\animalhousestudio-expert-fortnight"
.\casa3d\deploy.ps1
```

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

**Build e server sono locali: nessun commit o push automatico.**
Per aggiornare il sito pubblico servono commit e push/merge nel branch
configurato per GitHub Pages; non aggiungere `node_modules/` o `dist/`.
