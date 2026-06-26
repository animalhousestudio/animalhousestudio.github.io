document.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('preferredLanguage') || 'it';
    document.documentElement.lang = currentLang;

    const i18n = {
        it: {
            back: "< TORNA ALLA CASA",
            title: "CAMPETTO",
            desc: "Nel campetto giocano gli animali.",
            entities: "ENTITÀ PRESENTI",
            linkBtn: "LINK",
            bios: {
                "FUORIROTTA E SENTINELLA": "Fuorirotta e Sentinella è il nome d’arte di Gianpiero Palermo, autore e musicista calabrese che debutta con Pe (Animal House, 2025). “Fuorirotta” perché esplora strade alternative, “Sentinella” perché si assicura che conducano a destinazione.",
                "KARENINA": "Partono nel 2010 come Triste Colore Rosa. Nel 2011 si ribattezzano Karenina e debuttano con l'album 'Il futuro che ricordavo' (2012), disco indie/pop molto apprezzato dalla critica. Dopo l'EP 'Verso' (2013), pubblicano 'Via Crucis' (2014), un concept album pop-rock d’autore che racconta un viaggio tra i fantasmi di un Paese tormentato.",
                "ZEUS FEBO": "Nati nel quartiere popolare romano della Garbatella, dove ogni vicolo ha una storia e ogni bar un ritornello, gli ZeusFebo sono quattro amici che nel 2023 hanno deciso di trasformare le chiacchiere e le notti romane in canzoni: Zeus Febo Massimi, Andrea Tabolacci, Silvano Lama e Alessio Tabolacci.",
                "QVINTO": "Il Qvinto a calcetto. Coming soon."
            }
        },
        en: {
            back: "< BACK TO THE HOUSE",
            title: "SMALL FIELD",
            desc: "In the small field, the animals play.",
            entities: "PRESENT ENTITIES",
            linkBtn: "LINK",
            bios: {
                "FUORIROTTA E SENTINELLA": "Fuorirotta e Sentinella is the stage name of Gianpiero Palermo, a Calabrian author and musician who debuts with Pe (Animal House, 2025). 'Fuorirotta' (Off-course) because he explores alternative paths, 'Sentinella' (Sentry) because he ensures they reach their destination.",
                "KARENINA": "Starting in 2010 as Triste Colore Rosa. In 2011 they rebranded as Karenina and debuted with the album 'Il futuro che ricordavo' (2012), an indie/pop record highly acclaimed by critics. After the EP 'Verso' (2013), they released 'Via Crucis' (2014), a concept pop-rock album telling a journey through the ghosts of a troubled country.",
                "ZEUS FEBO": "Born in the popular Roman neighborhood of Garbatella, where every alley has a story and every bar has a chorus, ZeusFebo are four friends who in 2023 decided to turn Roman chats and nights into songs: Zeus Febo Massimi, Andrea Tabolacci, Silvano Lama, and Alessio Tabolacci.",
                "QVINTO": "Qvinto at five-a-side soccer. Coming soon."
            }
        },
        fr: {
            back: "< RETOUR À LA MAISON",
            title: "PETIT TERRAIN",
            desc: "Sur le petit terrain, les animaux jouent.",
            entities: "ENTITÉS PRÉSENTES",
            linkBtn: "LIEN",
            bios: {
                "FUORIROTTA E SENTINELLA": "Fuorirotta e Sentinella est le nom de scène de Gianpiero Palermo, auteur et musicien calabrais qui fait ses débuts avec Pe (Animal House, 2025). 'Fuorirotta' (Hors-piste) car il explore des chemins alternatifs, 'Sentinella' (Sentinelle) car il s'assure qu'ils arrivent à destination.",
                "KARENINA": "Débutant en 2010 sous le nom de Triste Colore Rosa. En 2011, ils sont rebaptisés Karenina et débutent avec l'album 'Il futuro che ricordavo' (2012), un disque indie/pop très apprécié par la critique. Après l'EP 'Verso' (2013), ils publient 'Via Crucis' (2014), un concept-album pop-rock d'auteur racontant un voyage parmi les fantômes d'un pays tourmenté.",
                "ZEUS FEBO": "Nés dans le quartier populaire romain de la Garbatella, où chaque ruelle a une histoire et chaque bar un refrain, ZeusFebo sont quatre amis qui, en 2023, ont décidé de transformer les bavardages et les nuits romaines en chansons : Zeus Febo Massimi, Andrea Tabolacci, Silvano Lama et Alessio Tabolacci.",
                "QVINTO": "Qvinto au foot à cinq. À venir."
            }
        }
    };

    const dict = i18n[currentLang] || i18n['it'];

    document.title = dict.title + " - Animal House";
    document.getElementById('ui-back').textContent = dict.back;
    document.getElementById('ui-title').textContent = dict.title;
    document.getElementById('ui-desc').textContent = dict.desc;
    document.getElementById('ui-entities').textContent = dict.entities;
    document.getElementById('bioLink').textContent = dict.linkBtn;

    const artistsData = [
        { name: "FUORIROTTA E SENTINELLA", img: "assets/images/fuorirotta.png", link: "https://www.instagram.com/fuorirotta_e_sentinella/" },
        { name: "KARENINA", img: "assets/images/karenina.png", link: "https://soundcloud.com/kareninapage" },
        { name: "ZEUS FEBO", img: "assets/images/zeusfebo.png", link: "https://www.instagram.com/zeusfebo/" },
        { name: "QVINTO", img: "assets/images/qvinto.png", link: "https://www.instagram.com/qvintofficial/" }
    ];

    const artistListEl = document.getElementById('artistList');
    const bioModal = document.getElementById('bioModal');
    const bioImg = document.getElementById('bioImg');
    const bioName = document.getElementById('bioName');
    const bioText = document.getElementById('bioText');
    const bioLink = document.getElementById('bioLink');

    artistsData.forEach(artist => {
        const li = document.createElement('li');
        li.textContent = artist.name;
        li.addEventListener('click', () => {
            bioName.textContent = artist.name;
            bioText.textContent = dict.bios[artist.name] || "";
            bioLink.href = artist.link;
            bioImg.src = artist.img || 'assets/images/placeholder_user.png';
            bioImg.alt = artist.name;
            bioModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            bioModal.scrollTop = 0;
        });
        artistListEl.appendChild(li);
    });

    const closeModal = () => { bioModal.classList.remove('active'); document.body.style.overflow = 'auto'; };
    document.getElementById('closeBioModal').addEventListener('click', closeModal);
    bioModal.addEventListener('click', (e) => { if(e.target === bioModal) closeModal(); });
});
