document.addEventListener('DOMContentLoaded', () => {
    // Gestione del menu a tendina
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileMenu = document.querySelector('.mobile-menu');
    const navbar = document.querySelector('.navbar');

    hamburgerMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        hamburgerMenu.classList.toggle('active');
    });

    // Gestione della navbar sticky con sfondo che cambia allo scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Funzione Slideshow con fade in/fade out
    const slides = document.querySelectorAll('.slide');
    let slideIndex = 0;

    function showSlides() {
        slides.forEach((slide) => {
            slide.classList.remove('active');
        });
        slideIndex = (slideIndex + 1) % slides.length;
        slides[slideIndex].classList.add('active');
        setTimeout(showSlides, 5000); // Cambia immagine ogni 5 secondi
    }

    if (slides.length > 0) {
        showSlides();
    }

    // Gestione dell'animazione del testo nella sezione "Visione"
    const visioneSection = document.getElementById('visione');
      const animatedTexts = document.querySelectorAll('.animated-text');

      function playVisioneAnimation() {
          animatedTexts.forEach((text, index) => {
              text.style.opacity = '0';
              text.style.transform = 'translateY(20px)';
              setTimeout(() => {
                  text.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                  text.style.opacity = '1';
                  text.style.transform = 'translateY(0)';
              }, index * 800); // Aumentato l'intervallo per una transizione più evidente
          });
      }

      // Intersection Observer per la sezione "Visione"
      const visioneObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  playVisioneAnimation();
                  visioneObserver.unobserve(entry.target);
              }
          });
      }, { threshold: 0.5 }); // L'animazione inizia quando almeno il 50% della sezione è visibile

      visioneObserver.observe(visioneSection);

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
  const projectContainer = document.getElementById('project-container');
  const dotsContainer = document.querySelector('.dots-container');

  function updateProject() {
      const project = projects[currentProjectIndex];
      projectTitle.textContent = project.title;
      projectImage.src = project.image;
      projectLink.href = project.link;

      // Update dots
      const dots = document.querySelectorAll('.dot');
      dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === currentProjectIndex);
      });
  }

  function nextProject() {
      currentProjectIndex = (currentProjectIndex + 1) % projects.length;
      updateProject();
  }

  function previousProject() {
      currentProjectIndex = (currentProjectIndex - 1 + projects.length) % projects.length;
      updateProject();
  }

  // Create dots
  projects.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.classList.add('dot');
      if (index === 0) dot.classList.add('active');
      dotsContainer.appendChild(dot);
  });

  // Touch events for swipe
  let touchStartX = 0;
  let touchEndX = 0;

  projectContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
  });

  projectContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
  });

  function handleSwipe() {
      const swipeThreshold = 50; // minimum distance for a swipe
      if (touchEndX < touchStartX - swipeThreshold) {
          // Swipe left
          nextProject();
      } else if (touchEndX > touchStartX + swipeThreshold) {
          // Swipe right
          previousProject();
      }
  }

  // Event listener for the next project button
  nextProjectButton.addEventListener('click', nextProject);

  // Initialize first project
  updateProject();

    // Effetto parallasse per gli sfondi
    const parallaxElements = document.querySelectorAll('.parallax-bg');

    function updateParallax() {
        parallaxElements.forEach(element => {
            const scrollPosition = window.pageYOffset;
            const speed = 0.5; // Modifica questo valore per cambiare la velocità dell'effetto
            element.style.backgroundPositionY = `${scrollPosition * speed}px`;
        });
    }

    window.addEventListener('scroll', updateParallax);

    // Animazione di fade-in per gli elementi quando entrano nel viewport
    const fadeElements = document.querySelectorAll('.fade-in');
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const fadeInObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    fadeElements.forEach(element => {
        fadeInObserver.observe(element);
    });

    // Scroll fluido per i link interni
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }

            // Chiudi il menu mobile se aperto
            if (mobileMenu.classList.contains('active')) {
                mobileMenu.classList.remove('active');
                hamburgerMenu.classList.remove('active');
            }
        });
    });

    // Inizializza EmailJS con la tua public key
(function(){
    emailjs.init("5IpJuSPq0RVnQR-1h"); // La tua public key
})();

// Inizializza EmailJS con la tua public key
(function(){
    emailjs.init("5IpJuSPq0RVnQR-1h"); // La tua public key
})();

// Gestione del form di contatto
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Invia il form utilizzando EmailJS
        emailjs.sendForm('service_frotjrg', 'template_c2ci6wn', contactForm)
            .then((result) => {
                console.log(result.text);
                alert('Grazie per il tuo messaggio! Ti risponderemo presto.');
                contactForm.reset();
            }, (error) => {
                console.log(error.text);
                alert('La casella postale della casa è piena, aspettaci o scrivici su instagram');
            });
    });
}



});
