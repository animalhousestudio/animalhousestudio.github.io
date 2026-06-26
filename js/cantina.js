document.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('preferredLanguage') || 'it';
    document.documentElement.lang = currentLang;

    const i18n = {
        it: {
            back: "< TORNA ALLA CASA",
            title: "CANTINA",
            desc: "Nella cantina buia dove noi.",
            entities: "ENTITÀ PRESENTI",
            linkBtn: "LINK",
            bios: {
                "BORSTAL": "BORSTAL non compone musica: tortura la triade 'gesto-spazio-suono' finché non confessa dove nasconde l'estasi sensoriale. Più che un artista, è un architetto abusivo dell'udito che progetta odissee sonore in cui l'ascoltatore non è un ospite, ma un elemento strutturale e risonante.",
                "LEMON LIGHTS": "Lemon Lights è un produttore di Roma la cui musica naviga territori techno, IDM, deep e ambient.",
                "LORENZO BENZONI": "WORK IN PROGRESS",
                "ROME IN REVERSE": "Rome in Reverse, il progetto solista dell'artista italiana Antonella Pacifico (con base a Copenhagen), ha fatto il suo debutto nel 2014, trovando rapidamente la sua nicchia nella affollata scena della musica elettronica. L'ambiente creato da Rome in Reverse è una collezione fusa di musica dance da club, trance-techno, ambient dub e suoni trip-hop onirici guidati da beat elettronici up/downtempo e occasionalmente accompagnati dalla sua voce emotiva.",
                "LA BANDA": "La banda sta arrivando."
            }
        },
        en: {
            back: "< BACK TO THE HOUSE",
            title: "CELLAR",
            desc: "In the dark cellar where we.",
            entities: "PRESENT ENTITIES",
            linkBtn: "LINK",
            bios: {
                "BORSTAL": "BORSTAL does not compose music: it tortures the 'gesture-space-sound' triad until it confesses where it hides sensory ecstasy. More than an artist, he is an unlicensed architect of hearing who designs sonic odysseys where the listener is not a guest, but a structural and resonant element.",
                "LEMON LIGHTS": "Lemon Lights is a producer from Rome whose music navigates both techno, IDM territories, deep and ambient.",
                "LORENZO BENZONI": "WORK IN PROGRESS",
                "ROME IN REVERSE": "Rome in Reverse, the solo project of the Italian-born, Copenhagen-based artist Antonella Pacifico, made its debut in 2014 and quickly found its niche within the crowded electronic music scene. The environment created by Rome in Reverse is a fused collection of club dance music, trance-techno, ambient dub, and dreamlike trip-hop sounds driven by electronic up/downtempo beats and occasionally accompanied by her emotional voice.",
                "LA BANDA": "The band is coming."
            }
        },
        fr: {
            back: "< RETOUR À LA MAISON",
            title: "CAVE",
            desc: "Dans la cave sombre où nous.",
            entities: "ENTITÉS PRÉSENTES",
            linkBtn: "LIEN",
            bios: {
                "BORSTAL": "BORSTAL ne compose pas de musique : il torture la triade 'geste-espace-son' jusqu'à ce qu'elle avoue où elle cache l'extase sensorielle. Plus qu'un artiste, c'est un architecte illégal de l'ouïe qui conçoit des odyssées sonores où l'auditeur n'est pas un invité, mais un élément structurel et résonnant.",
                "LEMON LIGHTS": "Lemon Lights est un producteur romain dont la musique navigue entre techno, IDM, deep et ambient.",
                "LORENZO BENZONI": "WORK IN PROGRESS",
                "ROME IN REVERSE": "Rome in Reverse, le projet solo de l'artiste italienne Antonella Pacifico (basée à Copenhague), a fait ses débuts en 2014, trouvant rapidement sa place sur la scène bondée de la musique électronique. L'environnement créé par Rome in Reverse est une collection fusionnée de musique dance de club, trance-techno, ambient dub et de sons trip-hop oniriques, portés par des beats électroniques up/downtempo et parfois accompagnés de sa voix émotionnelle.",
                "LA BANDA": "Le groupe arrive."
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
        { name: "BORSTAL", img: "assets/images/borstal.jpeg", link: "#" },
        { name: "LEMON LIGHTS", img: "assets/images/lemon.png", link: "https://www.instagram.com/lemonlightsofficial/" },
        { name: "LORENZO BENZONI", img: "assets/images/enzbenz.png", link: "https://www.instagram.com/lorenzobenzoni___/" },
        { name: "ROME IN REVERSE", img: "assets/images/romeinreverse.png", link: "https://www.instagram.com/romeinreverse/" },
        { name: "LA BANDA", img: "assets/images/labanda.jpg", link: "https://www.nasa.gov/" }
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
