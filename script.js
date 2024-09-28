document.addEventListener('DOMContentLoaded', () => {
    // Gestione del menu a tendina
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileMenu = document.querySelector('.mobile-menu');

    hamburgerMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
    });

    // Gestione della navbar sticky con sfondo che cambia allo scroll
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
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
                text.style.animationDelay = `${index * 1.3}s`;
                text.style.animationPlayState = 'running';
            });
            hasTextAppeared = true;
        }
    }

    window.addEventListener('scroll', () => {
        const rect = visioneSection.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2 && !hasTextAppeared) {
            playVisioneScript();
        }
    });

    // Gestione della navigazione dei progetti
    const projects = [
        { title: 'Fuorirotta e Sentinella', image: 'pics/1.png', link: 'https://www.instagram.com/fuorirotta_e_sentinella/' },
        { title: 'Corasan', image: 'pics/2.png', link: 'https://www.instagram.com/corasanmusic/' },
        { title: 'Carlo Martinelli', image: 'pics/3.png', link: 'https://www.instagram.com/marlocartinelli/' },
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
    }

    nextProjectButton.addEventListener('click', () => {
        currentProjectIndex = (currentProjectIndex + 1) % projects.length;
        updateProject();
    });

    updateProject(); // Inizializza il primo progetto
});
