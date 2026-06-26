document.addEventListener('DOMContentLoaded', () => {
    // 1. Recupero la lingua dal localStorage (default: it)
    const currentLang = localStorage.getItem('preferredLanguage') || 'it';
    document.documentElement.lang = currentLang;

    // 2. Dizionario per le traduzioni della pagina e delle biografie
    const i18n = {
        it: {
            back: "< TORNA ALLA CASA",
            title: "OSSERVATORIO",
            desc: "Dall'osservatorio si guardano le stelle.",
            entities: "ENTITÀ PRESENTI",
            linkBtn: "LINK",
            bios: {
                "CORASAN": "Corasan è un producer, dj e polistrumentista. Ama dipingere musica, i videogiochi, le chitarre elettriche e i synth.",
                "CARLO MARTINELLI": "All’origine di questa deriva esistenziale, oltre che verbale, c’è ovviamente la perdita giovanile di quella che avrebbe potuto essere la lingua madre.",
                "ANTHONIO": "La sua identità sonora è come quella di un pendolare che non scende a nessuna fermata... l’elettronica pura e la composizione elettro-acustica ne ossessionano la ricerca. Diffusione del suono e composizione in tempo reale sono le proprie îles flottantes.",
                "VERA DI LECCE": "Vera Di Lecce è musicista, cantante e performer originaria del Salento. Nella sua ricerca intreccia la tradizione salentina ai linguaggi contemporanei, esplorando la voce come strumento di liberazione e radicamento. La sua pratica attraversa il canto arcaico, la sperimentazione elettronica e la performance intesa come rito collettivo.",
                "FALCO": "Suono da tanto. Adoro la musica e poco i backstage. La parte di palco con l'ombra e le luci basse è la mia preferita."
            }
        },
        en: {
            back: "< BACK TO THE HOUSE",
            title: "OBSERVATORY",
            desc: "From the observatory you look at the stars.",
            entities: "PRESENT ENTITIES",
            linkBtn: "LINK",
            bios: {
                "CORASAN": "Corasan is a producer, DJ, and multi-instrumentalist. He loves painting music, video games, electric guitars, and synths.",
                "CARLO MARTINELLI": "At the origin of this existential, as well as verbal, drift is obviously the youthful loss of what could have been the mother tongue.",
                "ANTHONIO": "His sonic identity is like that of a commuter who never gets off at any stop... pure electronics and electro-acoustic composition obsess his research. Sound diffusion and real-time composition are his îles flottantes.",
                "VERA DI LECCE": "Vera Di Lecce is a musician, singer, and performer from Salento. In her research, she intertwines the Salento tradition with contemporary languages, exploring the voice as an instrument of liberation and grounding. Her practice spans archaic singing, electronic experimentation, and performance understood as a collective rite.",
                "FALCO": "I've been playing for a long time. I love music and not so much the backstage. The part of the stage with shadows and low lights is my favorite."
            }
        },
        fr: {
            back: "< RETOUR À LA MAISON",
            title: "OBSERVATOIRE",
            desc: "Depuis l'observatoire on regarde les étoiles.",
            entities: "ENTITÉS PRÉSENTES",
            linkBtn: "LIEN",
            bios: {
                "CORASAN": "Corasan est un producteur, DJ et multi-instrumentiste. Il aime peindre la musique, les jeux vidéo, les guitares électriques et les synthés.",
                "CARLO MARTINELLI": "À l'origine de cette dérive existentielle, ainsi que verbale, il y a bien sûr la perte juvénile de ce qui aurait pu être la langue maternelle.",
                "ANTHONIO": "Son identité sonore est celle d'un banlieusard qui ne descend à aucun arrêt... l'électronique pure et la composition électroacoustique obsèdent sa recherche. La diffusion sonore et la composition en temps réel sont ses îles flottantes.",
                "VERA DI LECCE": "Vera Di Lecce est une musicienne, chanteuse et performeuse originaire du Salento. Dans sa recherche, elle entrelace la tradition du Salento avec les langages contemporains, explorant la voix comme un instrument de libération et d'enracinement. Sa pratique traverse le chant archaïque, l'expérimentation électronique et la performance comprise comme un rite collectif.",
                "FALCO": "Je joue depuis longtemps. J'adore la musique et un peu moins les coulisses. La partie de la scène avec de l'ombre et des lumières basses est ma préférée."
            }
        }
    };

    const dict = i18n[currentLang] || i18n['it'];

    // 3. Applica i testi tradotti all'interfaccia base
    document.title = dict.title + " - Animal House";
    document.getElementById('ui-back').textContent = dict.back;
    document.getElementById('ui-title').textContent = dict.title;
    document.getElementById('ui-desc').textContent = dict.desc;
    document.getElementById('ui-entities').textContent = dict.entities;
    document.getElementById('bioLink').textContent = dict.linkBtn;

    // 4. Dati degli artisti (le bio vengono prese dal dizionario)
    const artistsData = [
        {
            name: "CORASAN",
            img: "assets/images/corasan.png",
            link: "https://www.instagram.com/corasanmusic/"
        },
        {
            name: "CARLO MARTINELLI",
            img: "assets/images/marlo.jpeg",
            link: "https://www.instagram.com/carlomartinellis/"
        },
        {
            name: "ANTHONIO",
            img: "assets/images/anthonio.png",
            link: "https://www.instagram.com/_anthoni.o_/"
        },
        {
            name: "VERA DI LECCE",
            img: "assets/images/vera.jpg",
            link: "https://www.instagram.com/veradilecce/"
        },
        {
            name: "FALCO",
            img: "assets/images/falco.png",
            link: "https://www.instagram.com/giusfalco/"
        }
    ];

    const artistListEl = document.getElementById('artistList');
    const bioModal = document.getElementById('bioModal');
    const bioImg = document.getElementById('bioImg');
    const bioName = document.getElementById('bioName');
    const bioText = document.getElementById('bioText');
    const bioLink = document.getElementById('bioLink');

    // 5. Generazione lista artisti dinamica
    artistsData.forEach(artist => {
        const li = document.createElement('li');
        li.textContent = artist.name;
        li.addEventListener('click', () => {
            bioName.textContent = artist.name;
            // Assegna la bio tradotta corrispondente al nome dell'artista
            bioText.textContent = dict.bios[artist.name];
            bioLink.href = artist.link;
            bioImg.src = artist.img || 'assets/images/placeholder_user.png';
            bioImg.alt = artist.name;
            bioModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            bioModal.scrollTop = 0;
        });
        artistListEl.appendChild(li);
    });

    // 6. Gestione chiusura modale
    const closeModal = () => { bioModal.classList.remove('active'); document.body.style.overflow = 'auto'; };
    document.getElementById('closeBioModal').addEventListener('click', closeModal);
    bioModal.addEventListener('click', (e) => { if(e.target === bioModal) closeModal(); });
});
