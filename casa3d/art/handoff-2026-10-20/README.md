# Consegna documentale e rimozione greybox — 20 ottobre 2026

Intervento descritto nella voce **DOC-001** del
[diario](../../docs/DIARIO_DI_BORDO.md). Non è un nuovo benchmark del gioco.
Questo pacchetto precede l'[allineamento dei test](../player-test-alignment-2026-10-20/README.md),
che ha successivamente risolto i quattro fallimenti qui registrati.

- [Riepilogo delle verifiche](verification.json): revisione di partenza,
  suite prima/dopo, build locale e limiti.
- [Output completo della suite dopo la rimozione](test-suite.txt): 236 test,
  232 superati, quattro fallimenti principali preesistenti ancora visibili.
- [Inventario delle rimozioni](removed-greybox-files.txt): percorsi relativi
  alla radice del repository, compresi i pacchetti generati esclusivi.

La nuova build e l'HTML pubblicabile sono stati confrontati con `dist/`.
Gli output esclusivi eliminati non appartengono alla nuova build. I vecchi
entry bundle misti restano come residui di build precedenti e possono citare
chunk ritirati: non sono gli ingressi attivi. Non è stata eseguita una pulizia
generale degli asset né una pubblicazione.

Bootstrap verificato in contesti isolati: URL normale, vecchio greybox e query
sconosciuta aprono il mondo principale; discesa, sala e redirect della vecchia
cabina conservano i propri percorsi. Questa prova e la compilazione non
equivalgono a una nuova sessione completa di QA browser o a una misura GPU.

L'audit dei documenti ha inoltre segnalato il flag della superficie oltre 24 m
non propagato nella scena subacquea combinata. Il limite è registrato in
[PROJECT_STATE.md](../../docs/PROJECT_STATE.md), senza modifica del runtime.
