# Casa3D - Build Locale

## Cartella di lavoro
```
C:\Users\Amministratore\y.worktrees\copilot-worktrees\animalhousestudio.github.io\animalhousestudio-silver-succotash
```

## Build e Server

### 1. Build con Vite
```powershell
cd casa3d
.\deploy.ps1
```

Questo comando:
- Ripristina il template
- Compila con Vite (base `/casa3d/`)
- Copia i file generati in `casa3d/index.html` e `casa3d/assets/`

### 2. Avviare il server locale
```powershell
cd ..
python -m http.server 4174
```

Oppure con Node.js:
```powershell
npx http-server . -p 4174
```

### 3. Aprire nel browser
```
http://127.0.0.1:4174/casa3d/
```

## Accesso da rete locale (iPhone/altri device)
Trova l'IP locale della macchina:
```powershell
ipconfig | Select-String "IPv4"
```

Poi accedi da un altro device:
```
http://<IP_LOCALE>:4174/casa3d/
```

Esempio: `http://192.168.1.7:4174/casa3d/`

## Struttura progetto
- `casa3d/src/` - Codice sorgente Three.js
- `casa3d/src/rooms/` - Stanze (garden.js, livingRoom.js, kitchen.js, observatory.js)
- `casa3d/src/assets/models/` - GLB assets (exterior-home.glb, grass, pitch, rocks)
- `casa3d/deploy.ps1` - Script di build
- `casa3d/index.html` - Template HTML

## Note
- Il nuovo `exterior-home.glb` è stato esportato da Blender e integrato
- I path stones (asse grigio) sono stati rimossi da garden.js
- Il codice del cratere è stato completamente eliminato
- L'ingresso dovrebbe ora essere visivamente libero
