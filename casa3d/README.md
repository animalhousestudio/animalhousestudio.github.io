# Casa3D

Un asteroide esplorabile con una casa centrale e attrazioni da ampliare.

## Documentazione

- [Aggiungere e organizzare contenuti](WORLD_CONTENT.md): zone, catalogo delle
  collocazioni, modelli, caricamento progressivo e checklist di integrazione.
- [Prestazioni e verifiche](PERFORMANCE.md): stato attuale e misure storiche.
- [Build e server locale](../BUILD_LOCAL.md): comandi di sviluppo e pubblicazione.
- [Varianti geometriche](art/world-lod/README.md): sorgenti, generazione e confronti.

## Cartelle

| Percorso | Responsabilità |
| --- | --- |
| `src/world/` | Cataloghi, visibilità delle zone e livelli visivi |
| `src/rooms/` | Costruzione/posizionamento di casa, paesaggio e attrazioni |
| `src/player/` | Movimento, input e collisioni |
| `src/ui/` | Interfaccia del giocatore |
| `src/assets/` | Risorse importate dai sorgenti |
| `art/` | Sorgenti di produzione, script, manifest e verifiche degli asset |
| `test/` | Test automatici |
| `dist/`, `assets/`, `index.html` | Output della build; modificare i sorgenti e `index.template.html` |

La scena attiva usa `mansion-v10`. `?scene=greybox` seleziona un prototipo
alternativo: non è il mondo principale.
