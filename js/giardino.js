document.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('preferredLanguage') || 'it';
    document.documentElement.lang = currentLang;

    const i18n = {
        it: {
            back: "< TORNA ALLA CASA",
            title: "GIARDINO",
            desc: "Uno spazio aperto dove la natura e il suono si incontrano.",
            entities: "ENTITÀ PRESENTI",
            linkBtn: "LINK",
            bios: {
                "MARLA": "La musica esprime ciò che non può essere detto e su cui è impossibile restare in silenzio...",
                "HAMAKA": "È tempo di un po' di musica degli Hamaka.",
                "MIRIAM FORNARI": "Il progetto musicale di Miriam Fornari è basato su una ricerca senza sosta, una ricerca della propria identità che passa attraverso la ricerca del proprio suono. Un suono nuovo, riconoscibile e sincero, che nasce attraverso le infinite combinazioni fra strumenti acustici, elettronici e il silenzio che ne rimane attorno, un dialogo fra vuoti e pieni, detti e non detti, coscienza e subconscio. Miriam Fornari (Assisi, 1995) è pianista, cantante, tastierista e compositrice, formata presso la Siena Jazz University. La sua tesi 'La ricerca del Silenzio' è stata pubblicata nel 2020 da Morlacchi Editore. Collabora con diversi progetti tra cui /handlogic, ELLE trio, Maseeni, Marla Green e Marta Capponi.",
                "ANIMAL HOUSE": "Ogni tanto gli animali diversi si vedono che fanno le cose insieme.",
                "NOME BAND A PIACERE": "Dal 2019 con furore. Diffida delle piattaforme, sempre tutto free e aggiornato su bit.ly/noegofilez"
            }
        },
        en: {
            back: "< BACK TO THE HOUSE",
            title: "GARDEN",
            desc: "An open space where nature and sound meet.",
            entities: "PRESENT ENTITIES",
            linkBtn: "LINK",
            bios: {
                "MARLA": "Music expresses that which cannot be said and on which it is impossible to be silent...",
                "HAMAKA": "It's time for a bit of Hamaka music.",
                "MIRIAM FORNARI": "Miriam Fornari's musical project is based on an endless search for identity through the search for one's own sound. A new, sincere sound born from the infinite combinations of acoustic and electronic instruments and the silence around them—a dialogue between empty and full, said and unsaid, consciousness and subconscious. Miriam Fornari (Assisi, 1995) is a pianist, singer, keyboardist, and composer, trained at Siena Jazz University. Her thesis 'The Search for Silence' was published in 2020 by Morlacchi Editore. She collaborates with various projects including /handlogic, ELLE trio, Maseeni, Marla Green, and Marta Capponi.",
                "ANIMAL HOUSE": "Every now and then, different animals see each other and do things together.",
                "NOME BAND A PIACERE": "Since 2019 with fury. Beware of platforms, everything is always free and updated at bit.ly/noegofilez"
            }
        },
        fr: {
            back: "< RETOUR À LA MAISON",
            title: "JARDIN",
            desc: "Un espace ouvert où la nature et le son se rencontrent.",
            entities: "ENTITÉS PRÉSENTES",
            linkBtn: "LIEN",
            bios: {
                "MARLA": "La musique exprime ce qui ne peut être dit et sur quoi il est impossible de rester silencieux...",
                "HAMAKA": "Il est temps d'écouter un peu de musique de Hamaka.",
                "MIRIAM FORNARI": "Le projet musical de Miriam Fornari est fondé sur une recherche incessante de son identité à travers la quête de son propre son. Un son nouveau et sincère, né des combinaisons infinies entre instruments acoustiques, électroniques et le silence qui les entoure ; un dialogue entre vides et pleins, dits et non-dits, conscience et subconscient. Miriam Fornari (Assise, 1995) est pianiste, chanteuse, claviériste et compositrice, formée à la Siena Jazz University. Sa thèse 'La recherche du silence' a été publiée en 2020 par Morlacchi Editore. Elle collabore avec divers projets dont /handlogic, ELLE trio, Maseeni, Marla Green et Marta Capponi.",
                "ANIMAL HOUSE": "De temps en temps, différents animaux se retrouvent pour faire des choses ensemble.",
                "NOME BAND A PIACERE": "Depuis 2019 avec fureur. Méfiez-vous des plateformes, tout est toujours gratuit et mis à jour sur bit.ly/noegofilez"
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
        { name: "MARLA", img: "assets/images/marla.jpg", link: "https://www.instagram.com/marlamusicofficial_/" },
        { name: "HAMAKA", img: "assets/images/hamaka.png", link: "https://www.instagram.com/marina_on_mars/" },
        { name: "MIRIAM FORNARI", img: "assets/images/miriam.png", link: "https://linktr.ee/miriamfornari" },
        { name: "ANIMAL HOUSE", img: "assets/images/logo2.png", link: "https://www.twitch.tv/animalhouse" },
        { name: "NOME BAND A PIACERE", img: "assets/images/nomeband.png", link: "https://bit.ly/noegofilez" }
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
            bioText.textContent = dict.bios[artist.name] || "Bio non disponibile.";
            bioLink.href = artist.link;
            bioImg.src = artist.img || 'assets/images/placeholder_user.png';
            bioModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        artistListEl.appendChild(li);
    });

    const closeModal = () => { bioModal.classList.remove('active'); document.body.style.overflow = 'auto'; };
    document.getElementById('closeBioModal').addEventListener('click', closeModal);
    bioModal.addEventListener('click', (e) => { if(e.target === bioModal) closeModal(); });
});
