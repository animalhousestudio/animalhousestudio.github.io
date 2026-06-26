document.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('preferredLanguage') || 'it';
    document.documentElement.lang = currentLang;

    const i18n = {
        it: {
            back: "< TORNA ALLA CASA",
            title: "SALOTTO",
            desc: "Il luogo del ritrovo, dove si chiacchiera e si ascolta.",
            entities: "ENTITÀ PRESENTI",
            linkBtn: "LINK",
            bios: {
                "CRISTÕF": "Cristõf è il progetto di musica elettroacustica di Marina Cristofalo, musicista nota per il progetto dream pop / shoegaze Lilies on Mars. Cristõf spinge la propria ricerca verso un’esplorazione radicale del suono, trattandolo come materia viva e forza espressiva.",
                "NO LUCIFER": "No Lucifer è una band alt-rock di Roma. Chitarre stratificate, voce diretta ma distante e ritmica essenziale. Il sound fonde l'alt-rock anni '90 con tinte post-punk cupe. Tra le influenze: Slint, Interpol, Catherine Wheel, Protomartyr.",
                "LE CAPRE A SONAGLI": "Originaria di Bergamo, la band ha da sempre esplorato i territori stoner folk, senza rinunciare ad affondare le mani nella psichedelia, adottando ritmi tribali e tutto ciò che significa punk, tra groove ossessionati e derive rock schizofreniche. Attiva dal 2011, ha alle spalle una lunga carriera fatta di tour, dischi e riconoscimenti. Nel 2023 pubblica l'EP \"Funeral Rave Party\" che sancisce un nuovo percorso, coerente con il precedente, fatto di groove afrobeat di ispirazione techno e punk straniante. Il 31 gennaio 2025 esce \"Cream the Green Butter\", seguito il 28 marzo da \"Cadillac and Unicorn\" e il 29 agosto da \"Uroboro Express\": tre singoli inediti nati sotto il segno di Carosello 2084 MHz, la loro nuova narrazione in brani, schegge impazzite di un futuro distopico.",
                "FISHEYE": "Andrea Pesce, in arte Fisheye, è un artista eclettico che attraversa diversi universi sonori come pianista, compositore, arrangiatore e produttore artistico. Diplomato in pianoforte, da subito viaggia tra mondi musicali diversi. Si appassiona a strumenti a tasto di ogni genere, attraverso una ricerca sonora che caratterizza ogni sua collaborazione discografica e dal vivo. In qualità di produttore, arrangiatore e musicista – insieme a Federico Zampaglione e Luigi Pulcinelli – fa parte della band Tiromancino dal 2002 al 2005. Insieme a Zampaglione è autore del pluripremiato singolo Per me è importante, rimasto a lungo primo in classifica.",
                "DODI CONTI": "Nata in Argentina, è un'attrice professionista dal 1998. Il suo esordio televisivo avviene nel programma televisivo Macao con la regia di Gianni Boncompagni. Nel 1998 è la protagonista del film Due volte nella vita, diretto dalla regista Emanuela Giordano. Nel 1999 interpreta Uga Fantozzi in Fantozzi 2000 - La clonazione. Nel 2005 ha partecipato alla sceneggiatura del film Gli occhi dell'altro del regista Gianpaolo Tescari."
            }
        },
        en: {
            back: "< BACK TO THE HOUSE",
            title: "LIVING ROOM",
            desc: "The meeting place, where we chat and listen.",
            entities: "PRESENT ENTITIES",
            linkBtn: "LINK",
            bios: {
                "CRISTÕF": "Cristõf is the electroacoustic music project by Marina Cristofalo, a musician known for the dream pop / shoegaze project Lilies on Mars. Cristõf pushes her research towards a radical exploration of sound, treating it as living matter and expressive force.",
                "NO LUCIFER": "No Lucifer is an alt-rock band from Rome. Layered guitars, direct but distant vocals, and essential rhythm. The sound blends 90s alt-rock with dark post-punk hues. Influences include: Slint, Interpol, Catherine Wheel, Protomartyr.",
                "LE CAPRE A SONAGLI": "Originally from Bergamo, the band has always explored stoner folk territories, without giving up delving into psychedelia, adopting tribal rhythms and everything that punk means, between obsessed grooves and schizophrenic rock drifts. Active since 2011, it has a long career of tours, records, and awards behind it. In 2023, they released the EP 'Funeral Rave Party', which marks a new path, consistent with the previous one, made of techno-inspired afrobeat grooves and alienating punk. On January 31, 2025, 'Cream the Green Butter' was released, followed on March 28 by 'Cadillac and Unicorn' and on August 29 by 'Uroboro Express': three unreleased singles born under the sign of Carosello 2084 MHz, their new narrative in songs, crazy splinters of a dystopian future.",
                "FISHEYE": "Andrea Pesce, aka Fisheye, is an eclectic artist who crosses different sonic universes as a pianist, composer, arranger, and artistic producer. A piano graduate, he immediately travels between different musical worlds. He is passionate about keyboard instruments of all kinds, through a sound research that characterizes every one of his recording and live collaborations. As a producer, arranger, and musician – together with Federico Zampaglione and Luigi Pulcinelli – he was part of the band Tiromancino from 2002 to 2005. Together with Zampaglione, he co-authored the award-winning single 'Per me è importante', which stayed at the top of the charts for a long time.",
                "DODI CONTI": "Born in Argentina, she has been a professional actress since 1998. Her television debut took place in the TV show 'Macao', directed by Gianni Boncompagni. In 1998, she starred in the film 'Due volte nella vita', directed by Emanuela Giordano. In 1999, she played Uga Fantozzi in 'Fantozzi 2000 - La clonazione'. In 2005, she participated in the screenplay for the film 'Gli occhi dell'altro', directed by Gianpaolo Tescari."
            }
        },
        fr: {
            back: "< RETOUR À LA MAISON",
            title: "SALON",
            desc: "Le lieu de rencontre, où l'on discute et l'on écoute.",
            entities: "ENTITÉS PRÉSENTES",
            linkBtn: "LIEN",
            bios: {
                "CRISTÕF": "Cristõf est le projet de musique électroacoustique de Marina Cristofalo, musicienne connue pour le projet dream pop / shoegaze Lilies on Mars. Cristõf pousse sa recherche vers une exploration radicale du son, le traitant comme une matière vivante et une force expressive.",
                "NO LUCIFER": "No Lucifer est un groupe alt-rock de Rome. Guitares superposées, voix directe mais distante et rythme essentiel. Le son fusionne l'alt-rock des années 90 avec des teintes post-punk sombres. Influences : Slint, Interpol, Catherine Wheel, Protomartyr.",
                "LE CAPRE A SONAGLI": "Originaires de Bergame, le groupe a toujours exploré les territoires stoner folk, sans renoncer à plonger les mains dans la psychédélie, en adoptant des rythmes tribaux et tout ce que signifie le punk, entre grooves obsédés et dérives rock schizophréniques. Actif depuis 2011, il a derrière lui une longue carrière faite de tournées, de disques et de récompenses. En 2023, ils publient l'EP 'Funeral Rave Party' qui marque un nouveau chemin, cohérent avec le précédent, fait de grooves afrobeat d'inspiration techno et de punk aliénant. Le 31 janvier 2025 sort 'Cream the Green Butter', suivi le 28 mars par 'Cadillac and Unicorn' et le 29 août par 'Uroboro Express' : trois singles inédits nés sous le signe de Carosello 2084 MHz, leur nouvelle narration en chansons, éclats fous d'un futur dystopique.",
                "FISHEYE": "Andrea Pesce, alias Fisheye, est un artiste éclectique qui traverse différents univers sonores en tant que pianiste, compositeur, arrangeur et producteur artistique. Diplômé en piano, il voyage immédiatement entre différents mondes musicaux. Il est passionné par les instruments à clavier de toutes sortes, à travers une recherche sonore qui caractérise chacune de ses collaborations discographiques et live. En tant que producteur, arrangeur et musicien – avec Federico Zampaglione et Luigi Pulcinelli – il a fait partie du groupe Tiromancino de 2002 à 2005. Avec Zampaglione, il est l'auteur du single primé 'Per me è importante', resté longtemps numéro un au classement.",
                "DODI CONTI": "Née en Argentine, elle est actrice professionnelle depuis 1998. Ses débuts à la télévision ont eu lieu dans l'émission 'Macao', réalisée par Gianni Boncompagni. En 1998, elle joue le rôle principal dans le film 'Due volte nella vita', réalisé par Emanuela Giordano. En 1999, elle incarne Uga Fantozzi dans 'Fantozzi 2000 - La clonazione'. En 2005, elle a participé au scénario du film 'Gli occhi dell'altro', réalisé par Gianpaolo Tescari."
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
        { name: "CRISTÕF", img: "assets/images/cristof.png", link: "https://www.instagram.com/cristof_with_tilde_on_the_o/" },
        { name: "NO LUCIFER", img: "assets/images/nolucifer.png", link: "https://www.instagram.com/noluciferband/" },
        { name: "LE CAPRE A SONAGLI", img: "assets/images/capre.jpg", link: "https://www.instagram.com/lecapreasonagli/" },
        { name: "FISHEYE", img: "assets/images/fisheye.png", link: "https://www.instagram.com/andrea_fish_pesce/" },
        { name: "DODI CONTI", img: "assets/images/dodi.png", link: "https://www.instagram.com/dodi1960/" }
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
