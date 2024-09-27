document.addEventListener('DOMContentLoaded', () => {
    // Gestione del menu a tendina
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileMenu = document.querySelector('.mobile-menu');

    hamburgerMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
    });

    // Funzione Slideshow con fade in/fade out
    let slideIndex = 0;
    const slides = document.querySelectorAll('.slide');

    function showSlides() {
        slides.forEach((slide) => {
            slide.classList.remove('active');
        });
        slideIndex++;
        if (slideIndex > slides.length) {
            slideIndex = 1;
        }
        slides[slideIndex - 1].classList.add('active');
        setTimeout(showSlides, 4000); // Cambia immagine ogni 4 secondi
    }

    showSlides();

    // Gestione dell'animazione del testo nella sezione "Visione"
    const visioneSection = document.getElementById('visione');
    const animatedTexts = document.querySelectorAll('.animated-text');
    let hasTextAppeared = false;

    function playVisioneScript() {
        if (!hasTextAppeared) {
            animatedTexts.forEach((text, index) => {
                text.style.animationDelay = `${index * 1.3}s`; // Modificato a 1.3s come richiesto
                text.style.animationPlayState = 'running';
            });
            hasTextAppeared = true;
        }
    }

    // Event listener per il click sul link 'Visione'
    const visioneLink = document.querySelector('a[href="#visione"]');
    visioneLink.addEventListener('click', (e) => {
        e.preventDefault();
        visioneSection.scrollIntoView({ behavior: 'smooth' });
        playVisioneScript();
    });

    // Funzione per controllare se un elemento è parzialmente visibile nel viewport
    function isPartiallyVisible(el) {
        const rect = el.getBoundingClientRect();
        const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
        const windowWidth = (window.innerWidth || document.documentElement.clientWidth);

        const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
        const horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);

        return (vertInView && horInView);
    }

    // Funzione per controllare la visibilità della sezione 'Visione'
    function checkVisioneSection() {
        if (isPartiallyVisible(visioneSection)) {
            playVisioneScript();
            window.removeEventListener('scroll', checkVisioneSection);
        }
    }

    // Aggiungi l'event listener per lo scroll
    window.addEventListener('scroll', checkVisioneSection);

    // Controlla anche al caricamento della pagina nel caso la sezione sia già visibile
    checkVisioneSection();

    // Gestione della navigazione dei progetti
    const projects = [
        { title: 'Fuorirotta e Sentinella', image: 'pics/1.png', link: 'https://www.instagram.com/fuorirotta_e_sentinella/' },
        { title: 'Corasan', image: 'pics/2.png', link: 'https://www.instagram.com/corasanmusic/' },
        { title: 'Carlo Martinelli', image: 'pics/3.png', link: 'https://www.instagram.com/marlocartinelli/' },
        // Aggiungi qui altri progetti secondo necessità
    ];

    let currentProjectIndex = 0;

    const projectTitle = document.getElementById('project-title');
    const projectImage = document.getElementById('project-image');
    const projectLink = document.getElementById('project-link');
    const nextProjectButton = document.getElementById('next-project');

    function updateProject() {
        const project = projects[currentProjectIndex];
        projectTitle.textContent = project.title;
        projectImage.src = project.image;
        projectLink.href = project.link;

        // Reset dell'animazione di fade-in
        projectTitle.style.animation = 'none';
        projectTitle.offsetHeight; // Trigger reflow
        projectTitle.style.animation = null;
    }

    nextProjectButton.addEventListener('click', () => {
        currentProjectIndex = (currentProjectIndex + 1) % projects.length;
        updateProject();
    });

    // Inizializza il primo progetto
    updateProject();
});
