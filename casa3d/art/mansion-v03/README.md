# Magione — revisione architettonica v03

La scena di revisione è `Mansion_Architecture_v03` in `mansion-v03.blend`.
Le viste verificate sono `mansion-v03-front.png` e `mansion-v03-rear.png`.
`before-v03.blend` conserva lo stato di Blender prima di questa revisione.

## Modifiche

- Balcone ridotto da 3,60 a 1,872 m di profondità; rimossi i pali sospesi. Tre mensole e relativi ancoraggi occupano le porzioni piene della facciata.
- Torretta spostata di 4,80 m a destra; base ottagonale chiusa e solai interni. Passaggio coperto al livello effettivo del modello Blender (9,7846 m), con aperture in entrambi gli edifici e sostegni sopra la tettoia del bow-window.
- Finestre del piano superiore di dimensioni e tipologie diverse, bifora posteriore, persiane e piccole coperture. Aperture posteriori inferiori sfalsate insieme a cornici, parete e bordi dei solai; completati gli infissi.
- Portone in noce con pannelli, ferramenta, battenti ad anello, spallette e arco in pietra.
- Cannocchiale orizzontale verso +X (destra guardando la facciata) e apertura della cupola orientata nella stessa direzione.
- Antenne, banderuola con anemometro, due ulteriori comignoli e tetti minori.
- Balconata dell'osservatorio adattata alla pianta ellittica: eliminata l'interferenza con il timpano posteriore.

## Controlli

Base della torretta senza bordi aperti; tre raggi longitudinali attraversano il passaggio e raggiungono la parete opposta della torretta. Risultati in `connection-checks.json`.
Mesh ripetute e materiali condivisi; conteggi in `stats.json`. Nessun oggetto di presentazione è destinato all'esportazione per il gioco.

Gli script sono una ricetta da applicare **una volta** allo stato v02: `revise_mansion_v03.py` esegue anche `finish_v03.py`. Non eseguirli nuovamente sulla scena v03.

Questa revisione riguarda Blender. Il gioco resta sul modello v02 già integrato, in attesa della revisione visiva della nuova architettura. Porte animate e jetpack non sono inclusi.
