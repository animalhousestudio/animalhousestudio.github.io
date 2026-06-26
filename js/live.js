// INSERISCI QUI L'URL CHE HAI COPIATO DA "PUBBLICA SUL WEB"
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTSBgZxRZHGLY6ngY3hEQAMvtrk4UyobSVnPee60CyFqGCg2inmkAjizNWvDzjBUvCasMoHC67TDmum/pub?gid=0&single=true&output=csv';

const datesContainer = document.getElementById('dates-list');

async function fetchDates() {
    try {
        const response = await fetch(SHEET_URL);
        const data = await response.text();

        // Trasformiamo il CSV in un array di oggetti
        // Dividiamo per righe e poi per virgole
        const rows = data.split('\n').slice(0); // Usa .slice(1) se hai messo le intestazioni nella prima riga

        rows.forEach((row, index) => {
            const columns = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Regex per gestire virgole nel testo

            if (columns.length >= 2) {
                const dateText = columns[0].replace(/"/g, '').trim();
                const eventText = columns[1].replace(/"/g, '').trim();
                const linkUrl = columns[2] ? columns[2].replace(/"/g, '').trim() : '#';

                const dateElement = document.createElement('a');
                dateElement.href = linkUrl;
                dateElement.target = "_blank"; // Apre in una nuova scheda
                dateElement.className = 'date-item';
                dateElement.innerHTML = `<span class="date-highlight">${dateText}</span> - ${eventText}`;

                datesContainer.appendChild(dateElement);

                // Animazione a cascata
                setTimeout(() => {
                    dateElement.classList.add('visible');
                }, index * 200);
            }
        });
    } catch (error) {
        console.error('Errore nel caricamento delle date:', error);
        datesContainer.innerHTML = "<p style='color:white;'>Caricamento trasmissioni in corso...</p>";
    }
}

window.onload = fetchDates;
