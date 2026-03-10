import { initCommonUI } from "./ui.js";
import { fetchSpots } from "./api.js";
import { API_BASE_URL } from "./config.js";

initCommonUI();

const map = L.map("map", { zoomControl: true });
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

map.setView([46.5, 2.5], 6);

const cluster = L.markerClusterGroup({
  chunkedLoading: true,
  chunkDelay: 50,
  chunkInterval: 200,
});
cluster.addTo(map);

/* ---------- Toast ---------- */
const mapToast = document.getElementById("mapToast");
let toastTimer;
function showToast(msg, isError = false) {
  if (!mapToast) return;
  clearTimeout(toastTimer);
  mapToast.textContent = msg;
  mapToast.className = "map-toast" + (isError ? " map-toast--error" : "");
  mapToast.style.display = "block";
  toastTimer = setTimeout(() => { mapToast.style.display = "none"; }, 4000);
}

/* ---------- Bottom Sheet ---------- */
const sheet = document.getElementById("bottomSheet");
const sheetContent = document.getElementById("sheetContent");
const sheetClose = document.getElementById("sheetClose");

// S'assure que la fiche n'est pas dans le conteneur Leaflet
if (sheet && sheet.parentElement !== document.body) {
  document.body.appendChild(sheet);
}

// Désactive/active les interactions de la carte quand la fiche est ouverte (confort mobile)
function disableMapInteractions() {
  map.scrollWheelZoom.disable();
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
}
function enableMapInteractions() {
  map.scrollWheelZoom.enable();
  map.dragging.enable();
  map.touchZoom.enable();
  map.doubleClickZoom.enable();
}

function openSheet(html) {
  if (!sheet || !sheetContent) return;
  sheetContent.innerHTML = html;
  sheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");
  disableMapInteractions();
}

function closeSheet() {
  sheet?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sheet-open");
  enableMapInteractions();
}
window.closeSheet = closeSheet;

sheetClose?.addEventListener("click", closeSheet);
// Fermer avec la touche Échap ou en cliquant sur l'overlay
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (sheet?.getAttribute("aria-hidden") === "false") closeSheet();
    else if (!searchBar?.hasAttribute('hidden')) closeSearchBar();
  }
});
document.addEventListener("click", (e) => {
  if (sheet?.getAttribute("aria-hidden") === "false" && !sheet.contains(e.target) && !e.target.closest(".leaflet-marker-icon")) {
    closeSheet();
  }
});

/* ---------- Helpers auth ---------- */
function getMapAuth() {
  try { return JSON.parse(localStorage.getItem("auth") || "null"); } catch { return null; }
}
function getMapToken() { return getMapAuth()?.token || ""; }
function isMapAdmin() { return getMapAuth()?.user?.roles?.includes("admin") ?? false; }

/* ---------- Carte : fiche spot enrichie ---------- */
function spotCardHTML(s) {
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  const url = s.url ? `<a class="btn btn--ghost" href="${s.url}" target="_blank" rel="noopener">📄 Fiche</a>` : "";

  const typeIcons = { crag: "🧗", boulder: "🪨", indoor: "🏢" };
  const type = `<div class="spot-info-item"><strong>Type :</strong> ${typeIcons[s.type] || "📍"} ${s.type || "inconnu"}</div>`;
  const soustype = s.soustype ? `<div class="spot-info-item"><strong>Sous-type :</strong> ${s.soustype}</div>` : "";
  const orient = s.orientation ? `<div class="spot-info-item"><strong>Orientation :</strong> ${s.orientation}</div>` : "";
  const niveau = (s.niveau_min || s.niveau_max)
    ? `<div class="spot-info-item"><strong>Niveau :</strong> ${s.niveau_min || "?"} → ${s.niveau_max || "?"}</div>` : "";
  const voies = (s.id_voix?.length)
    ? `<div class="spot-info-item"><strong>Voies :</strong> ${s.id_voix.length}</div>` : "";
  const desc = s.description ? `<p class="spot-description">${s.description}</p>` : "";
  const info = s.info_complementaires
    ? `<p class="spot-info-extra"><em>${s.info_complementaires}</em></p>` : "";

  // Audit log
  const createdBy = s.createdBy?.displayName || s.submittedBy?.displayName;
  const updatedBy = s.updatedBy?.displayName;
  const createdAt = s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : null;
  const updatedAt = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("fr-FR") : null;
  const audit = (createdBy || updatedBy) ? `
    <p class="spot-info-extra" style="margin-top:.5rem;font-size:.8rem;opacity:.7">
      ${createdBy ? `✏️ Ajouté par <strong>${createdBy}</strong>${createdAt ? ` le ${createdAt}` : ""}` : ""}
      ${updatedBy ? `<br>🔄 Modifié par <strong>${updatedBy}</strong>${updatedAt ? ` le ${updatedAt}` : ""}` : ""}
    </p>` : "";

  const isLoggedIn = !!getMapToken();

  return `
    <div class="spot-card">
      <h3 class="spot-title">${s.name}</h3>
      <div class="spot-info-grid">
        ${type}${soustype}${niveau}${voies}${orient}
      </div>
      ${desc}${info}${audit}
      <div class="spot-actions">
        ${url}
        <a class="btn" href="${dir}" target="_blank" rel="noopener">🚗 Itinéraire</a>
        <button class="btn btn--ghost" onclick="window.shareSpot && shareSpot('${s.id}')">Partager</button>
        ${isLoggedIn ? `<button class="btn btn--primary" onclick="window.editSpot && editSpot('${s.id}')">Modifier</button>` : ""}
      </div>
    </div>
  `;
}

