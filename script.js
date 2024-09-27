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

// Funzione per attivare l'animazione una volta che la sezione "Visione" è visibile
let hasTextAppeared = false;

window.addEventListener('scroll', () => {
    const visioneSection = document.querySelector('#visione').getBoundingClientRect().top;

    // Se la sezione "Visione" è visibile a metà schermo, avvia l'animazione
    if (visioneSection < window.innerHeight / 2 && !hasTextAppeared) {
        document.querySelectorAll('.animated-text').forEach((text) => {
            text.style.animationPlayState = 'running';
        });
        hasTextAppeared = true; // Evita che l'animazione si ripeta più volte
    }
});
