document.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('preferredLanguage') || 'it';
    document.documentElement.lang = currentLang;

    const i18n = {
        it: {
            back: "< TORNA ALLA CASA",
            title: "CUCINA",
            desc: "Il cuore della casa, dove si prepara il nutrimento.",
            entities: "ENTITÀ PRESENTI",
            linkBtn: "LINK",
            bios: {
                "MILKO MALTOSIO": "Cuoeta, chef a domicilio, disturbatore e affabulatore, presto sui vostri piatti.",
                "CHOCOLATE AND RECORDS": "Degustazioni, rituali, dischi, kombucha e cacao. Fermentazioni analogiche e Bean to Bar - A Roma -"
            }
        },
        en: {
            back: "< BACK TO THE HOUSE",
            title: "KITCHEN",
            desc: "The heart of the house, where nourishment is prepared.",
            entities: "PRESENT ENTITIES",
            linkBtn: "LINK",
            bios: {
                "MILKO MALTOSIO": "Cuoeta, private chef, provocateur and storyteller, coming soon to your plates.",
                "CHOCOLATE AND RECORDS": "Tastings, rituals, records, kombucha and cocoa. Analog fermentations and Bean to Bar - In Rome -"
            }
        },
        fr: {
            back: "< RETOUR À LA MAISON",
            title: "CUISINE",
            desc: "Le cœur de la maison, où l'on prépare la nourriture.",
            entities: "ENTITÉS PRÉSENTES",
            linkBtn: "LIEN",
            bios: {
                "MILKO MALTOSIO": "Cuoeta, chef à domicile, provocateur et conteur, bientôt dans vos assiettes.",
                "CHOCOLATE AND RECORDS": "Dégustations, rituels, disques, kombucha et cacao. Fermentations analogiques et Bean to Bar - À Rome -"
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
        { 
            name: "MILKO MALTOSIO", 
            img: "assets/images/milko.png", 
            link: "https://nasa.gov" 
        },
        { 
            name: "CHOCOLATE AND RECORDS", 
            img: "assets/images/chocolate.png", 
            link: "https://www.instagram.com/chocoandrec/" 
        }
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
            bioModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        artistListEl.appendChild(li);
    });

    const closeModal = () => { bioModal.classList.remove('active'); document.body.style.overflow = 'auto'; };
    document.getElementById('closeBioModal').addEventListener('click', closeModal);
    bioModal.addEventListener('click', (e) => { if(e.target === bioModal) closeModal(); });
});