/* ---------- Localisation utilisateur ("Me localiser") ---------- */
const locateBtn = document.getElementById("locateBtn");
let userMarker = null;
let userAccuracy = null;
let userCentered = false;

function warnIfInsecureContext() {
  // La géoloc ne marche que sur HTTPS ou http://localhost
  const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (location.protocol !== "https:" && !isLocalhost) {
    showToast("La géolocalisation nécessite HTTPS.", true);
    return true;
  }
  return false;
}

function requestLocation() {
  if (warnIfInsecureContext()) return;
  map.locate({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  });
}

map.on("locationfound", (e) => {
  const latlng = e.latlng;
  const zoomClose = 15; 
  
  // Stocke la position de l'utilisateur pour le filtre de distance
  userPosition = latlng;

  if (!userMarker) {
    userMarker = L.circleMarker(latlng, {
      radius: 8,
      weight: 2,
      fillOpacity: 0.8,
    })
      .addTo(map)
      .bindTooltip("Vous êtes ici", { permanent: false });
  } else {
    userMarker.setLatLng(latlng);
  }

  if (!userAccuracy) {
    userAccuracy = L.circle(latlng, {
      radius: e.accuracy,
      weight: 1,
      opacity: 0.6,
      fillOpacity: 0.1,
    }).addTo(map);
  } else {
    userAccuracy.setLatLng(latlng).setRadius(e.accuracy);
  }

  map.setView(latlng, zoomClose, { animate: true });
  userCentered = true; //signale qu'on a centré sur l'user
  
  // Refiltre les spots avec la nouvelle position
  if (allSpots.length > 0) {
    filterSpots();
  }
});

map.on("locationerror", (err) => {
  console.error("[map] locationerror:", err);
  showToast("Impossible de récupérer votre position : " + (err.message || "erreur inconnue"), true);
});

locateBtn?.addEventListener("click", requestLocation);

/* ---------- Icônes des spots selon le type ---------- */

