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
                text.style.animationDelay = `${index * 2}s`;
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
});
