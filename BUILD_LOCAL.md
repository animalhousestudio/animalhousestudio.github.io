# Casa3D: sviluppo, build e pubblicazione

Eseguire i comandi dalla **radice di questo checkout**, la cartella che contiene
questa guida e `casa3d/`. Non serve riprodurre il percorso del computer originale.

Prima leggere l'[indice del progetto](casa3d/README.md), lo
[stato corrente](casa3d/docs/PROJECT_STATE.md) e le
[regole sulle prestazioni](casa3d/PERFORMANCE.md). Per asset e attrazioni seguire
[WORLD_CONTENT.md](casa3d/WORLD_CONTENT.md) e aggiornare il
[diario](casa3d/docs/DIARIO_DI_BORDO.md).

## Dipendenze e file da modificare

- Runtime Node.js/npm; dipendenze e comandi in `casa3d/package.json`, versioni
  risolte in `casa3d/package-lock.json`.
- Sorgenti in `casa3d/src/`; HTML da modificare: `casa3d/index.template.html`.
- Modello principale: `casa3d/src/assets/models/mansion-v10.glb`.
  Il [registro asset](casa3d/docs/ASSET_REGISTER.md) collega sorgenti ed export.
- `casa3d/dist/` è output locale. `casa3d/index.html` e `casa3d/assets/` sono
  la copia pubblicabile: non correggere a mano i bundle.

**Non eseguire `npm ci` a ogni build.** Alla prima installazione o dopo un
cambio del lockfile, fermare prima i server Vite di questo checkout, poi:

```powershell
npm.cmd --prefix .\casa3d ci
```

Su Windows un server acceso può tenere aperto Rollup e causare `EPERM ... unlink`.
Non aggiungere `node_modules/` o `dist/` al repository.

## Sorgenti con aggiornamento automatico

Controllare che la porta sia libera o che il server esistente appartenga a
questo checkout; non avviare duplicati.

```powershell
npm.cmd --prefix .\casa3d run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Aprire [la verifica locale dei sorgenti](http://127.0.0.1:5174/index.template.html?review).
Il pannello `?review` è abilitato solo su localhost/127.0.0.1.
Il prototipo greybox è rimosso; i vecchi URL aprono il mondo principale.
`Ctrl+C` ferma il server nel terminale in cui è stato avviato.

## Test

```powershell
node --test casa3d/test/*.test.mjs
```

La [procedura contenuti](casa3d/WORLD_CONTENT.md#verifica-prima-di-integrare)
indica i test mirati. Confrontare eventuali errori con l'elenco nello
[stato corrente](casa3d/docs/PROJECT_STATE.md#test-e-debito-tecnico), senza
considerare risultati storici come una nuova esecuzione.

## Build locale

```powershell
.\casa3d\deploy.ps1
```

Lo script compila a partire da `index.template.html`, con base `/casa3d/`,
genera `dist/` e aggiorna `index.html` e gli asset pubblicabili. Ripristina
l'HTML precedente se la preparazione fallisce. Senza `-Push` non pubblica.
I brani del monolite sono in `casa3d/audio/animale-artificiale/`. La build
copia la cartella soltanto in `dist/` per il server preview. Pages serve
direttamente la cartella versionata, accanto a `index.html`.

Lo script copia i file nuovi ma **non elimina automaticamente i vecchi asset**.
Per ritirare contenuti rimuovere gli output esclusivi soltanto dopo aver
verificato che non siano usati dalla nuova build o da altri ingressi; non
svuotare genericamente `assets/`. Documentare l'inventario delle rimozioni.

Per servire la build, se la porta non è già occupata:

```powershell
npm.cmd --prefix .\casa3d run preview -- --host 127.0.0.1 --port 4186 --strictPort --base=/casa3d/
```

Aprire [la build locale](http://127.0.0.1:4186/casa3d/?review).
Per una prova da un dispositivo fisico nella stessa rete, avviare invece con
`--host 0.0.0.0` e usare l'IP LAN attuale del computer, con firewall configurato.
Il pannello review resta locale; layout stretto e touch reale sono prove diverse.

## Pubblicazione su GitHub main

Quando la pubblicazione è prevista dal lavoro concordato, prima controllare
`git status`, `git diff` e i commit locali non ancora su main. Poi:

```powershell
.\casa3d\deploy.ps1 -Push -Message "Aggiorna Casa3D"
```

Lo script esegue build, prepara **tutto `casa3d/` e questa guida**, crea un commit
se necessario e invia `HEAD:main` senza cambiare branch locale né forzare.
Le modifiche al README e ad AGENTS della radice non sono aggiunte automaticamente:
includerle in un commit esplicito quando fanno parte della consegna.
Lo script si ferma se trova file già in staging o aggiornamenti di main non
integrati. Se il push fallisce, il commit resta locale. Non usare `--force`.

Il workflow `.github/workflows/static.yml` pubblica l'intero repository su
GitHub Pages dopo il push a main: non compila il gioco. Per questo devono
essere coerenti sorgenti, template e output pubblicabili prima della consegna.
La comparsa online dipende dall'esito del workflow.