function makeCliffIcon(spot, size = 38) {
  const s = size;
  // Icônes différentes selon le type
  const icons = {
    'crag': '🧗',
    'boulder': '🪨',
    'indoor': '🏢',
    'default': '📍'
  };
  
  const icon = icons[spot.type] || icons.default;
  
  // Couleur selon le niveau (optionnel, pour différenciation visuelle)
  let shadowColor = '#3388ff';
  if (spot.niveau_max) {
    const maxGrade = parseGradeToNumber(spot.niveau_max);
    if (maxGrade >= 7.5) shadowColor = '#ff3333'; // Rouge pour difficile
    else if (maxGrade >= 6.5) shadowColor = '#ff9900'; // Orange
    else if (maxGrade >= 5) shadowColor = '#ffcc00'; // Jaune
    else shadowColor = '#00cc66'; // Vert pour facile
  }
  
  return L.divIcon({
    className: "climber-icon",
    html: `<span style="display:block; line-height:1; font-size:${s}px; filter: drop-shadow(0 2px 4px ${shadowColor});">${icon}</span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

// Fonction utilitaire pour parser les cotations
function parseGradeToNumber(grade) {
  if (!grade) return 0;
  const match = String(grade).match(/(\d+)([a-c]?\+?)/i);
  if (!match) return 0;
  const base = parseInt(match[1], 10);
  const letter = match[2] ? match[2].toLowerCase() : '';
  let offset = 0;
  if (letter.includes('a')) offset = 0;
  else if (letter.includes('b')) offset = 0.33;
  else if (letter.includes('c')) offset = 0.66;
  if (letter.includes('+')) offset += 0.16;
  return base + offset;
}


/* ---------- Variables globales pour filtrage et recherche ---------- */
let allSpots = [];
let allMarkers = [];
let userPosition = null; // Position de l'utilisateur pour calculer les distances
let currentFilters = {
  type: '',
  niveauMin: '',
  searchQuery: '',
  distance: 500 // Distance max en km (500 = toutes les distances)
};

/* ---------- Fonction de partage ---------- */
window.shareSpot = function(spotId) {
  const spot = allSpots.find(s => s.id === spotId);
  if (!spot) return;
  
  const url = `${window.location.origin}${window.location.pathname}?spot=${spotId}`;
  
  if (navigator.share) {
    navigator.share({
      title: spot.name,
      text: `Découvre ce spot de grimpe : ${spot.name}`,
      url: url
    }).catch(err => console.log('Partage annulé', err));
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert('Lien copié dans le presse-papier !');
    }).catch(() => {
      alert(`Lien du spot : ${url}`);
    });
  }
};

/* ---------- Fonction pour voir les détails complets ---------- */
window.viewSpotDetails = function(spotId) {
  const spot = allSpots.find(s => s.id === spotId);
  if (!spot) return;
  
  const detailsHTML = `
    <div class="spot-details">
      <h3 class="spot-title">Détails complets</h3>
      <div class="spot-info-list">
        <div class="spot-info-item"><strong>Nom :</strong> ${spot.name || 'Non renseigné'}</div>
        <div class="spot-info-item"><strong>Type :</strong> ${spot.type || 'Non renseigné'}</div>
        <div class="spot-info-item"><strong>Sous-type :</strong> ${spot.soustype || 'Non renseigné'}</div>
        <div class="spot-info-item"><strong>Niveau min :</strong> ${spot.niveau_min || 'Non renseigné'}</div>
        <div class="spot-info-item"><strong>Niveau max :</strong> ${spot.niveau_max || 'Non renseigné'}</div>
        <div class="spot-info-item"><strong>Orientation :</strong> ${spot.orientation || 'Non renseignée'}</div>
        <div class="spot-info-item"><strong>Nombre de voies :</strong> ${spot.id_voix?.length || 0}</div>
        ${spot.description ? `<div class="spot-info-item"><strong>Description :</strong> ${spot.description}</div>` : ''}
        ${spot.info_complementaires ? `<div class="spot-info-item"><strong>Infos complémentaires :</strong> ${spot.info_complementaires}</div>` : ''}
        ${spot.url ? `<div class="spot-info-item"><strong>URL :</strong> <a href="${spot.url}" target="_blank" rel="noopener">${spot.url}</a></div>` : ''}
        <div class="spot-info-item"><strong>Coordonnées :</strong> ${spot.lat.toFixed(6)}, ${spot.lng.toFixed(6)}</div>
      </div>
      <div class="spot-actions">
        <button class="btn" onclick="window.editSpot && editSpot('${spot.id}')">Modifier</button>
        <button class="btn btn--ghost" onclick="closeSheet()">Fermer</button>
      </div>
    </div>
  `;
  
  openSheet(detailsHTML);
};

/* ---------- Fonction pour modifier un spot ---------- */
window.editSpot = function(spotId) {
  const spot = allSpots.find(s => s.id === spotId);
  if (!spot) return;
  
  const formHTML = `
    <div class="spot-edit-form">
      <h3 class="spot-title">Modifier le spot</h3>
      <form id="editSpotForm" onsubmit="return false;">
        <div class="form-group">
          <label for="editName">Nom du spot *</label>
          <input type="text" id="editName" name="name" value="${spot.name || ''}" required maxlength="120">
        </div>
        
        <div class="form-group">
          <label for="editSoustype">Sous-type</label>
          <select id="editSoustype" name="soustype">
            <option value="">-- Sélectionner --</option>
            <option value="diff" ${spot.soustype === 'diff' ? 'selected' : ''}>Difficulté (diff)</option>
            <option value="bloc" ${spot.soustype === 'bloc' ? 'selected' : ''}>Bloc</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="editNiveauMin">Niveau minimum</label>
          <input type="text" id="editNiveauMin" name="niveau_min" value="${spot.niveau_min || ''}" placeholder="Ex: 4a, 5c" maxlength="10">
        </div>
        
        <div class="form-group">
          <label for="editNiveauMax">Niveau maximum</label>
          <input type="text" id="editNiveauMax" name="niveau_max" value="${spot.niveau_max || ''}" placeholder="Ex: 7b, 8a+" maxlength="10">
        </div>
        
        <div class="form-group">
          <label for="editOrientation">Orientation</label>
          <select id="editOrientation" name="orientation">
            <option value="">-- Sélectionner --</option>
            <option value="N" ${spot.orientation === 'N' ? 'selected' : ''}>Nord (N)</option>
            <option value="NE" ${spot.orientation === 'NE' ? 'selected' : ''}>Nord-Est (NE)</option>
            <option value="E" ${spot.orientation === 'E' ? 'selected' : ''}>Est (E)</option>
            <option value="SE" ${spot.orientation === 'SE' ? 'selected' : ''}>Sud-Est (SE)</option>
            <option value="S" ${spot.orientation === 'S' ? 'selected' : ''}>Sud (S)</option>
            <option value="SO" ${spot.orientation === 'SO' ? 'selected' : ''}>Sud-Ouest (SO)</option>
            <option value="O" ${spot.orientation === 'O' ? 'selected' : ''}>Ouest (O)</option>
            <option value="NO" ${spot.orientation === 'NO' ? 'selected' : ''}>Nord-Ouest (NO)</option>
          </select>
        </div>
        
        <div class="spot-actions">
          <button type="button" class="btn" onclick="window.submitSpotEdit && submitSpotEdit('${spot.id}')">Enregistrer</button>
          <button type="button" class="btn btn--ghost" onclick="closeSheet()">Annuler</button>
        </div>
      </form>
    </div>
  `;
  
  openSheet(formHTML);
};

/* ---------- Fonction pour soumettre la modification ---------- */
window.submitSpotEdit = async function(spotId) {
  const form = document.getElementById('editSpotForm');
  if (!form) return;
  
  const formData = new FormData(form);
  const updates = {};
  
  // Récupérer seulement les champs modifiables
  const name = formData.get('name')?.trim();
  const soustype = formData.get('soustype')?.trim();
  const niveau_min = formData.get('niveau_min')?.trim();
  const niveau_max = formData.get('niveau_max')?.trim();
  const orientation = formData.get('orientation')?.trim();
  
  if (name) updates.name = name;
  if (soustype) updates.soustype = soustype;
  if (niveau_min) updates.niveau_min = niveau_min;
  if (niveau_max) updates.niveau_max = niveau_max;
  if (orientation) updates.orientation = orientation;
  
  // Si aucune modification
  if (Object.keys(updates).length === 0) {
    showToast('Aucune modification à enregistrer.');
    return;
  }
  
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    const token = auth.token || localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/spots/${spotId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(updates)
    });
    
    // Récupérer le texte brut de la réponse
    const responseText = await response.text();
    
    // Parser le JSON seulement si la réponse n'est pas vide
    let result = null;
    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Erreur de parsing JSON:', parseError, 'Réponse:', responseText);
        throw new Error('Réponse invalide du serveur');
      }
    }
    
    if (!response.ok) {
      const errorMsg = result?.error || result?.detail || 'Erreur lors de la modification';
      throw new Error(errorMsg);
    }
    
    // Mettre à jour le spot dans allSpots
    const spotIndex = allSpots.findIndex(s => s.id === spotId);
    if (spotIndex !== -1) {
      allSpots[spotIndex] = { ...allSpots[spotIndex], ...updates };
    }
    
    showToast('Modifications enregistrées !');
    closeSheet();
    
    // Recharger les spots pour avoir les données à jour
    setTimeout(() => {
      window.location.reload();
    }, 500);
    
  } catch (error) {
    console.error('Erreur lors de la modification:', error);
    showToast(`Erreur : ${error.message}`, true);
  }
};

/* ---------- Calcul de distance entre deux points ---------- */
function calculateDistance(lat1, lng1, lat2, lng2) {
  // Formule de Haversine pour calculer la distance en km
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ---------- Filtrage des spots ---------- */
function filterSpots() {
  let filtered = [...allSpots];
  
  // Filtre par type
  if (currentFilters.type) {
    filtered = filtered.filter(s => s.type === currentFilters.type);
  }
  
  // Filtre par niveau minimum
  if (currentFilters.niveauMin) {
    const minGrade = parseInt(currentFilters.niveauMin, 10);
    filtered = filtered.filter(s => {
      if (!s.niveau_min) return false;
      const spotMin = parseGradeToNumber(s.niveau_min);
      return spotMin >= minGrade;
    });
  }
  
  // Filtre par recherche textuelle
  if (currentFilters.searchQuery) {
    const query = currentFilters.searchQuery.toLowerCase();
    filtered = filtered.filter(s => 
      s.name.toLowerCase().includes(query)
    );
  }
  
  // Filtre par distance (seulement si position utilisateur disponible et distance < 500km)
  if (userPosition && currentFilters.distance < 500) {
    filtered = filtered.filter(s => {
      const distance = calculateDistance(
        userPosition.lat,
        userPosition.lng,
        s.lat,
        s.lng
      );
      return distance <= currentFilters.distance;
    });
  }
  // Si distance === 500 (au maximum), on affiche tous les spots (pas de filtre)
  
  updateMapMarkers(filtered);
  
  // Affiche/cache le bouton reset
  const hasActiveFilters = currentFilters.type || currentFilters.niveauMin || currentFilters.searchQuery || (currentFilters.distance < 500 && userPosition);
  document.getElementById('resetFilters').style.display = hasActiveFilters ? 'block' : 'none';
}

/* ---------- Mise à jour des markers sur la carte ---------- */
function updateMapMarkers(spotsToShow) {
  cluster.clearLayers();
  
  spotsToShow.forEach((s) => {
    const marker = allMarkers.find(m => m.spotId === s.id);
    if (marker) {
      cluster.addLayer(marker);
    }
  });
  
  console.log(`[map] Affichage de ${spotsToShow.length} / ${allSpots.length} spots`);
}

/* ---------- Toggle barre de recherche ---------- */
const searchBar = document.getElementById('searchBar');
const searchToggleBtn = document.getElementById('searchToggleBtn');

function openSearchBar() {
  searchBar?.removeAttribute('hidden');
  searchToggleBtn?.setAttribute('aria-expanded', 'true');
  document.getElementById('searchInput')?.focus();
}
function closeSearchBar() {
  searchBar?.setAttribute('hidden', '');
  searchToggleBtn?.setAttribute('aria-expanded', 'false');
  if (searchResults) searchResults.style.display = 'none';
  if (searchInput) searchInput.value = '';
  currentFilters.searchQuery = '';
  filterSpots();
}

searchToggleBtn?.addEventListener('click', () => {
  const isOpen = !searchBar?.hasAttribute('hidden');
  isOpen ? closeSearchBar() : openSearchBar();
});

/* ---------- Recherche ---------- */
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
let searchTimeout;

searchInput?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  if (query.length < 2) {
    searchResults.innerHTML = '';
    searchResults.style.display = 'none';
    currentFilters.searchQuery = '';
    filterSpots();
    return;
  }
  
  searchTimeout = setTimeout(() => {
    currentFilters.searchQuery = query;
    const results = allSpots.filter(s => 
      s.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);
    
    displaySearchResults(results);
    filterSpots();
  }, 300);
});

function displaySearchResults(results) {
  if (!results.length) {
    searchResults.innerHTML = '<div class="search-no-result">Aucun spot trouvé</div>';
    searchResults.style.display = 'block';
    return;
  }
  
  searchResults.innerHTML = results.map(s => {
    const typeIcons = { 'crag': '🧗', 'boulder': '🪨', 'indoor': '🏢' };
    const icon = typeIcons[s.type] || '📍';
    return `
      <div class="search-result" data-spot-id="${s.id}">
        <span class="search-result-icon">${icon}</span>
        <span class="search-result-name">${s.name}</span>
        <span class="search-result-type">${s.type || ''}</span>
      </div>
    `;
  }).join('');
  searchResults.style.display = 'block';
  
  // Ajout des listeners sur les résultats
  searchResults.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', () => {
      const spotId = el.dataset.spotId;
      focusSpot(spotId);
      closeSearchBar();
    });
  });
}

function focusSpot(spotId) {
  const spot = allSpots.find(s => s.id === spotId);
  if (!spot) return;
  
  map.setView([spot.lat, spot.lng], 14, { animate: true });
  openSheet(spotCardHTML(spot));
}

// Fermer la search bar si on clique en dehors
document.addEventListener('click', (e) => {
  if (
    !searchBar?.hasAttribute('hidden') &&
    !searchBar?.contains(e.target) &&
    e.target !== searchToggleBtn
  ) {
    closeSearchBar();
  }
});

/* ---------- Gestion des filtres ---------- */
const filterType = document.getElementById('filterType');
const filterNiveauMin = document.getElementById('filterNiveauMin');
const toggleFilters = document.getElementById('toggleFilters');
const advancedFilters = document.getElementById('advancedFilters');
const resetFilters = document.getElementById('resetFilters');

filterType?.addEventListener('change', (e) => {
  currentFilters.type = e.target.value;
  filterSpots();
});

filterNiveauMin?.addEventListener('change', (e) => {
  currentFilters.niveauMin = e.target.value;
  filterSpots();
});

toggleFilters?.addEventListener('click', () => {
  const isVisible = advancedFilters.style.display === 'block';
  advancedFilters.style.display = isVisible ? 'none' : 'block';
});

resetFilters?.addEventListener('click', () => {
  currentFilters = { type: '', niveauMin: '', searchQuery: '', distance: 500 };
  filterType.value = '';
  filterNiveauMin.value = '';
  closeSearchBar();
  const filterDistance = document.getElementById('filterDistance');
  const distanceValue = document.getElementById('distanceValue');
  if (filterDistance) {
    filterDistance.value = 500;
    distanceValue.textContent = 'Toutes';
  }
  filterSpots();
});

/* ---------- Gestion du filtre de distance ---------- */
const filterDistance = document.getElementById('filterDistance');
const distanceValue = document.getElementById('distanceValue');

filterDistance?.addEventListener('input', (e) => {
  const distance = parseInt(e.target.value, 10);
  currentFilters.distance = distance;
  
  // Affichage de la valeur
  if (distance >= 500) {
    distanceValue.textContent = 'Toutes';
  } else {
    distanceValue.textContent = `${distance} km`;
  }
  
  filterSpots();
});

/* ---------- Wizard "Proposer un spot" ---------- */
const proposeSpotBtn = document.getElementById("proposeSpotBtn");
const proposeModal = document.getElementById("proposeModal");

// Afficher le bouton si connecté
if (getMapToken() && proposeSpotBtn) proposeSpotBtn.style.display = "flex";

// Grades d'escalade
const GRADES = [
  "3","4a","4b","4c","5a","5b","5c",
  "6a","6a+","6b","6b+","6c","6c+",
  "7a","7a+","7b","7b+","7c","7c+",
  "8a","8a+","8b","8b+","8c","8c+",
  "9a","9a+","9b","9b+","9c"
];

// État du wizard
let wizardStep = 1;
let wizardData = { name: "", type: "crag", lat: null, lng: null, orientation: null, niveau_min: "", niveau_max: "", description: "" };

// DOM wizard
const wizardTrack = document.getElementById("wizardTrack");
const wizardProgressFill = document.getElementById("wizardProgressFill");
const wizardNextBtn = document.getElementById("wizardNextBtn");
const wizardBackBtn = document.getElementById("wizardBackBtn");
const wizardCloseBtn = document.getElementById("wizardCloseBtn");
const dots = [1,2,3,4].map(i => document.getElementById(`dot${i}`));

// Peupler les selects de niveaux
function populateLevelSelects() {
  const minSel = document.getElementById("pNiveauMin");
  const maxSel = document.getElementById("pNiveauMax");
  if (!minSel || !maxSel) return;
  const opts = GRADES.map(g => `<option value="${g}">${g}</option>`).join("");
  minSel.innerHTML = `<option value="">Min</option>${opts}`;
  maxSel.innerHTML = `<option value="">Max</option>${opts}`;
}

// Mise à jour de l'UI de navigation
function updateWizardUI() {
  const TOTAL = 4;
  const pct = (wizardStep / TOTAL) * 100;
  if (wizardProgressFill) wizardProgressFill.style.width = `${pct}%`;
  if (wizardTrack) wizardTrack.style.transform = `translateX(-${(wizardStep - 1) * 25}%)`;

  dots.forEach((d, i) => {
    if (!d) return;
    d.classList.toggle("active", i + 1 === wizardStep);
    d.classList.toggle("done", i + 1 < wizardStep);
  });

  if (wizardBackBtn) wizardBackBtn.style.display = wizardStep > 1 ? "block" : "none";
  if (wizardNextBtn) {
    if (wizardStep < TOTAL) {
      wizardNextBtn.textContent = "Suivant →";
      wizardNextBtn.disabled = false;
    } else {
      wizardNextBtn.textContent = "Envoyer la demande";
      wizardNextBtn.disabled = false;
    }
  }
}

// Validation par étape
function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById("pName")?.value.trim() || "";
    const err = document.getElementById("errStep1");
    if (!name) { if (err) err.textContent = "Le nom du spot est obligatoire."; return false; }
    if (err) err.textContent = "";
    wizardData.name = name;
    wizardData.type = document.querySelector(".type-card.active")?.dataset.type || "crag";
    return true;
  }
  if (step === 2) {
    const lat = parseFloat(document.getElementById("pLat")?.value);
    const lng = parseFloat(document.getElementById("pLng")?.value);
    const err = document.getElementById("errStep2");
    if (isNaN(lat) || isNaN(lng)) { if (err) err.textContent = "La position est obligatoire."; return false; }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { if (err) err.textContent = "Coordonnées invalides."; return false; }
    if (err) err.textContent = "";
    wizardData.lat = lat;
    wizardData.lng = lng;
    return true;
  }
  if (step === 3) {
    wizardData.niveau_min = document.getElementById("pNiveauMin")?.value || "";
    wizardData.niveau_max = document.getElementById("pNiveauMax")?.value || "";
    wizardData.description = document.getElementById("pDescription")?.value.trim() || "";
    wizardData.orientation = document.querySelector(".compass-btn.active")?.dataset.dir || null;
    return true;
  }
  return true;
}

// Construction du récapitulatif
function buildRecap() {
  const typeIcons = { crag: "🧗 Falaise", boulder: "🪨 Bloc", indoor: "🏢 Salle" };
  const recap = document.getElementById("recapCard");
  if (!recap) return;
  recap.innerHTML = `
    <div class="recap-row"><span class="recap-row__label">Nom</span><span class="recap-row__value">${wizardData.name}</span></div>
    <div class="recap-row"><span class="recap-row__label">Type</span><span class="recap-row__value">${typeIcons[wizardData.type] || wizardData.type}</span></div>
    <div class="recap-row"><span class="recap-row__label">Latitude</span><span class="recap-row__value">${wizardData.lat?.toFixed(6)}</span></div>
    <div class="recap-row"><span class="recap-row__label">Longitude</span><span class="recap-row__value">${wizardData.lng?.toFixed(6)}</span></div>
    ${wizardData.niveau_min ? `<div class="recap-row"><span class="recap-row__label">Niveau min</span><span class="recap-row__value">${wizardData.niveau_min}</span></div>` : ""}
    ${wizardData.niveau_max ? `<div class="recap-row"><span class="recap-row__label">Niveau max</span><span class="recap-row__value">${wizardData.niveau_max}</span></div>` : ""}
    ${wizardData.orientation ? `<div class="recap-row"><span class="recap-row__label">Orientation</span><span class="recap-row__value">${wizardData.orientation}</span></div>` : ""}
    ${wizardData.description ? `<div class="recap-row"><span class="recap-row__label">Description</span><span class="recap-row__value" style="font-size:.82rem">${wizardData.description}</span></div>` : ""}
    <div class="recap-row">
      <span class="recap-row__label" style="font-size:.8rem">${isMapAdmin() ? "✅ Sera approuvé immédiatement" : "⏳ Soumis à validation admin"}</span>
    </div>
  `;
}

// Réinitialiser le wizard
function resetWizard() {
  wizardStep = 1;
  wizardData = { name: "", type: "crag", lat: null, lng: null, orientation: null, niveau_min: "", niveau_max: "", description: "" };
  document.getElementById("pName") && (document.getElementById("pName").value = "");
  document.getElementById("pLat") && (document.getElementById("pLat").value = "");
  document.getElementById("pLng") && (document.getElementById("pLng").value = "");
  document.getElementById("pNiveauMin") && (document.getElementById("pNiveauMin").value = "");
  document.getElementById("pNiveauMax") && (document.getElementById("pNiveauMax").value = "");
  document.getElementById("pDescription") && (document.getElementById("pDescription").value = "");
  document.querySelectorAll(".type-card").forEach((c, i) => c.classList.toggle("active", i === 0));
  document.querySelectorAll(".compass-btn").forEach(b => b.classList.remove("active"));
  const cp = document.getElementById("coordsText");
  if (cp) cp.textContent = "Position non définie";
  ["errStep1","errStep2","errStep4"].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ""; });
  updateWizardUI();
}

// Ouvrir le wizard
proposeSpotBtn?.addEventListener("click", () => {
  populateLevelSelects();
  resetWizard();
  proposeModal?.showModal();
});

// Fermer
wizardCloseBtn?.addEventListener("click", () => proposeModal?.close());
proposeModal?.addEventListener("click", (e) => { if (e.target === proposeModal) proposeModal.close(); });

// Type cards
document.querySelectorAll(".type-card").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-card").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Boussole
document.querySelectorAll(".compass-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".compass-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Géolocalisation dans le wizard
document.getElementById("pLocateBtn")?.addEventListener("click", () => {
  const btn = document.getElementById("pLocateBtn");
  const coordsText = document.getElementById("coordsText");
  if (btn) { btn.disabled = true; btn.textContent = "Localisation…"; }

  const setCoords = (lat, lng) => {
    document.getElementById("pLat").value = lat.toFixed(6);
    document.getElementById("pLng").value = lng.toFixed(6);
    if (coordsText) coordsText.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg> Position trouvée ✓`; }
  };

  if (userPosition) {
    setCoords(userPosition.lat, userPosition.lng);
  } else {
    if (warnIfInsecureContext()) { if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg> Utiliser ma position`; } return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords(pos.coords.latitude, pos.coords.longitude),
      () => {
        if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg> Utiliser ma position`; }
        const errEl = document.getElementById("errStep2");
        if (errEl) errEl.textContent = "Impossible d'obtenir la position.";
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
});

