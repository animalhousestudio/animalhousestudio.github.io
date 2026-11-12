# Casa3D

Un asteroide esplorabile con una casa centrale e attrazioni da ampliare.

## Da leggere per continuare il progetto

1. [Stato attuale](docs/PROJECT_STATE.md): cosa funziona, limiti, verifiche
   ancora aperte e punto di partenza per un refactoring.
2. [Prestazioni](PERFORMANCE.md): regole da preservare e metodo per confrontare
   una modifica con la situazione precedente.
3. [Inserimento dei contenuti](WORLD_CONTENT.md): cataloghi, scala, collisioni,
   caricamento e ordine delle ottimizzazioni.
4. [Registro asset](docs/ASSET_REGISTER.md): modelli attivi, sorgenti,
   costi documentati ed evidenze disponibili.
5. [Diario di bordo](docs/DIARIO_DI_BORDO.md): interventi, decisioni,
   verifiche e modello da compilare per le prossime aggiunte.
6. [Sviluppo e build](../BUILD_LOCAL.md): comandi dalla radice del repository.

[AGENTS.md](AGENTS.md) riassume il contratto per le AI dei collaboratori.
Le regole correnti stanno nelle guide sopra; i risultati datati sono nello
[storico delle prestazioni](docs/PERFORMANCE_HISTORY.md) e nei pacchetti `art/`.
Una vecchia nota non attesta lo stato attuale o una verifica mai completata.

## Cartelle

| Percorso | Responsabilità |
| --- | --- |
| `src/world/` | Cataloghi, visibilità delle zone e livelli visivi |
| `src/rooms/` | Costruzione/posizionamento di casa, paesaggio e attrazioni |
| `src/player/` | Movimento, input e collisioni |
| `src/ui/` | Interfaccia del giocatore |
| `src/assets/` | Risorse importate dai sorgenti |
| `art/` | Sorgenti di produzione, script, manifest e verifiche degli asset |
| `docs/` | Stato, registro asset, diario e storico delle misure |
| `test/` | Test automatici |
| `dist/`, `assets/`, `index.html` | Output della build; modificare i sorgenti e `index.template.html` |

La scena attiva usa `mansion-v10`. Il prototipo greybox è stato rimosso:
i vecchi URL con `?scene=greybox` aprono il mondo principale.

Prima di ampliare il mondo registrare il costo iniziale e la strategia di
dettaglio del nuovo contenuto. Alla chiusura dell'intervento aggiornare diario,
registro asset e stato quando pertinenti, indicando anche ciò che resta da verificare.
