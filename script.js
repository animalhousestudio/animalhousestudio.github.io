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

// Ottieni l'elemento della sezione "Visione"
const visioneSection = document.getElementById('visione');

// Variabile per controllare se l'animazione è già stata eseguita
let hasTextAppeared = false;

// Aggiungi un event listener al pulsante o al link che porta alla sezione "Visione"
const visioneLink = document.querySelector('a[href="#visione"]');
visioneLink.addEventListener('click', () => {
    // Ritarda l'esecuzione per assicurarsi che la sezione sia visibile
    setTimeout(playVisioneScript, 100); // Ritardo di 100 ms
});

// Aggiungi un event listener allo scroll della pagina
window.addEventListener('scroll', checkVisioneSection);

// Funzione per eseguire lo script della sezione "Visione"
function playVisioneScript() {
    if (!hasTextAppeared) { // Controlla se l'animazione è già stata eseguita
        document.querySelectorAll('.animated-text').forEach((text) => {
            text.style.animationPlayState = 'running';
        });
        hasTextAppeared = true; // Imposta a true per evitare ripetizioni
    }
}

// Funzione per controllare se l'utente ha raggiunto la sezione "Visione"
function checkVisioneSection() {
    const visioneSectionTop = visioneSection.getBoundingClientRect().top;

    // Controlla se la sezione "Visione" è visibile sullo schermo
    if (visioneSectionTop <= window.innerHeight && visioneSectionTop >= 0) {
        playVisioneScript(); // Esegui lo script della sezione "Visione"

        // Rimuovi l'event listener per evitare esecuzioni multiple
        window.removeEventListener('scroll', checkVisioneSection);
    }
}