// Navigation : Suivant
wizardNextBtn?.addEventListener("click", async () => {
  if (!validateStep(wizardStep)) return;

  if (wizardStep < 4) {
    wizardStep++;
    if (wizardStep === 4) buildRecap();
    updateWizardUI();
    return;
  }

  // Étape 4 → Soumettre
  wizardNextBtn.disabled = true;
  wizardNextBtn.textContent = "Envoi…";
  const errEl = document.getElementById("errStep4");
  if (errEl) errEl.textContent = "";

  try {
    const res = await fetch(`${API_BASE_URL}/api/spots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getMapToken()}`,
      },
      body: JSON.stringify({
        name: wizardData.name,
        type: wizardData.type,
        location: { type: "Point", coordinates: [wizardData.lng, wizardData.lat] },
        orientation: wizardData.orientation || undefined,
        niveau_min: wizardData.niveau_min || undefined,
        niveau_max: wizardData.niveau_max || undefined,
        description: wizardData.description || undefined,
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.detail || json?.error || "Erreur serveur");

    proposeModal?.close();
    showToast(isMapAdmin()
      ? "Spot ajouté et approuvé ✅"
      : "Demande envoyée ! Un admin va la valider 🙏"
    );
  } catch (err) {
    if (errEl) errEl.textContent = "Erreur : " + err.message;
    wizardNextBtn.disabled = false;
    wizardNextBtn.textContent = "Envoyer la demande";
  }
});

// Navigation : Retour
wizardBackBtn?.addEventListener("click", () => {
  if (wizardStep > 1) { wizardStep--; updateWizardUI(); }
});

/* ---------- Chargement et affichage des spots ---------- */
const mapLoading = document.getElementById("mapLoading");

(async () => {
  try {
    allSpots = await fetchSpots({
      useCache: false,
      pageSize: 10000,
      extraParams: { format: "flat" },
    });
    console.log(`[map] Spots normalisés reçus: ${allSpots.length}`, allSpots[0]);

    if (!allSpots.length) {
      console.warn("[map] 0 spot après normalisation.");
      showToast("Aucun spot trouvé.", true);
      return;
    }

    // Création de tous les markers
    allSpots.forEach((s) => {
      const m = L.marker([s.lat, s.lng], {
        icon: makeCliffIcon(s, 38),
        title: s.name,
      });
      m.spotId = s.id;
      m.on("click", () => openSheet(spotCardHTML(s)));
      allMarkers.push(m);
      cluster.addLayer(m);
    });

    // Zoom initial sur tous les spots
    const bounds = L.latLngBounds(allSpots.map((s) => [s.lat, s.lng]));
    if (!userCentered) {
      map.fitBounds(bounds.pad(0.2));
    }

    // Gestion du spot dans l'URL (partage)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('spot')) {
      const spotId = urlParams.get('spot');
      setTimeout(() => focusSpot(spotId), 1000);
    }
  } catch (e) {
    console.error("[map] fetchSpots failed:", e);
    showToast("Impossible de charger les spots : " + (e.message || e), true);
  } finally {
    if (mapLoading) mapLoading.style.display = "none";
  }
})();
