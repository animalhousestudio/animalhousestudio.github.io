# Animale Artificiale

Prototipo Blender dell'installazione musicale. La collezione `ANIMALE ARTIFICIALE`
contiene il monolite e la sottocollezione `Player`. La collezione `Studio`
contiene pavimento, luci e due camere di verifica.

Il corpo nero satinato misura 1,12 × 0,45 × 2,84 m. La base entra di 1 mm
nel pavimento di prova. Il display verticale è largo 0,93 m, alto 1,46 m
e centrato a 2,00 m, la quota occhi del personaggio di Casa3D.

Il titolo dell'album è 𓅭𓃸𓅝𓃰𓆝. I tredici brani mantengono i codici
da 03.101 a 03.113 e le sequenze fornite. Play e barra di avanzamento
sono elementi visivi. Testi, materiali e geometria restano modificabili.

La copertina è un ritaglio dell'anteprima Drive di [video massimo lago.MP4](https://drive.google.com/file/d/1bjv6p4nN1apGfycyGc7oq0u2wkAH9KWd/view)
al tempo sorteggiato di 00:53:50.142. L'immagine e i font sono incorporati
nel file Blender.

## File

- [Animale_Artificiale.blend](Animale_Artificiale.blend) è la scena modificabile.
- [monolite.jpg](monolite.jpg) mostra il corpo e l'appoggio a pavimento.
- [player.jpg](player.jpg) mostra il display frontalmente.
- [build_monolite.py](build_monolite.py) ricrea il prototipo con Blender 5.2 su Windows.
  Legge [cover-5350.jpg](cover-5350.jpg) dalla stessa cartella e salva il file Blender
  accanto allo script. Usare una copia della cartella per rigenerare senza
  sovrascrivere la scena di lavoro.

## Nel gioco

[export_runtime.py](export_runtime.py) esporta corpo e cornice, con gli smussi
applicati, e ricava una texture frontale dello schermo. Il [manifest](runtime-export.json)
registra i file effettivamente importati. Il monolite è subito a sinistra del
vialetto di atterraggio e ha un collider indipendente. Il pannello è visibile
da vicino con `?review&view=monolith`.

I [13 WAV di Drive](https://drive.google.com/drive/folders/1ptMyiEgii6iB7u20b8jasAtxz6QfVqVt)
sono associati ai titoli in ordine numerico dei nomi sorgenti. La
[mappatura verificata](audio-encoding.json) riporta durata, byte e hash.
[encode_audio.py](encode_audio.py) legge i WAV dalla cartella passata come
argomento e ricrea i 13 MP3 CBR a 192 kbps con le librerie di Audacity su
Windows. La copia per il gioco è in `casa3d/audio/animale-artificiale/`.

All'avvio il monolite usa `casa3d/audio/animaleartificale01/`, nove MP3
in ordine da 1 a 9. CAMBIA alterna i due dischi. La
[copertina iniziale](cover-01.jpg) è un ritaglio dello screenshot fornito
del video del lago a 34:51, sopra i controlli di Drive.
[export_second_album.py](export_second_album.py) la inserisce nella grafica
del disco iniziale usando i dati della voce `ALBUMS[0]` passati come JSON.
Il [manifest](album-01-export.json) registra la provenienza e gli hash.
