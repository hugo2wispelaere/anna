// Initialisation de la carte
const map = L.map("map").setView([0, 0], 2);
let currentMarker;
let currentPath;
let itinerary = [];
let timeInterval;

// Ajouter le fond de carte OpenStreetMap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Fonction pour calculer l'heure locale basée sur la longitude
function getLocalTime(longitude) {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const utc = now.getTime();
  const localOffset = Math.round(longitude / 15); // Offset en heures entières

  let localTime = new Date(utc);
  localTime.setHours(now.getHours() + localOffset);
  localTime.setMinutes(minutes);
  localTime.setSeconds(seconds);

  return localTime;
}

// Mettre à jour les heures
function updateTimes(longitude) {
  const localTime = getLocalTime(longitude);
  const franceTime = new Date();

  document.getElementById("localTime").textContent =
    localTime.toLocaleTimeString("fr-FR");
  document.getElementById("franceTime").textContent =
    franceTime.toLocaleTimeString("fr-FR");
}

// Fonction pour convertir une date au format MM/DD/YY en YYYY-MM-DD
function convertDate(dateStr) {
  const [month, day, year] = dateStr.split("/");
  return `20${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Fonction pour gérer la webcam
function toggleWebcam() {
  const container = document.getElementById("webcamContainer");
  const webcamFeed = document.getElementById("webcamFeed");

  if (container.style.display === "none") {
    container.style.display = "block";
    webcamFeed.load();
  } else {
    container.style.display = "none";
    webcamFeed.pause();
  }
}

// Fonction pour définir la date à aujourd'hui
function setToday() {
  const today = new Date();
  const dateInput = document.getElementById("dateSelect");
  const formattedDate = today.toISOString().split("T")[0];

  if (formattedDate < dateInput.min) {
    dateInput.value = dateInput.min;
  } else if (formattedDate > dateInput.max) {
    dateInput.value = dateInput.max;
  } else {
    dateInput.value = formattedDate;
  }

  findLocation();
}

// Fonction pour trouver et afficher la position à une date donnée
async function findLocation() {
  if (timeInterval) {
    clearInterval(timeInterval);
  }

  const selectedDate = document.getElementById("dateSelect").value;
  const statusDiv = document.getElementById("status");

  // Trouver l'emplacement exact qui correspond à la date
  const location = itinerary.find(
    (item) => selectedDate >= item.start && selectedDate < item.end
  );

  if (!location) {
    statusDiv.textContent = "Aucune position trouvée pour cette date";
    return;
  }

  if (currentMarker) map.removeLayer(currentMarker);
  if (currentPath) map.removeLayer(currentPath);

  currentMarker = L.marker([location.latitude, location.longitude])
    .bindPopup(location.lieu)
    .addTo(map);

  map.setView([location.latitude, location.longitude], 6);

  statusDiv.innerHTML = `
        <strong>Position actuelle :</strong> ${location.lieu}<br>
        <strong>Du :</strong> ${new Date(location.start).toLocaleDateString()} 
        <strong>au :</strong> ${new Date(location.end).toLocaleDateString()}<br>
        <strong>Coordonnées :</strong> ${location.latitude}°, ${
    location.longitude
  }°<br>
        <strong>Heure locale :</strong> <span id="localTime">${getLocalTime(
          location.longitude
        ).toLocaleTimeString("fr-FR")}</span><br>
        <strong>Heure en France :</strong> <span id="franceTime">${new Date().toLocaleTimeString(
          "fr-FR"
        )}</span>
    `;

  // Démarrer un nouvel intervalle
  timeInterval = setInterval(() => updateTimes(location.longitude), 1000);

  updateLocationsList(location);
}

// Fonction pour mettre à jour la liste des escales
function updateLocationsList(currentLocation) {
  const container = document.getElementById("locationsList");
  container.innerHTML = itinerary
    .map(
      (location) => `
            <div class="location-item ${
              location.start === currentLocation.start ? "active" : ""
            } 
                                     ${
                                       location.lieu
                                         .toLowerCase()
                                         .includes("en mer")
                                         ? "at-sea"
                                         : ""
                                     }"
                 onclick="selectLocation('${location.start}')"
                 data-start="${location.start}">
                <div>${location.lieu}</div>
                <div class="date-range">
                    ${new Date(location.start).toLocaleDateString()} - 
                    ${new Date(location.end).toLocaleDateString()}
                </div>
            </div>
        `
    )
    .join("");

  // Faire défiler jusqu'à l'élément actif
  const activeElement = document.querySelector(".location-item.active");
  if (activeElement) {
    activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// Fonction pour sélectionner une position spécifique
function selectLocation(date) {
  const location = itinerary.find((item) => item.start === date);
  if (location) {
    document.getElementById("dateSelect").value = date;
    findLocation();
  }
}

// Charger le fichier CSV et initialiser l'application
async function init() {
  try {
    const response = await fetch("data.csv");
    const csvData = await response.text();

    itinerary = csvData
      .split("\n")
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => {
        const [lieu, start, end, latitude, longitude] = line.split(";");
        if (lieu && start && end && latitude && longitude) {
          return {
            lieu: lieu.trim(),
            start: convertDate(start.trim()),
            end: convertDate(end.trim()),
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
          };
        }
      })
      .filter((item) => item);

    if (itinerary.length > 0) {
      const firstDate = itinerary[0].start;
      const lastDate = itinerary[itinerary.length - 1].end;
      const dateInput = document.getElementById("dateSelect");
      dateInput.min = firstDate;
      dateInput.max = lastDate;

      const today = new Date();
      const formattedToday = today.toISOString().split("T")[0];

      if (formattedToday >= firstDate && formattedToday <= lastDate) {
        dateInput.value = formattedToday;
      } else if (formattedToday < firstDate) {
        dateInput.value = firstDate;
      } else {
        dateInput.value = lastDate;
      }
    }

    const coordinates = itinerary.map((item) => [
      item.latitude,
      item.longitude,
    ]);
    L.polyline(coordinates, {
      color: "blue",
      opacity: 0.5,
      weight: 2,
      dashArray: "5, 10",
    }).addTo(map);

    findLocation();
  } catch (error) {
    console.error("Erreur lors du chargement du fichier CSV:", error);
    document.getElementById("status").textContent =
      "Erreur lors du chargement des données. Veuillez réessayer.";
  }
}

// Nettoyer l'intervalle lors du rechargement de la page
window.onbeforeunload = function () {
  if (timeInterval) {
    clearInterval(timeInterval);
  }
};

// Démarrer l'application
init();
