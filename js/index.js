document.addEventListener('DOMContentLoaded', function() {

    const landingScreen     = document.getElementById('landing-screen');
    const introLayer        = document.getElementById('intro-layer');
    const mainLayer         = document.getElementById('main-layer');
    const toolbar           = document.getElementById('toolbar');
    const introVideo        = document.getElementById('intro-video');
    const bgVideo           = document.getElementById('bgVideo');
    const introLogo         = document.getElementById('intro-logo');
    const introStick        = document.getElementById('intro-stick');
    const houseImage        = document.getElementById('houseImage');
    const houseWrapper      = document.getElementById('houseWrapper');
    const houseSvg          = document.querySelector('.house-svg-map');
    const btnLight          = document.getElementById('btn-light');
    const flashOverlay      = document.getElementById('light-flash-overlay');
    const audio             = document.getElementById('logoAudio');
    const btnAudio          = document.getElementById('btn-audio');
    const roomModal         = document.getElementById('roomModal');
    const roomMenuBox       = document.getElementById('roomMenuBox');
    const modalTitle        = document.getElementById('modalTitle');
    const modalList         = document.getElementById('modalList');
    const visionModal       = document.getElementById('visionModal');
    const visionMenuBox     = document.querySelector('.vision-box');
    const typewriter        = document.getElementById('typewriter');
    const btnVision         = document.getElementById('btn-vision');
    const btnIT             = document.getElementById('btn-it');
    const btnEN             = document.getElementById('btn-en');
    const btnFR             = document.getElementById('btn-fr');
    const kittenTooltip     = document.getElementById('kitten-tooltip');
    const kittenTooltipLink = document.getElementById('kitten-tooltip-link');

    const btnRoomsMenu      = document.getElementById('btn-rooms-menu');
    const roomsDropdown     = document.getElementById('rooms-dropdown');

    const tutorialOverlay   = document.getElementById('tutorial-overlay');
    const tutorialVideo     = document.getElementById('tutorial-video');
    const closeTutorial     = document.getElementById('close-tutorial');
    const tutorialText      = document.getElementById('tutorial-text');

    let kittensStarted = false;
    let lightTimer;
    let tutorialTimeout;
    let tutorialPlaying = false;
    let typeInterval;

    let lightsOn = sessionStorage.getItem('lightsOn') === 'true';

    // ── GESTIONE LINGUE (I18N) ───────────────────────────────
    const i18n = {
        it: {
            tagline: 'ANIMAL HOUSE È QUELLO CHE È SE TI PIACE',
            vision: 'VISIONE',
            touch: 'CONTATTO',
            falco: 'FALCO',
            rooms: {
                'OSSERVATORIO': 'Osservatorio',
                'SALOTTO': 'Salotto',
                'CUCINA': 'Cucina',
                'CANTINA': 'Cantina',
                'GIARDINO': 'Giardino',
                'CAMPETTO': 'Campetto'
            },
            tutIntro: "animal house è la casa di un gruppo di artisti",
            tutPart1: "per scoprirli accendi la luce ed esplora",
            tutPart2: "cliccando sugli elementi e poi sui nomi",
            visionText: "TOCCA I POSTI DELLA CASA PER SCOPRIRE AMBIENTI E ANIMALI.\n\nANIMAL HOUSE È UNA CASA VIRTUALE E FISICA DOVE ARTISTI COLLABORANO IN MODO SELVAGGIO, SU CONNESSIONI EMOTIVE E UMANE. ACCOGLIAMO COSE LEGGERE O COSE PESANTI, A SECONDA DELLA SITUAZIONE. SE VUOI, TOCCACI..\n\n[ TOCCACI ]",
            toccaci: "[ TOCCACI ]"
        },
        en: {
            tagline: 'ANIMAL HOUSE IS WHAT IT IS THAT YOU LIKE',
            vision: 'VISION',
            touch: 'TOUCH',
            falco: 'HAWK',
            rooms: {
                'OSSERVATORIO': 'Observatory',
                'SALOTTO': 'Living Room',
                'CUCINA': 'Kitchen',
                'CANTINA': 'Cellar',
                'GIARDINO': 'Garden',
                'CAMPETTO': 'Court'
            },
            tutIntro: "animal house is the home of a group of artists",
            tutPart1: "to discover them turn on the light and explore",
            tutPart2: "by clicking on the elements and then on the names",
            visionText: "TOUCH THE SPOTS OF THE HOUSE TO DISCOVER ROOMS AND ANIMALS.\n\nANIMAL HOUSE IS A VIRTUAL AND PHYSICAL HOME WHERE ARTISTS COLLABORATE WILDLY, BASED ON EMOTIONAL AND HUMAN CONNECTIONS. WE WELCOME LIGHT OR HEAVY THINGS, DEPENDING ON THE SITUATION. IF YOU WANT, TOUCH US...\n\n[ TOUCH US ]",
            toccaci: "[ TOUCH US ]"
        },
        fr: {
            tagline: "ANIMAL HOUSE EST CE QUE C'EST, SI ÇA TE PLAÎT",
            vision: 'VISION',
            touch: 'CONTACT',
            falco: 'FAUCON',
            rooms: {
                'OSSERVATORIO': 'Observatoire',
                'SALOTTO': 'Salon',
                'CUCINA': 'Cuisine',
                'CANTINA': 'Cave',
                'GIARDINO': 'Jardin',
                'CAMPETTO': 'Terrain'
            },
            tutIntro: "animal house est la maison d'un groupe d'artistes",
            tutPart1: "pour les découvrir allume la lumière et explore",
            tutPart2: "en cliquant sur les éléments puis sur les noms",
            visionText: "TOUCHE LES ENDROITS DE LA MAISON POUR DÉCOUVRIR LES PIÈCES ET LES ANIMAUX.\n\nANIMAL HOUSE EST UNE MAISON VIRTUELLE ET PHYSIQUE OÙ LES ARTISTES COLLABORENT DE MANIÈRE SAUVAGE, SUR DES CONNEXIONS ÉMOTIONNELLES ET HUMAINES. NOUS ACCUEILLONS DES CHOSES LÉGÈRES OU LOURDES, SELON LA SITUATION. SI TU VEUX, TOUCHE-NOUS...\n\n[ TOUCHE-NOUS ]",
            toccaci: "[ TOUCHE-NOUS ]"
        }
    };

    const langs = ['it', 'en', 'fr'];
    let currentLang = localStorage.getItem('preferredLanguage') || 'it';
    if (!langs.includes(currentLang)) currentLang = 'it';
    let visionLang = currentLang;

    function setLanguage(lang) {
        currentLang = lang;
        visionLang = lang;
        document.documentElement.lang = lang;
        localStorage.setItem('preferredLanguage', lang);

        // Update Landing
        document.querySelector('.landing-tagline').textContent = i18n[lang].tagline;
        document.getElementById('vision-link').textContent = i18n[lang].vision;
        document.getElementById('touch-link').textContent = i18n[lang].touch;
        
        // Aggiorna lo stato visivo dei nuovi bottoni in home
        document.querySelectorAll('.main-lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });

        // Update UI Elements
        const hawkTooltip = document.getElementById('hawk-tooltip');
        if (hawkTooltip) hawkTooltip.textContent = i18n[lang].falco;
        
        document.querySelectorAll('.room-dropdown-item').forEach(el => {
            const key = el.getAttribute('data-room-key');
            if (key) el.textContent = i18n[lang].rooms[key];
        });

        // Update modal buttons if active
        btnIT.classList.toggle('active', lang === 'it');
        btnEN.classList.toggle('active', lang === 'en');
        btnFR.classList.toggle('active', lang === 'fr');
    }

    // Nuovo event listener per i bottoni in homepage
    document.querySelectorAll('.main-lang-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setLanguage(e.target.getAttribute('data-lang'));
        });
    });

    // Initialize language
    setLanguage(currentLang);


    // ── DATI STANZE ──────────────────────────────────────────
    const roomData = {
        'OSSERVATORIO': { artists: ['CORASAN', 'CARLO MARTINELLI', 'ANTHONIO', 'VERA DI LECCE', 'FALCO'], side: 'right' },
        'SALOTTO':      { artists: ['CRISTÕF', 'NO LUCIFER', 'LE CAPRE A SONAGLI', 'FISHEYE', 'DODI CONTI'], side: 'left' },
        'CUCINA':       { artists: ['MILKO MALTOSIO', 'CHOCOLATE AND RECORDS'], side: 'right' },
        'GIARDINO':     { artists: ['MARLA', 'HAMAKA', 'MIRIAM FORNARI', 'ANIMAL HOUSE', 'NOME BAND A PIACERE'], side: 'right' },
        'CANTINA':      { artists: ['BORSTAL', 'LEMON LIGHTS', 'LORENZO BENZONI', 'ROME IN REVERSE', 'LA BANDA'], side: 'left' },
        'CAMPETTO':     { artists: ['FUORIROTTA E SENTINELLA', 'KARENINA', 'ZEUS FEBO', 'QVINTO'], side: 'left' }
    };

    const roomWaypoints = {
        'OSSERVATORIO': [{x: 56, y: 26}, {x: 60, y: 31}, {x: 48, y: 28}],
        'SALOTTO':      [{x: 57, y: 46}, {x: 60, y: 50}, {x: 45, y: 50}],
        'CUCINA':       [{x: 45, y: 62}, {x: 55, y: 65}, {x: 35, y: 62}],
        'CANTINA':      [{x: 40, y: 75}, {x: 44, y: 78}, {x: 35, y: 75}],
        'GIARDINO':     [{x: 25, y: 81}, {x: 35, y: 85}, {x: 40, y: 84}],
        'CAMPETTO':     [{x: 75, y: 80}, {x: 82, y: 82}, {x: 65, y: 84}]
    };

    const catRooms = ['GIARDINO', 'CAMPETTO'];
    const occupiedWaypoints = new Set();
    const artistToRoomMap = {};
    const allArtists = [];
    for (const [room, data] of Object.entries(roomData)) {
        data.artists.forEach(artist => {
            artistToRoomMap[artist] = room.toLowerCase() + '.html';
            allArtists.push(artist);
        });
    }

    // Aggiorna lo z-index degli elementi in base alla loro posizione verticale.
    // Throttled (~100ms) invece di ogni frame per evitare layout thrashing.
    const depthSelector = '.kitten-unit, #marla-char, #dodi-char, #milko-char, #hamaka-char, #corasan-char, #febo-char, #marlo-char, #fish-char, #anthonio-char, #anima-char';
    function updateDepth() {
        const sortables = document.querySelectorAll(depthSelector);
        sortables.forEach(el => {
            const rect = el.getBoundingClientRect();
            el.style.zIndex = Math.floor(rect.bottom);
        });
    }
    updateDepth();
    setInterval(updateDepth, 100);

    btnRoomsMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        roomsDropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        roomsDropdown.classList.remove('active');
    });

    function syncSvgToImage() {
        if (mainLayer.style.display === 'none') return;
        const imgRect  = houseImage.getBoundingClientRect();
        const wrapRect = houseWrapper.getBoundingClientRect();
        houseSvg.style.left   = (imgRect.left - wrapRect.left) + 'px';
        houseSvg.style.top    = (imgRect.top  - wrapRect.top)  + 'px';
        houseSvg.style.width  = imgRect.width  + 'px';
        houseSvg.style.height = imgRect.height + 'px';
    }

    function showHouseDirectly() {
        landingScreen.style.display = 'none';
        introLayer.style.display    = 'none';
        mainLayer.style.display = 'flex';
        mainLayer.style.opacity = '1';
        
        if (bgVideo) bgVideo.pause();
        if (introVideo) introVideo.pause();
        syncSvgToImage();
        updateLightUI();

        // Controllo per il Tutorial
        if (!sessionStorage.getItem('tutorialSeen')) {
            tutorialOverlay.classList.add('active');
            
            // Set initial translated tutorial text
            tutorialPlaying = false;
            tutorialText.textContent = i18n[currentLang].tutIntro;
            tutorialText.dataset.currentText = i18n[currentLang].tutIntro;
            tutorialText.style.opacity = 1;

            if (tutorialVideo) {
                tutorialVideo.currentTime = 0;
                tutorialVideo.pause();
                
                tutorialTimeout = setTimeout(() => {
                    tutorialPlaying = true;
                    tutorialVideo.play().catch(e => console.log('Tutorial video play error:', e));
                }, 2000);
            }
        } else {
            activateHouseFeatures();
        }
    }

    function activateHouseFeatures() {
        toolbar.style.opacity   = '1';
        toolbar.classList.add('active');
        toolbar.style.pointerEvents = 'auto';
        document.body.style.overflowY = 'auto';
        if (!kittensStarted) {
            startKittens();
            startAnimaLogic();
            kittensStarted = true;
        }
        startLightReminder();
    }

    if (sessionStorage.getItem('houseEntered') === 'true') {
        showHouseDirectly();
    } else {
        if (bgVideo) bgVideo.play().catch(e => console.log('Autoplay landing:', e));
    }

    function startExperience(e) {
        e.preventDefault();
        sessionStorage.setItem('houseEntered', 'true');
        landingScreen.style.opacity = '0';
        setTimeout(() => {
            landingScreen.style.display = 'none';
            if (bgVideo) bgVideo.pause();
        }, 1000);
        introLayer.style.display = 'flex';
        setTimeout(() => { introLayer.style.opacity = '1'; }, 50);
        introLogo.classList.add('anim-logo');
        introStick.classList.add('anim-stick');
        if (introVideo) { introVideo.play().catch(err => console.log('Intro video:', err)); }
        
        setTimeout(() => {
            introLayer.classList.add('fade-out');
            showHouseDirectly();
        }, 3000);
    }

    document.getElementById('landing-trigger').addEventListener('click', startExperience);
    document.getElementById('vision-link').addEventListener('click', startExperience);

    // ── GESTIONE AUDIO ───────────────────────────────────────
    let isPlaying = false;
    btnAudio.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPlaying) { audio.pause(); btnAudio.style.opacity = '0.5'; }
        else           { audio.play();  btnAudio.style.opacity = '1'; }
        isPlaying = !isPlaying;
    });

    // ── GESTIONE LUCI ────────────────────────────────────────
    function updateLightUI() {
        houseImage.src = lightsOn ? 'assets/images/casa2.jpg' : 'assets/images/casa.jpg';
        if (lightsOn) {
            btnLight.classList.remove('needs-light');
            document.body.classList.remove('lights-off');
            clearTimeout(lightTimer);
        } else {
            document.body.classList.add('lights-off');
        }
    }
    function toggleLight() {
        lightsOn = !lightsOn;
        sessionStorage.setItem('lightsOn', lightsOn);
        updateLightUI();
        flashOverlay.classList.add('flash-active');
        setTimeout(() => flashOverlay.classList.remove('flash-active'), 150);
    }
    function startLightReminder() {
        if (!lightsOn) {
            lightTimer = setTimeout(() => {
                if (!lightsOn) btnLight.classList.add('needs-light');
            }, 5000);
        }
    }
    updateLightUI();
    btnLight.addEventListener('click', (e) => { e.stopPropagation(); toggleLight(); });

    // ── MODALI E VISION ──────────────────────────────────────
    document.querySelectorAll('.house-svg-map polygon').forEach(zone => {
        zone.addEventListener('click', function(e) { e.stopPropagation(); openRoom(this.getAttribute('data-room')); });
    });

    function openRoom(name) {
        const data = roomData[name]; if (!data) return;
        // Traduce il nome della stanza usando la lingua corrente
        modalTitle.innerHTML = `<a href="${name.toLowerCase()}.html">${i18n[currentLang].rooms[name] || name}</a>`;
        modalList.innerHTML = '';
        data.artists.forEach(artist => {
            const li = document.createElement('li');
            const a  = document.createElement('a');
            a.href = artistToRoomMap[artist]; a.textContent = artist;
            li.appendChild(a); modalList.appendChild(li);
        });
        roomMenuBox.classList.remove('menu-pos-left','menu-pos-right');
        roomMenuBox.classList.add(data.side === 'left' ? 'menu-pos-left' : 'menu-pos-right');
        roomModal.classList.add('active');
    }

    [roomModal, visionModal].forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                roomModal.classList.remove('active');
                visionModal.classList.remove('active');
                stopTypewriter();
            }
        });
    });

    btnVision.addEventListener('click', (e) => {
        e.stopPropagation();
        visionLang = currentLang; // Apre la modal con la lingua corrente
        btnIT.classList.toggle('active', visionLang === 'it');
        btnEN.classList.toggle('active', visionLang === 'en');
        btnFR.classList.toggle('active', visionLang === 'fr');
        visionModal.classList.add('active');
        startTypewriter();
    });

    function setVisionLang(lang) {
        visionLang = lang;
        btnIT.classList.toggle('active', lang==='it');
        btnEN.classList.toggle('active', lang==='en');
        btnFR.classList.toggle('active', lang==='fr');
        startTypewriter();
    }
    
    btnIT.addEventListener('click', (e) => { e.stopPropagation(); setVisionLang('it'); });
    btnEN.addEventListener('click', (e) => { e.stopPropagation(); setVisionLang('en'); });
    btnFR.addEventListener('click', (e) => { e.stopPropagation(); setVisionLang('fr'); });

    function startTypewriter() {
        clearInterval(typeInterval); typewriter.innerHTML = '';
        const text = i18n[visionLang].visionText;
        let i = 0;
        typeInterval = setInterval(() => {
            if (i < text.length) { typewriter.innerHTML += text.charAt(i); i++; }
            else { clearInterval(typeInterval); finalizeText(); }
        }, 30);
    }
    function stopTypewriter() { clearInterval(typeInterval); }

    function finalizeText() {
        const text = i18n[visionLang].visionText;
        const toccaciKey = i18n[visionLang].toccaci;
        typewriter.innerHTML = text.replace(toccaciKey, `<span id="toccaci-trigger" style="color:#d65d0e;font-weight:bold;cursor:pointer;">${toccaciKey}</span>`);

        document.getElementById('toccaci-trigger').addEventListener('click', () => {
            visionModal.classList.remove('active');
            stopTypewriter();
            if (!lightsOn) {
                toggleLight();
            } else {
                flashOverlay.classList.add('flash-active');
                setTimeout(() => flashOverlay.classList.remove('flash-active'), 150);
            }
        });
    }
    typewriter.addEventListener('click', () => { clearInterval(typeInterval); finalizeText(); });

    // ── GESTIONE TUTORIAL (LOGICA & TESTI DINAMICI) ──────────
    closeTutorial.addEventListener('click', () => {
        tutorialOverlay.classList.remove('active');
        if (tutorialTimeout) clearTimeout(tutorialTimeout);
        if (tutorialVideo) tutorialVideo.pause();
        sessionStorage.setItem('tutorialSeen', 'true');
        activateHouseFeatures();
    });

    if (tutorialVideo) {
        tutorialVideo.addEventListener('timeupdate', () => {
            if (!tutorialPlaying) return;

            const t = tutorialVideo.currentTime;
            let newText = "";
            
            if (t >= 0 && t < 5) {
                newText = i18n[currentLang].tutPart1;
            } else if (t >= 7 && t < 12) {
                newText = i18n[currentLang].tutPart2;
            }

            if (tutorialText.dataset.currentText !== newText) {
                tutorialText.style.opacity = 0;
                setTimeout(() => {
                    tutorialText.textContent = newText;
                    tutorialText.dataset.currentText = newText;
                    tutorialText.style.opacity = (newText === "") ? 0 : 1;
                }, 300);
            }
        });
    }

    // ── LOGICA PERSONAGGI E GATTINI ──────────────────────────
    function assignIdentity(kitten) {
        const excludedArtists = ['MARLA', 'DODI CONTI', 'MILKO MALTOSIO', 'HAMAKA', 'CORASAN', 'ZEUS FEBO', 'CARLO MARTINELLI', 'FISHEYE', 'ANTHONIO'];
        const validArtists = allArtists.filter(a => !excludedArtists.includes(a));
        const randomArtist = validArtists[Math.floor(Math.random() * validArtists.length)];
        kitten.dataset.artist   = randomArtist;
        kitten.dataset.roomLink = artistToRoomMap[randomArtist];
        kitten.style.backgroundImage = `url('assets/images/CatRecolors${Math.floor(Math.random()*3)+1}.png')`;
        const baseCols = [0,3,6,9];
        kitten.style.setProperty('--base-col', baseCols[Math.floor(Math.random()*baseCols.length)]);
    }

    let spriteFrame = 0;
    setInterval(() => {
        spriteFrame = (spriteFrame + 1) % 4;
        document.documentElement.style.setProperty('--global-sprite-frame', [0,1,2,1][spriteFrame]);
    }, 200);

    document.addEventListener('click', () => {
        kittenTooltip.classList.remove('active');
        const ht = document.getElementById('hawk-tooltip');
        if (ht) ht.classList.remove('active');
    });

    function startAnimaLogic() {
        const animaChar = document.getElementById('anima-char');
        if (!animaChar) return;

        let isRightSide = true;
        let animaX = 85;
        let animaY = 20;

        animaChar.addEventListener('click', (e) => {
            e.stopPropagation();
            kittenTooltipLink.textContent = 'ANIMAL HOUSE';
            kittenTooltipLink.href = 'giardino.html';
            kittenTooltip.style.left = animaChar.style.left;
            kittenTooltip.style.top  = animaChar.style.top;
            kittenTooltip.classList.add('active');
        });

        function performAnimaMove() {
            const duration = Math.random() * 3000 + 2000;
            animaChar.style.transition = `left ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), top ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s ease-out, opacity 0.2s`;

            animaX += (Math.random() - 0.5) * 12;
            animaY += (Math.random() - 0.5) * 10;

            if (isRightSide) {
                animaX = Math.max(75, Math.min(95, animaX));
                animaY = Math.max(5, Math.min(45, animaY));
            } else {
                animaX = Math.max(2, Math.min(25, animaX));
                animaY = Math.max(5, Math.min(40, animaY));
            }

            animaChar.style.left = animaX + '%';
            animaChar.style.top = animaY + '%';

            if (Math.random() > 0.6) {
                animaChar.classList.toggle('anima-reflect');
            }

            if (Math.random() > 0.7) {
                setTimeout(() => {
                    animaChar.classList.add('anima-glitch');

                    setTimeout(() => {
                        animaChar.style.opacity = '0';
                        animaChar.classList.remove('anima-glitch');

                        setTimeout(() => {
                            isRightSide = Math.random() > 0.5;

                            if (isRightSide) {
                                animaX = 75 + Math.random() * 15;
                                animaY = 10 + Math.random() * 25;
                            } else {
                                animaX = 5 + Math.random() * 15;
                                animaY = 10 + Math.random() * 20;
                            }

                            animaChar.style.transition = 'none';
                            animaChar.style.left = animaX + '%';
                            animaChar.style.top = animaY + '%';
                            animaChar.classList.remove('anima-reflect');

                            setTimeout(() => {
                                animaChar.style.transition = 'opacity 0.6s ease';
                                animaChar.style.opacity = '1';
                                setTimeout(performAnimaMove, 800);
                            }, 50);
                        }, 1200);

                    }, 400);

                }, duration * 0.8);

            } else {
                setTimeout(performAnimaMove, duration);
            }
        }

        setTimeout(performAnimaMove, 1500);
    }

    function startKittens() {
        const characters = [
            { id: 'marla-char', name: 'MARLA', artist: 'MARLA' },
            { id: 'dodi-char', name: 'DODI', artist: 'DODI CONTI' },
            { id: 'milko-char', name: 'MILKO', artist: 'MILKO MALTOSIO' },
            { id: 'hamaka-char', name: 'HAMAKA', artist: 'HAMAKA' },
            { id: 'corasan-char', name: 'CORASAN', artist: 'CORASAN' },
            { id: 'febo-char', name: 'ZEUS FEBO', artist: 'ZEUS FEBO' },
            { id: 'marlo-char', name: 'CARLO MARTINELLI', artist: 'CARLO MARTINELLI' },
            { id: 'fish-char',  name: 'FISHEYE', artist: 'FISHEYE' },
            { id: 'anthonio-char', name: 'ANTHONIO', artist: 'ANTHONIO' }
        ];

        characters.forEach(charData => {
            const charEl = document.getElementById(charData.id);
            if (charEl) {
                charEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    kittenTooltipLink.textContent = charData.name;
                    kittenTooltipLink.href = artistToRoomMap[charData.artist] || '#';
                    kittenTooltip.style.left = charEl.style.left;
                    kittenTooltip.style.top  = charEl.style.top;
                    kittenTooltip.classList.add('active');
                });
            }
        });

        const kittens = document.querySelectorAll('.kitten-unit');
        const shuffledRooms = [...catRooms].sort(() => 0.5 - Math.random());
        kittens.forEach((kitten, i) => {
            const initialRoom  = shuffledRooms[i % shuffledRooms.length];
            const initialPoint = 0;
            occupiedWaypoints.add(`${initialRoom}-${initialPoint}`);
            kitten.dataset.room  = initialRoom;
            kitten.dataset.point = initialPoint;
            assignIdentity(kitten);
            kitten.style.left = roomWaypoints[initialRoom][initialPoint].x + '%';
            kitten.style.top  = roomWaypoints[initialRoom][initialPoint].y + '%';
            kitten.addEventListener('click', (e) => {
                e.stopPropagation();
                kittenTooltipLink.textContent = kitten.dataset.artist;
                kittenTooltipLink.href = kitten.dataset.roomLink;
                kittenTooltip.style.left = kitten.style.left;
                kittenTooltip.style.top  = kitten.style.top;
                kittenTooltip.classList.add('active');
            });
            animateKitten(kitten);
        });
    }

    function animateKitten(kittenElem) {
        const nextMoveDelay = Math.random() * 5000 + 2000;
        setTimeout(() => {
            const currentRoom     = kittenElem.dataset.room;
            const currentPointIdx = parseInt(kittenElem.dataset.point);
            const shouldTeleport  = Math.random() > 0.6;
            let targetRoom = currentRoom;
            let availablePoints = [];
            if (shouldTeleport) {
                const otherRooms = catRooms.filter(r => r !== currentRoom);
                targetRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];
                roomWaypoints[targetRoom].forEach((pt, idx) => { if (!occupiedWaypoints.has(`${targetRoom}-${idx}`)) availablePoints.push(idx); });
            } else {
                roomWaypoints[currentRoom].forEach((pt, idx) => { if (idx !== currentPointIdx && !occupiedWaypoints.has(`${currentRoom}-${idx}`)) availablePoints.push(idx); });
            }
            if (availablePoints.length === 0) { setTimeout(() => animateKitten(kittenElem), 2000); return; }
            const targetPointIdx = availablePoints[Math.floor(Math.random() * availablePoints.length)];
            const target  = roomWaypoints[targetRoom][targetPointIdx];
            const current = roomWaypoints[currentRoom][currentPointIdx];
            occupiedWaypoints.delete(`${currentRoom}-${currentPointIdx}`);
            occupiedWaypoints.add(`${targetRoom}-${targetPointIdx}`);
            kittenElem.dataset.room  = targetRoom;
            kittenElem.dataset.point = targetPointIdx;

            const dx = target.x - current.x; const dy = target.y - current.y;
            let row = 0;
            if (Math.abs(dx) > Math.abs(dy)) { row = dx > 0 ? 2 : 1; } else { row = dy > 0 ? 0 : 3; }
            kittenElem.style.setProperty('--row', row);

            if (shouldTeleport) {
                kittenElem.classList.add('teleporting');
                setTimeout(() => {
                    kittenElem.style.left = target.x + '%';
                    kittenElem.style.top  = target.y + '%';
                    setTimeout(() => { kittenElem.classList.remove('teleporting'); animateKitten(kittenElem); }, 1000);
                }, 650);
            } else {
                kittenElem.classList.remove('idle');
                kittenElem.style.left = target.x + '%';
                kittenElem.style.top  = target.y + '%';
                setTimeout(() => { kittenElem.classList.add('idle'); animateKitten(kittenElem); }, 4000);
            }
        }, nextMoveDelay);
    }

    /* ========== HAWK LOGIC ========== */
    const hawkSprite = document.getElementById('hawk-sprite');
    const hawkTooltip = document.getElementById('hawk-tooltip');
    if (hawkSprite) {
        hawkSprite.addEventListener('click', function(e) {
            e.stopPropagation();
            const rect = hawkSprite.getBoundingClientRect();
            const wrap = houseWrapper.getBoundingClientRect();
            hawkTooltip.style.left = ((rect.left - wrap.left + rect.width / 2) / wrap.width * 100) + '%';
            hawkTooltip.style.top = ((rect.top - wrap.top) / wrap.height * 100) + '%';
            hawkTooltip.classList.add('active');
        });
        hawkSprite.addEventListener('animationend', function(e) {
            if (e.animationName === 'hawkFlyAcross') {
                setTimeout(() => {
                    hawkSprite.style.animation = 'none';
                    void hawkSprite.offsetWidth;
                    hawkSprite.style.animation = 'hawkFlyAcross 15s linear 1 forwards';
                }, 1000 + Math.random() * 5000);
            }
        });
    }

    if (houseImage.complete) syncSvgToImage();
    houseImage.addEventListener('load', syncSvgToImage);
    window.addEventListener('resize', syncSvgToImage);
});
