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

function openSheet(html, spotId) {
  if (!sheet || !sheetContent) return;
  sheetContent.innerHTML = html;
  sheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");
  disableMapInteractions();
  // Load routes + bookmark status after render
  if (spotId) {
    loadSpotRoutes(spotId);
    checkBookmarkStatus(spotId);
  }
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

/* ---------- HTML escape ---------- */
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Helpers auth ---------- */
function getMapAuth() {
  try { return JSON.parse(localStorage.getItem("auth") || "null"); } catch { return null; }
}
function getMapToken() { return getMapAuth()?.token || ""; }
function isMapAdmin() { return getMapAuth()?.user?.roles?.includes("admin") ?? false; }

/* ---------- Carte : fiche spot enrichie ---------- */
function spotCardHTML(s) {
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  const isLoggedIn = !!getMapToken();
  const isAdmin = isMapAdmin();

  // Type
  const typeIcons  = { crag: "🧗", boulder: "🪨", indoor: "🏢", shop: "🛒" };
  const typeLabels = { crag: "Falaise", boulder: "Bloc", indoor: "Salle", shop: "Magasin" };
  const typeKey    = s.type || "crag";
  const typeIcon   = typeIcons[typeKey]  || "📍";
  const typeLabel  = typeLabels[typeKey] || s.type || "Inconnu";

  // Grade + difficulté
  const hasGrade = s.niveau_min || s.niveau_max;
  const gradeText = hasGrade ? `${s.niveau_min || "?"}  →  ${s.niveau_max || "?"}` : null;
  let gradeLevel = "medium";
  if (s.niveau_max) {
    const n = parseGradeToNumber(s.niveau_max);
    if (n < 5)       gradeLevel = "easy";
    else if (n < 6.5) gradeLevel = "medium";
    else if (n < 7.5) gradeLevel = "hard";
    else if (n < 8.5) gradeLevel = "expert";
    else               gradeLevel = "elite";
  }

  // Orientation avec flèche CSS
  const orientDeg  = { N:0, NE:45, E:90, SE:135, S:180, SO:225, O:270, NO:315 };
  const orientFull = { N:"Nord", NE:"Nord-Est", E:"Est", SE:"Sud-Est", S:"Sud", SO:"Sud-Ouest", O:"Ouest", NO:"Nord-Ouest" };
  const orientStat = s.orientation
    ? `<span class="sc-stat">
        <span class="sc-compass" style="--rot:${orientDeg[s.orientation] ?? 0}deg">↑</span>
        ${orientFull[s.orientation] || s.orientation}
       </span>`
    : "";

  const gradeStat = gradeText
    ? `<span class="sc-stat sc-stat--grade" data-level="${gradeLevel}">⚡ ${gradeText}</span>` : "";
  const voiesStat = s.id_voix?.length
    ? `<span class="sc-stat">🪢 ${s.id_voix.length} voie${s.id_voix.length > 1 ? "s" : ""}</span>` : "";
  const soustypeStat = s.soustype
    ? `<span class="sc-stat">🔖 ${s.soustype}</span>` : "";
  const rockStat = s.info_complementaires?.rock
    ? `<span class="sc-stat">🪨 ${esc(s.info_complementaires.rock)}</span>` : "";
  const equipMap = { spit: "Spit", piton: "Piton", mixte: "Mixte", non_equipe: "Non équipé" };
  const equipStat = s.equipement
    ? `<span class="sc-stat">🔩 ${equipMap[s.equipement] || s.equipement}</span>` : "";
  const hauteurStat = s.hauteur
    ? `<span class="sc-stat">📏 ${s.hauteur} m</span>` : "";

  const desc = s.description
    ? `<p class="sc-desc">${esc(s.description)}</p>` : "";
  const acces = s.acces
    ? `<p class="sc-acces"><strong>Accès :</strong> ${esc(s.acces)}</p>` : "";

  // Photos
  const photos = s.photos?.length
    ? `<div class="sc-photos">${s.photos.map(p => `<img src="${esc(p.url)}" class="sc-photo" alt="Photo du spot" onclick="window.openPhoto && openPhoto('${esc(p.url)}')">`).join("")}</div>`
    : "";

  // Audit
  const createdBy = s.createdBy?.displayName || s.submittedBy?.displayName;
  const updatedBy = s.updatedBy?.displayName;
  const createdAt = s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : null;
  const updatedAt = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("fr-FR") : null;
  // Profil public du contributeur
  const creatorId = s.createdBy?.uid || s.submittedBy?.uid;
  const creatorLink = creatorId
    ? `<a class="sc-audit-link" href="./profil.html?id=${creatorId}">${createdBy || "Contributeur"}</a>` : (createdBy || "");

  const auditNew = (createdBy || updatedBy) ? `
    <p class="sc-audit">
      ${creatorId ? `✏️ ${creatorLink}${createdAt ? ` · ${createdAt}` : ""}` : (createdBy ? `✏️ ${createdBy}${createdAt ? ` · ${createdAt}` : ""}` : "")}
      ${updatedBy ? ` &nbsp;·&nbsp; 🔄 ${updatedBy}${updatedAt ? ` · ${updatedAt}` : ""}` : ""}
    </p>` : "";

  return `
    <div class="spot-card">
      <div class="sc-banner" data-type="${typeKey}">
        <span class="sc-banner__icon">${typeIcon}</span>
        <div class="sc-banner__info">
          <h3 class="sc-name">${esc(s.name)}</h3>
          <div class="sc-meta">
            <span class="sc-type-label">${typeLabel}</span>
            ${gradeText ? `<span class="sc-grade-badge" data-level="${gradeLevel}">${gradeText}</span>` : ""}
          </div>
        </div>
        ${isLoggedIn ? `<button class="sc-bookmark" onclick="window.toggleBookmark && toggleBookmark('${s.id}')" title="Sauvegarder" data-spot-id="${s.id}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        </button>` : ""}
      </div>
      <div class="sc-body">
        ${gradeStat || orientStat || voiesStat || soustypeStat || rockStat || equipStat || hauteurStat ? `<div class="sc-stats">${gradeStat}${orientStat}${voiesStat}${soustypeStat}${rockStat}${equipStat}${hauteurStat}</div>` : ""}
        ${photos}${desc}${acces}${auditNew}

        <button class="sc-cta" onclick="window.enterSpot && window.enterSpot('${s.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Rentrer dans le spot
        </button>
        <div class="sc-action-row">
          <a class="sc-btn" href="${dir}" target="_blank" rel="noopener">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Itinéraire
          </a>
          <button class="sc-btn" onclick="window.shareSpot && shareSpot('${s.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Partager
          </button>
          ${s.url && /^https?:\/\//.test(s.url) ? `<a class="sc-btn" href="${esc(s.url)}" target="_blank" rel="noopener">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Fiche
          </a>` : ""}
          ${isLoggedIn ? `<button class="sc-btn" onclick="window.editSpot && editSpot('${s.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Modifier
          </button>` : ""}
        </div>
        ${isAdmin ? `<button class="sc-btn sc-btn--danger" onclick="window.deleteSpot && deleteSpot('${s.id}', '${esc(s.name)}')">Supprimer ce spot</button>` : ""}
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
  // Fallback immédiat sur tous les spots si géoloc refusée
  if (!userCentered && allSpots.length) {
    const bounds = L.latLngBounds(allSpots.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds.pad(0.2));
  }
});

locateBtn?.addEventListener("click", requestLocation);

/* ---------- Bannière géolocalisation ---------- */
const geoBanner      = document.getElementById("geo-banner");
const geoBannerText  = geoBanner?.querySelector(".geo-banner__text");
const geoBannerAccept  = document.getElementById("geoBannerAccept");
const geoBannerDismiss = document.getElementById("geoBannerDismiss");

function showGeoBanner(denied = false) {
  if (!geoBanner) return;
  geoBannerText.textContent = denied
    ? "La géolocalisation est bloquée. Autorise-la dans les réglages de ton navigateur."
    : "Active la localisation pour voir les spots près de toi.";
  if (geoBannerAccept) geoBannerAccept.hidden = denied;
  geoBanner.hidden = false;
}
function hideGeoBanner() { if (geoBanner) geoBanner.hidden = true; }

geoBannerAccept?.addEventListener("click", () => {
  hideGeoBanner();
  requestLocation();
});
geoBannerDismiss?.addEventListener("click", hideGeoBanner);

// Cache la bannière dès que la géoloc est acceptée
map.on("locationfound", hideGeoBanner);

// Montre la bannière si la géoloc échoue (refus ou erreur)
map.on("locationerror", () => {
  if (navigator.permissions) {
    navigator.permissions.query({ name: "geolocation" }).then((p) => {
      showGeoBanner(p.state === "denied");
    }).catch(() => showGeoBanner(false));
  } else {
    showGeoBanner(false);
  }
});

async function initGeoPrompt(fallback) {
  if (!navigator.geolocation) { fallback(); return; }

  if (!navigator.permissions) {
    // Permissions API non supportée : demande directe
    requestLocation();
    setTimeout(fallback, 6000);
    return;
  }

  try {
    const perm = await navigator.permissions.query({ name: "geolocation" });
    if (perm.state === "granted") {
      requestLocation();
      setTimeout(fallback, 6000);
    } else if (perm.state === "denied") {
      showGeoBanner(true);
      fallback();
    } else {
      // "prompt" : l'utilisateur n'a pas encore décidé
      showGeoBanner(false);
      fallback();
    }
    // Réagit si l'utilisateur change les permissions dans le navigateur
    perm.onchange = () => {
      if (perm.state === "granted") { hideGeoBanner(); requestLocation(); }
      else if (perm.state === "denied") { showGeoBanner(true); }
    };
  } catch {
    requestLocation();
    setTimeout(fallback, 6000);
  }
}

/* ---------- Icônes des spots selon le type ---------- */

function makeCliffIcon(spot, size = 38) {
  const s = size;
  // Icônes différentes selon le type
  const icons = {
    'crag': '🧗',
    'boulder': '🪨',
    'indoor': '🏢',
    'shop': '🛒',
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
let allMarkers = new Map(); // spotId → marker
let userPosition = null; // Position de l'utilisateur pour calculer les distances
let currentFilters = {
  type: '',
  niveauMin: '',
  searchQuery: '',
  distance: 500 // Distance max en km (500 = toutes les distances)
};

/* ---------- Rentrer dans le spot — vue intérieure ---------- */
window.enterSpot = function(spotId) {
  try {
    const spot = allSpots.find(s => s.id === spotId || String(s.id) === String(spotId));
    if (!spot) { showToast("Spot introuvable", true); return; }
    const isLoggedIn = !!getMapToken();
    const html = spotInteriorHTML(spot, isLoggedIn);
    openSheet(html, null);
    loadSpotRoutes(spotId);
  } catch (err) {
    console.error("[enterSpot] Error:", err);
    showToast("Erreur à l'ouverture du spot", true);
  }
};

function spotInteriorHTML(s, isLoggedIn) {
  const typeIcons  = { crag: "🧗", boulder: "🪨", indoor: "🏢", shop: "🛒" };
  const typeLabels = { crag: "Falaise", boulder: "Bloc", indoor: "Salle", shop: "Magasin" };
  const typeKey = s.type || "crag";

  return `
    <div class="spot-interior">
      <div class="si-header">
        <button class="si-back" onclick="window.backToSpotCard('${s.id}')" title="Retour">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="si-header__info">
          <span class="si-header__icon">${typeIcons[typeKey] || "📍"}</span>
          <div>
            <h3 class="si-header__name">${esc(s.name)}</h3>
            <span class="si-header__type">${typeLabels[typeKey] || typeKey}</span>
          </div>
        </div>
      </div>

      <div class="si-routes">
        <div class="si-routes__header">
          <h4 class="si-routes__title">Voies</h4>
          <span class="si-routes__count" id="routeCount-${s.id}"></span>
        </div>
        <div class="si-routes__list" id="routeList-${s.id}">
          <span class="sc-routes__loading">Chargement des voies...</span>
        </div>
        ${isLoggedIn ? `
        <div class="si-add-route">
          <h4 class="si-add-route__title">Ajouter une voie</h4>
          <form class="si-add-route__form" onsubmit="window.submitRoute(event, '${s.id}')">
            <input class="si-input" type="text" name="name" placeholder="Nom de la voie" required maxlength="120" />
            <div class="si-input-row">
              <input class="si-input" type="text" name="grade" placeholder="Cotation (6a+)" maxlength="10" />
              <select class="si-select" name="style">
                <option value="">Style</option>
                <option value="sport">Sport</option>
                <option value="trad">Trad</option>
                <option value="boulder">Bloc</option>
                <option value="multi">Grande voie</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div class="si-input-row">
              <input class="si-input" type="number" name="height" placeholder="Hauteur (m)" min="1" max="2000" step="1" />
              <input class="si-input" type="number" name="bolts" placeholder="Points" min="0" max="100" step="1" />
            </div>
            <textarea class="si-input si-textarea" name="description" placeholder="Description (optionnel)" maxlength="2000" rows="2"></textarea>
            <button class="btn si-submit" type="submit">Ajouter la voie</button>
          </form>
        </div>
        ` : `<p class="si-login-hint"><a href="./login.html">Connecte-toi</a> pour ajouter des voies.</p>`}
      </div>
    </div>
  `;
}

window.backToSpotCard = function(spotId) {
  const spot = allSpots.find(s => s.id === spotId);
  if (!spot) return;
  openSheet(spotCardHTML(spot), spot.id);
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

/* ---------- Wizard "Modifier un spot" ---------- */
const editModal = document.getElementById("editModal");

let editWizardStep    = 1;
let editWizardSpotId  = null;
let editWizardOrig    = null; // valeurs actuelles du spot
let editWizardData    = { name: "", type: "crag", soustype: null, orientation: null, niveau_min: "", niveau_max: "", description: "", rock: "", equipement: "", hauteur: "", acces: "", url: "" };
let editWizardPhotos  = [];

const eWizardTrack       = document.getElementById("eWizardTrack");
const eWizardProgressFill = document.getElementById("eWizardProgressFill");
const eWizardNextBtn     = document.getElementById("eWizardNextBtn");
const eWizardBackBtn     = document.getElementById("eWizardBackBtn");
const eWizardCloseBtn    = document.getElementById("eWizardCloseBtn");
const eDots = [1, 2, 3, 4, 5].map(i => document.getElementById(`eDot${i}`));

function populateEditLevelSelects() {
  const minSel = document.getElementById("eNiveauMin");
  const maxSel = document.getElementById("eNiveauMax");
  if (!minSel || !maxSel) return;
  const opts = GRADES.map(g => `<option value="${g}">${g}</option>`).join("");
  minSel.innerHTML = `<option value="">Min</option>${opts}`;
  maxSel.innerHTML = `<option value="">Max</option>${opts}`;
}

function updateEditWizardUI() {
  const TOTAL = 5;
  if (eWizardProgressFill) eWizardProgressFill.style.width = `${(editWizardStep / TOTAL) * 100}%`;
  if (eWizardTrack) eWizardTrack.style.transform = `translateX(-${(editWizardStep - 1) * 20}%)`;

  eDots.forEach((d, i) => {
    if (!d) return;
    d.classList.toggle("active", i + 1 === editWizardStep);
    d.classList.toggle("done",   i + 1 < editWizardStep);
  });

  if (eWizardBackBtn) eWizardBackBtn.style.display = editWizardStep > 1 ? "block" : "none";
  if (eWizardNextBtn) {
    eWizardNextBtn.textContent = editWizardStep < TOTAL ? "Suivant →" : "Envoyer la modification";
    eWizardNextBtn.disabled = false;
  }
}

function setEditErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || "";
}

function validateEditStep(step) {
  if (step === 1) {
    const name = document.getElementById("eName")?.value.trim() || "";
    if (!name) { setEditErr("errEditStep1", "Le nom du spot est obligatoire."); return false; }
    setEditErr("errEditStep1", "");
    editWizardData.name = name;
    editWizardData.type = document.querySelector("#editModal .type-card.active")?.dataset.type || "crag";
    return true;
  }
  if (step === 2) {
    editWizardData.soustype    = document.querySelector("#editModal .soustype-btn.active")?.dataset.soustype || null;
    editWizardData.niveau_min  = document.getElementById("eNiveauMin")?.value || "";
    editWizardData.niveau_max  = document.getElementById("eNiveauMax")?.value || "";
    editWizardData.description = document.getElementById("eDescription")?.value.trim() || "";
    editWizardData.orientation = document.querySelector("#editModal .compass-btn.active")?.dataset.dir || null;
    return true;
  }
  if (step === 3) {
    editWizardData.rock       = document.getElementById("eRock")?.value || "";
    editWizardData.equipement = document.getElementById("eEquipement")?.value || "";
    editWizardData.hauteur    = document.getElementById("eHauteur")?.value || "";
    editWizardData.acces      = document.getElementById("eAcces")?.value.trim() || "";
    editWizardData.url        = document.getElementById("eUrl")?.value.trim() || "";
    return true;
  }
  if (step === 4) {
    editWizardPhotos = Array.from(document.getElementById("ePhotoInput")?.files || []);
    return true;
  }
  return true;
}

function buildEditRecap() {
  const typeIcons = { crag: "🧗 Falaise", boulder: "🪨 Bloc", indoor: "🏢 Salle", shop: "🛒 Magasin" };
  const equipLabels = { spit: "Spit / Résine", piton: "Piton", mixte: "Mixte", non_equipe: "Non équipé" };
  const recap = document.getElementById("eRecapCard");
  if (!recap || !editWizardOrig) return;

  const orig = editWizardOrig;

  function diffRow(label, key, displayFn, newValOverride) {
    const newVal    = newValOverride !== undefined ? newValOverride : (editWizardData[key] || null);
    const oldVal    = orig[key] || null;
    const newDisplay = displayFn ? displayFn(newVal) : (newVal || "—");
    const oldDisplay = displayFn ? displayFn(oldVal) : (oldVal || "—");
    const changed   = (newVal || "") !== (oldVal || "");
    return `
      <div class="recap-row${changed ? " recap-row--changed" : ""}">
        <span class="recap-row__label">${label}</span>
        <span class="recap-row__value">
          ${changed && oldVal ? `<span class="recap-old">${oldDisplay}</span> → ` : ""}${newDisplay}
        </span>
      </div>`;
  }

  recap.innerHTML = `
    ${diffRow("Nom", "name")}
    ${diffRow("Type", "type", v => typeIcons[v] || v || "—")}
    ${diffRow("Style", "soustype")}
    ${diffRow("Niveau min", "niveau_min")}
    ${diffRow("Niveau max", "niveau_max")}
    ${diffRow("Orientation", "orientation")}
    ${diffRow("Description", "description")}
    ${diffRow("Rocher", "rock", null, editWizardData.rock || null)}
    ${diffRow("Équipement", "equipement", v => equipLabels[v] || v || "—")}
    ${diffRow("Hauteur (m)", "hauteur")}
    ${diffRow("Accès", "acces")}
    ${diffRow("Site web", "url")}
    <div class="recap-row">
      <span class="recap-row__label" style="font-size:.8rem">
        ${isMapAdmin() ? "✅ Appliqué immédiatement" : "⏳ Soumis à validation admin"}
      </span>
    </div>
  `;
}

function resetEditWizard() {
  editWizardStep = 1;
  editWizardData = { name: "", type: "crag", soustype: null, orientation: null, niveau_min: "", niveau_max: "", description: "", rock: "", equipement: "", hauteur: "", acces: "", url: "" };
  editWizardPhotos = [];
  const ePreview = document.getElementById("ePhotoPreviewGrid");
  if (ePreview) ePreview.innerHTML = "";
  const eInput = document.getElementById("ePhotoInput");
  if (eInput) eInput.value = "";
  ["errEditStep1", "errEditStep3", "errEditStep4"].forEach(id => setEditErr(id, ""));
  if (eWizardNextBtn) { eWizardNextBtn.style.display = ""; eWizardNextBtn.disabled = false; eWizardNextBtn.textContent = "Suivant →"; }
  const footer = document.getElementById("eWizardFooter");
  footer?.querySelectorAll("button:not(#eWizardNextBtn):not(#eWizardBackBtn)").forEach(b => b.remove());
  updateEditWizardUI();
}

/* Ouvrir le wizard d'édition pré-rempli */
window.editSpot = function(spotId) {
  const spot = allSpots.find(s => s.id === spotId);
  if (!spot) return;

  editWizardSpotId = spotId;
  editWizardOrig   = spot;

  populateEditLevelSelects();
  resetEditWizard();

  // Pré-remplir les données
  editWizardData.name        = spot.name || "";
  editWizardData.type        = spot.type || "crag";
  editWizardData.soustype    = spot.soustype || null;
  editWizardData.orientation = spot.orientation || null;
  editWizardData.niveau_min  = spot.niveau_min || "";
  editWizardData.niveau_max  = spot.niveau_max || "";
  editWizardData.description = spot.description || "";
  editWizardData.rock        = spot.info_complementaires?.rock || "";
  editWizardData.equipement  = spot.equipement || "";
  editWizardData.hauteur     = spot.hauteur ? String(spot.hauteur) : "";
  editWizardData.acces       = spot.acces || "";
  editWizardData.url         = spot.url || "";

  // Appliquer aux inputs
  const nameInput = document.getElementById("eName");
  if (nameInput) nameInput.value = editWizardData.name;

  document.querySelectorAll("#editModal .type-card").forEach(c => {
    c.classList.toggle("active", c.dataset.type === editWizardData.type);
  });

  // Soustype
  document.querySelectorAll("#editModal .soustype-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.soustype === editWizardData.soustype);
  });

  // Niveaux (après que les selects soient peuplés)
  setTimeout(() => {
    const minSel = document.getElementById("eNiveauMin");
    const maxSel = document.getElementById("eNiveauMax");
    if (minSel && editWizardData.niveau_min) minSel.value = editWizardData.niveau_min;
    if (maxSel && editWizardData.niveau_max) maxSel.value = editWizardData.niveau_max;
  }, 0);

  const descInput = document.getElementById("eDescription");
  if (descInput) descInput.value = editWizardData.description;

  document.querySelectorAll("#editModal .compass-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.dir === editWizardData.orientation);
  });

  const rockSel = document.getElementById("eRock");
  if (rockSel) rockSel.value = editWizardData.rock;
  const equipSel = document.getElementById("eEquipement");
  if (equipSel) equipSel.value = editWizardData.equipement;
  const hauteurInput = document.getElementById("eHauteur");
  if (hauteurInput) hauteurInput.value = editWizardData.hauteur;
  const accesInput = document.getElementById("eAcces");
  if (accesInput) accesInput.value = editWizardData.acces;
  const urlInput = document.getElementById("eUrl");
  if (urlInput) urlInput.value = editWizardData.url;

  closeSheet();
  editModal?.showModal();
};

/* Supprimer un spot (admin uniquement) */
window.deleteSpot = async function(spotId, spotName) {
  if (!confirm(`Supprimer le spot "${spotName}" ? Cette action est irréversible.`)) return;
  const token = getMapToken();
  try {
    const res = await fetch(`${API_BASE_URL}/api/spots/${spotId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
    closeSheet();
    allSpots = allSpots.filter(s => s.id !== spotId);
    allMarkers.delete(spotId);
    filterSpots();
  } catch (e) {
    alert(`Erreur : ${e.message}`);
  }
};

// Fermer le modal
eWizardCloseBtn?.addEventListener("click", () => editModal?.close());
editModal?.addEventListener("click", e => { if (e.target === editModal) editModal.close(); });

// Type cards (edit modal uniquement)
document.querySelectorAll("#editModal .type-card").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#editModal .type-card").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Boussole (edit modal uniquement)
document.querySelectorAll("#editModal .compass-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#editModal .compass-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Soustype (edit modal)
document.querySelectorAll("#editModal .soustype-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const isActive = btn.classList.contains("active");
    document.querySelectorAll("#editModal .soustype-btn").forEach(b => b.classList.remove("active"));
    if (!isActive) btn.classList.add("active");
  });
});

// Navigation : Suivant
eWizardNextBtn?.addEventListener("click", async () => {
  if (!validateEditStep(editWizardStep)) return;

  if (editWizardStep < 5) {
    editWizardStep++;
    if (editWizardStep === 5) buildEditRecap();
    updateEditWizardUI();
    return;
  }

  // Étape 3 → Soumettre
  eWizardNextBtn.disabled = true;
  eWizardNextBtn.textContent = "Envoi…";
  setEditErr("errEditStep3", "");

  const token = getMapToken();
  if (!token) {
    setEditErr("errEditStep3", "Tu n'es pas connecté. Reconnecte-toi.");
    eWizardNextBtn.disabled = false;
    eWizardNextBtn.textContent = "Réessayer";
    return;
  }

  // Calculer uniquement les champs modifiés
  const orig = editWizardOrig;
  const changes = {};
  if ((editWizardData.name || "") !== (orig.name || ""))
    changes.name = editWizardData.name;
  if ((editWizardData.type || "crag") !== (orig.type || "crag"))
    changes.type = editWizardData.type;
  if ((editWizardData.soustype || null) !== (orig.soustype || null))
    changes.soustype = editWizardData.soustype;
  if ((editWizardData.orientation || null) !== (orig.orientation || null))
    changes.orientation = editWizardData.orientation;
  if ((editWizardData.niveau_min || "") !== (orig.niveau_min || ""))
    changes.niveau_min = editWizardData.niveau_min || null;
  if ((editWizardData.niveau_max || "") !== (orig.niveau_max || ""))
    changes.niveau_max = editWizardData.niveau_max || null;
  if ((editWizardData.description || "") !== (orig.description || ""))
    changes.description = editWizardData.description || null;
  const origRock = orig.info_complementaires?.rock || "";
  if ((editWizardData.rock || "") !== origRock)
    changes.info_complementaires = { rock: editWizardData.rock || null };
  if ((editWizardData.equipement || "") !== (orig.equipement || ""))
    changes.equipement = editWizardData.equipement || null;
  const origHauteur = orig.hauteur ? String(orig.hauteur) : "";
  if ((editWizardData.hauteur || "") !== origHauteur)
    changes.hauteur = editWizardData.hauteur ? parseInt(editWizardData.hauteur, 10) : null;
  if ((editWizardData.acces || "") !== (orig.acces || ""))
    changes.acces = editWizardData.acces || null;
  if ((editWizardData.url || "") !== (orig.url || ""))
    changes.url = editWizardData.url || null;

  if (Object.keys(changes).length === 0) {
    setEditErr("errEditStep3", "Aucune modification détectée.");
    eWizardNextBtn.disabled = false;
    eWizardNextBtn.textContent = "Envoyer la modification";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/spot-edits`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ spotId: editWizardSpotId, changes }),
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = {}; }
    if (!res.ok) throw new Error(json?.detail || json?.error || `Erreur ${res.status}`);

    // Upload des photos si sélectionnées
    if (editWizardPhotos.length) {
      const formData = new FormData();
      editWizardPhotos.forEach(f => formData.append("photos", f));
      const photoRes = await fetch(`${API_BASE_URL}/api/spots/${editWizardSpotId}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }).catch(() => null);
      if (photoRes?.ok) {
        const photoJson = await photoRes.json().catch(() => ({}));
        const idx = allSpots.findIndex(s => s.id === editWizardSpotId);
        if (idx !== -1 && photoJson.photos) {
          allSpots[idx].photos = [...(allSpots[idx].photos || []), ...photoJson.photos];
        }
      }
    }

    const isAdmin = isMapAdmin();
    const recapCard = document.getElementById("eRecapCard");
    if (recapCard) {
      recapCard.innerHTML = `
        <div style="text-align:center;padding:1.5rem 0">
          <div style="font-size:3rem;margin-bottom:.75rem">${isAdmin ? "✅" : "⏳"}</div>
          <p style="font-weight:700;font-size:1.05rem;margin:0 0 .4rem">
            ${isAdmin ? "Modifications appliquées !" : "Demande envoyée !"}
          </p>
          <p style="font-size:.88rem;color:var(--text-2);margin:0">
            ${isAdmin
              ? "Le spot a été mis à jour sur la carte."
              : "Un admin va examiner ta modification. Suis son statut dans Paramètres → Mes demandes."
            }
          </p>
        </div>`;
    }
    eWizardNextBtn.style.display = "none";
    if (eWizardBackBtn) eWizardBackBtn.style.display = "none";

    const footer = document.getElementById("eWizardFooter");
    if (footer) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "btn";
      closeBtn.textContent = "Fermer";
      closeBtn.style.flex = "1";
      closeBtn.addEventListener("click", () => {
        editModal?.close();
        if (isAdmin) window.location.reload();
      });
      footer.appendChild(closeBtn);
    }
  } catch (err) {
    console.error("[edit-wizard] Erreur:", err);
    setEditErr("errEditStep3", "Erreur : " + err.message);
    eWizardNextBtn.disabled = false;
    eWizardNextBtn.textContent = "Réessayer";
  }
});

// Navigation : Retour
eWizardBackBtn?.addEventListener("click", () => {
  if (editWizardStep > 1) { editWizardStep--; updateEditWizardUI(); }
});

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
    const marker = allMarkers.get(s.id);
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
    filterSpots();
    // Display dropdown results from already-filtered spots
    const results = allSpots.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);
    displaySearchResults(results);
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
        <span class="search-result-name">${esc(s.name)}</span>
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
  openSheet(spotCardHTML(spot), spot.id);
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
let wizardData = { name: "", type: "crag", lat: null, lng: null, orientation: null, soustype: null, niveau_min: "", niveau_max: "", description: "", rock: "", equipement: "", hauteur: "", acces: "", url: "" };
let wizardPhotos = []; // fichiers sélectionnés dans l'étape photos

// DOM wizard
const wizardTrack = document.getElementById("wizardTrack");
const wizardProgressFill = document.getElementById("wizardProgressFill");
const wizardNextBtn = document.getElementById("wizardNextBtn");
const wizardBackBtn = document.getElementById("wizardBackBtn");
const wizardCloseBtn = document.getElementById("wizardCloseBtn");
const dots = [1,2,3,4,5,6].map(i => document.getElementById(`dot${i}`));

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
  const TOTAL = 6;
  const pct = (wizardStep / TOTAL) * 100;
  if (wizardProgressFill) wizardProgressFill.style.width = `${pct}%`;
  if (wizardTrack) wizardTrack.style.transform = `translateX(-${(wizardStep - 1) * (100/6)}%)`;

  dots.forEach((d, i) => {
    if (!d) return;
    d.classList.toggle("active", i + 1 === wizardStep);
    d.classList.toggle("done", i + 1 < wizardStep);
  });

  if (wizardBackBtn) wizardBackBtn.style.display = wizardStep > 1 ? "block" : "none";
  if (wizardNextBtn) {
    wizardNextBtn.textContent = wizardStep < TOTAL ? "Suivant →" : "Envoyer la demande";
    wizardNextBtn.style.display = "";
    wizardNextBtn.disabled = false;
  }
}

// Validation par étape
function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || "";
}

function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById("pName")?.value.trim() || "";
    if (!name) { setErr("errStep1", "Le nom du spot est obligatoire."); return false; }
    setErr("errStep1", "");
    wizardData.name = name;
    wizardData.type = document.querySelector("#proposeModal .type-card.active")?.dataset.type || "crag";
    return true;
  }
  if (step === 2) {
    const latVal = document.getElementById("pLat")?.value;
    const lngVal = document.getElementById("pLng")?.value;
    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    if (!latVal || !lngVal || isNaN(lat) || isNaN(lng)) {
      setErr("errStep2", "La position est obligatoire. Utilise le bouton de géolocalisation ou saisis les coordonnées.");
      return false;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setErr("errStep2", "Coordonnées invalides (lat: -90/+90, lng: -180/+180).");
      return false;
    }
    setErr("errStep2", "");
    wizardData.lat = lat;
    wizardData.lng = lng;
    return true;
  }
  if (step === 3) {
    wizardData.soustype    = document.querySelector("#proposeModal .soustype-btn.active")?.dataset.soustype || null;
    wizardData.niveau_min  = document.getElementById("pNiveauMin")?.value || "";
    wizardData.niveau_max  = document.getElementById("pNiveauMax")?.value || "";
    wizardData.description = document.getElementById("pDescription")?.value.trim() || "";
    wizardData.orientation = document.querySelector("#proposeModal .compass-btn.active")?.dataset.dir || null;
    return true;
  }
  if (step === 4) {
    wizardData.rock       = document.getElementById("pRock")?.value || "";
    wizardData.equipement = document.getElementById("pEquipement")?.value || "";
    wizardData.hauteur    = document.getElementById("pHauteur")?.value || "";
    wizardData.acces      = document.getElementById("pAcces")?.value.trim() || "";
    wizardData.url        = document.getElementById("pUrl")?.value.trim() || "";
    return true;
  }
  if (step === 5) {
    // Photos — optionnel, juste collecter les fichiers
    wizardPhotos = Array.from(document.getElementById("pPhotoInput")?.files || []);
    return true;
  }
  return true;
}

// Construction du récapitulatif
function buildRecap() {
  const typeIcons = { crag: "🧗 Falaise", boulder: "🪨 Bloc", indoor: "🏢 Salle", shop: "🛒 Magasin" };
  const equipLabels = { spit: "Spit / Résine", piton: "Piton", mixte: "Mixte", non_equipe: "Non équipé" };
  const recap = document.getElementById("recapCard");
  if (!recap) return;
  recap.innerHTML = `
    <div class="recap-row"><span class="recap-row__label">Nom</span><span class="recap-row__value">${esc(wizardData.name)}</span></div>
    <div class="recap-row"><span class="recap-row__label">Type</span><span class="recap-row__value">${esc(typeIcons[wizardData.type] || wizardData.type)}</span></div>
    <div class="recap-row"><span class="recap-row__label">Latitude</span><span class="recap-row__value">${esc(String(wizardData.lat?.toFixed(6)))}</span></div>
    <div class="recap-row"><span class="recap-row__label">Longitude</span><span class="recap-row__value">${esc(String(wizardData.lng?.toFixed(6)))}</span></div>
    ${wizardData.soustype ? `<div class="recap-row"><span class="recap-row__label">Style</span><span class="recap-row__value">${esc(wizardData.soustype)}</span></div>` : ""}
    ${wizardData.niveau_min ? `<div class="recap-row"><span class="recap-row__label">Niveau min</span><span class="recap-row__value">${esc(wizardData.niveau_min)}</span></div>` : ""}
    ${wizardData.niveau_max ? `<div class="recap-row"><span class="recap-row__label">Niveau max</span><span class="recap-row__value">${esc(wizardData.niveau_max)}</span></div>` : ""}
    ${wizardData.orientation ? `<div class="recap-row"><span class="recap-row__label">Orientation</span><span class="recap-row__value">${esc(wizardData.orientation)}</span></div>` : ""}
    ${wizardData.description ? `<div class="recap-row"><span class="recap-row__label">Description</span><span class="recap-row__value" style="font-size:.82rem">${esc(wizardData.description)}</span></div>` : ""}
    ${wizardData.rock ? `<div class="recap-row"><span class="recap-row__label">Rocher</span><span class="recap-row__value">${esc(wizardData.rock)}</span></div>` : ""}
    ${wizardData.equipement ? `<div class="recap-row"><span class="recap-row__label">Équipement</span><span class="recap-row__value">${esc(equipLabels[wizardData.equipement] || wizardData.equipement)}</span></div>` : ""}
    ${wizardData.hauteur ? `<div class="recap-row"><span class="recap-row__label">Hauteur</span><span class="recap-row__value">${esc(wizardData.hauteur)} m</span></div>` : ""}
    ${wizardData.acces ? `<div class="recap-row"><span class="recap-row__label">Accès</span><span class="recap-row__value" style="font-size:.82rem">${esc(wizardData.acces)}</span></div>` : ""}
    ${wizardData.url ? `<div class="recap-row"><span class="recap-row__label">Site web</span><span class="recap-row__value" style="font-size:.82rem">${esc(wizardData.url)}</span></div>` : ""}
    <div class="recap-row">
      <span class="recap-row__label" style="font-size:.8rem">${isMapAdmin() ? "✅ Sera approuvé immédiatement" : "⏳ Soumis à validation admin"}</span>
    </div>
  `;
}

// Réinitialiser le wizard
function resetWizard() {
  wizardStep = 1;
  wizardData = { name: "", type: "crag", lat: null, lng: null, orientation: null, soustype: null, niveau_min: "", niveau_max: "", description: "", rock: "", equipement: "", hauteur: "", acces: "", url: "" };
  wizardPhotos = [];
  ["pName","pLat","pLng","pNiveauMin","pNiveauMax","pDescription","pRock","pEquipement","pHauteur","pAcces","pUrl","pPhotoInput"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.querySelectorAll("#proposeModal .type-card").forEach((c, i) => c.classList.toggle("active", i === 0));
  document.querySelectorAll("#proposeModal .compass-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll("#proposeModal .soustype-btn").forEach(b => b.classList.remove("active"));
  const previewGrid = document.getElementById("pPhotoPreviewGrid");
  if (previewGrid) previewGrid.innerHTML = "";
  const cp = document.getElementById("coordsText");
  if (cp) cp.textContent = "Position non définie";
  ["errStep1","errStep2","errStep4"].forEach(id => setErr(id, ""));
  if (wizardNextBtn) { wizardNextBtn.style.display = ""; wizardNextBtn.disabled = false; wizardNextBtn.textContent = "Suivant →"; }
  const footer = document.querySelector(".wizard__footer");
  footer?.querySelectorAll("button:not(#wizardNextBtn):not(#wizardBackBtn)").forEach(b => b.remove());
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

// Type cards (propose modal uniquement)
document.querySelectorAll("#proposeModal .type-card").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#proposeModal .type-card").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Boussole (propose modal uniquement)
document.querySelectorAll("#proposeModal .compass-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#proposeModal .compass-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Soustype (propose modal)
document.querySelectorAll("#proposeModal .soustype-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const isActive = btn.classList.contains("active");
    document.querySelectorAll("#proposeModal .soustype-btn").forEach(b => b.classList.remove("active"));
    if (!isActive) btn.classList.add("active"); // toggle off si re-clic
  });
});

// Preview photos (propose)
document.getElementById("pPhotoInput")?.addEventListener("change", (e) => {
  const grid = document.getElementById("pPhotoPreviewGrid");
  if (!grid) return;
  grid.innerHTML = "";
  Array.from(e.target.files).slice(0, 5).forEach(file => {
    const img = document.createElement("img");
    img.className = "photo-preview-thumb";
    img.src = URL.createObjectURL(file);
    grid.appendChild(img);
  });
});

// Preview photos (edit)
document.getElementById("ePhotoInput")?.addEventListener("change", (e) => {
  const grid = document.getElementById("ePhotoPreviewGrid");
  if (!grid) return;
  grid.innerHTML = "";
  Array.from(e.target.files).slice(0, 5).forEach(file => {
    const img = document.createElement("img");
    img.className = "photo-preview-thumb";
    img.src = URL.createObjectURL(file);
    grid.appendChild(img);
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
        setErr("errStep2", "Impossible d'obtenir la position.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
});

// Navigation : Suivant
wizardNextBtn?.addEventListener("click", async () => {
  if (!validateStep(wizardStep)) return;

  if (wizardStep < 6) {
    wizardStep++;
    if (wizardStep === 6) buildRecap();
    updateWizardUI();
    return;
  }

  // Étape 4 → Soumettre
  wizardNextBtn.disabled = true;
  wizardNextBtn.textContent = "Envoi…";
  setErr("errStep4", "");

  const token = getMapToken();
  if (!token) {
    setErr("errStep4", "Tu n'es pas connecté. Reconnecte-toi et réessaie.");
    wizardNextBtn.disabled = false;
    wizardNextBtn.textContent = "Envoyer la demande";
    return;
  }

  const payload = {
    name: wizardData.name,
    type: wizardData.type,
    location: { type: "Point", coordinates: [wizardData.lng, wizardData.lat] },
  };
  if (wizardData.soustype)    payload.soustype    = wizardData.soustype;
  if (wizardData.orientation) payload.orientation = wizardData.orientation;
  if (wizardData.niveau_min)  payload.niveau_min  = wizardData.niveau_min;
  if (wizardData.niveau_max)  payload.niveau_max  = wizardData.niveau_max;
  if (wizardData.description) payload.description = wizardData.description;
  if (wizardData.rock)        payload.info_complementaires = { rock: wizardData.rock };
  if (wizardData.equipement)  payload.equipement  = wizardData.equipement;
  if (wizardData.hauteur)     payload.hauteur     = parseInt(wizardData.hauteur, 10);
  if (wizardData.acces)       payload.acces       = wizardData.acces;
  if (wizardData.url)         payload.url         = wizardData.url;

  console.log("[wizard] Envoi spot →", JSON.stringify(payload));

  try {
    const res = await fetch(`${API_BASE_URL}/api/spots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log("[wizard] Réponse", res.status, text);

    let json;
    try { json = JSON.parse(text); } catch { json = {}; }

    if (!res.ok) throw new Error(json?.detail || json?.error || `Erreur ${res.status}`);

    // Upload des photos si sélectionnées
    if (wizardPhotos.length && json.id) {
      const formData = new FormData();
      wizardPhotos.forEach(f => formData.append("photos", f));
      await fetch(`${API_BASE_URL}/api/spots/${json.id}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }).catch(() => {}); // photos non bloquantes
    }

    // Afficher un écran de succès dans le wizard
    const isAdmin = isMapAdmin();
    const recapCard = document.getElementById("recapCard");
    if (recapCard) {
      recapCard.innerHTML = `
        <div style="text-align:center;padding:1.5rem 0">
          <div style="font-size:3rem;margin-bottom:.75rem">${isAdmin ? "✅" : "⏳"}</div>
          <p style="font-weight:700;font-size:1.05rem;margin:0 0 .4rem">
            ${isAdmin ? "Spot ajouté !" : "Demande envoyée !"}
          </p>
          <p style="font-size:.88rem;color:var(--text-2);margin:0">
            ${isAdmin
              ? "Le spot est maintenant visible sur la carte."
              : "Un admin va valider ta demande. Tu peux suivre son statut dans Paramètres → Mes demandes."
            }
          </p>
        </div>`;
    }
    wizardNextBtn.style.display = "none";
    if (wizardBackBtn) wizardBackBtn.style.display = "none";

    // Bouton fermer dans le footer
    const footer = document.querySelector(".wizard__footer");
    if (footer) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "btn";
      closeBtn.textContent = "Fermer";
      closeBtn.style.flex = "1";
      closeBtn.addEventListener("click", () => {
        proposeModal?.close();
        // Recharger les spots si admin (approuvé immédiatement)
        if (isAdmin) window.location.reload();
      });
      footer.appendChild(closeBtn);
    }
  } catch (err) {
    console.error("[wizard] Erreur soumission:", err);
    setErr("errStep4", "Erreur : " + err.message);
    wizardNextBtn.disabled = false;
    wizardNextBtn.textContent = "Réessayer";
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
      m.on("click", () => openSheet(spotCardHTML(s), s.id));
      allMarkers.set(s.id, m);
      cluster.addLayer(m);
    });

    // Zoom initial : essayer la géoloc, sinon fallback sur tous les spots
    if (!userCentered) {
      const bounds = L.latLngBounds(allSpots.map((s) => [s.lat, s.lng]));
      const fallback = () => { if (!userCentered) map.fitBounds(bounds.pad(0.2)); };

      initGeoPrompt(fallback);
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

/* ---------- Bookmarks ---------- */
async function toggleBookmark(spotId) {
  const token = getMapToken();
  if (!token) { showToast("Connecte-toi pour sauvegarder des spots.", true); return; }

  const btn = document.querySelector(`.sc-bookmark[data-spot-id="${spotId}"]`);
  const isBookmarked = btn?.classList.contains("sc-bookmark--active");

  try {
    const method = isBookmarked ? "DELETE" : "POST";
    const res = await fetch(`${API_BASE_URL}/api/bookmarks/${spotId}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);

    if (btn) btn.classList.toggle("sc-bookmark--active");
    showToast(isBookmarked ? "Spot retiré des favoris" : "Spot sauvegardé !");
  } catch (e) {
    console.error("[bookmark]", e);
    showToast("Erreur lors de la sauvegarde.", true);
  }
}
window.toggleBookmark = toggleBookmark;

async function checkBookmarkStatus(spotId) {
  const token = getMapToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/bookmarks/check/${spotId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { bookmarked } = await res.json();
    const btn = document.querySelector(`.sc-bookmark[data-spot-id="${spotId}"]`);
    if (btn && bookmarked) btn.classList.add("sc-bookmark--active");
  } catch {}
}

/* ---------- Voies / Routes ---------- */
const STYLE_LABELS = { sport: "Sport", trad: "Trad", boulder: "Bloc", multi: "Grande voie", other: "Autre" };

async function loadSpotRoutes(spotId) {
  const listEl = document.getElementById(`routeList-${spotId}`);
  const countEl = document.getElementById(`routeCount-${spotId}`);
  if (!listEl) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/climbing-routes/spot/${spotId}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const routes = await res.json();

    if (countEl) countEl.textContent = routes.length ? `(${routes.length})` : "";

    if (!routes.length) {
      listEl.innerHTML = `<span class="sc-routes__empty">Aucune voie enregistrée</span>`;
      return;
    }

    listEl.innerHTML = routes.map(r => {
      const grade = r.grade ? `<span class="sc-route__grade">${esc(r.grade)}</span>` : "";
      const style = r.style ? `<span class="sc-route__style">${esc(STYLE_LABELS[r.style] || r.style)}</span>` : "";
      const height = r.height ? `<span class="sc-route__height">${esc(String(r.height))}m</span>` : "";
      return `
        <div class="sc-route">
          <span class="sc-route__name">${esc(r.name)}</span>
          <div class="sc-route__meta">${grade}${style}${height}</div>
        </div>
      `;
    }).join("");
  } catch (e) {
    console.error("[routes]", e);
    listEl.innerHTML = `<span class="sc-routes__empty">Erreur de chargement</span>`;
  }
}

async function submitRoute(e, spotId) {
  e.preventDefault();
  const token = getMapToken();
  if (!token) { showToast("Connecte-toi pour ajouter une voie.", true); return; }

  const form = e.target;
  const fd = new FormData(form);
  const body = { spotId, name: fd.get("name").trim() };
  if (!body.name) return;

  const grade = fd.get("grade")?.trim();
  const style = fd.get("style")?.trim();
  const height = parseFloat(fd.get("height"));
  const bolts = parseInt(fd.get("bolts"), 10);
  const desc = fd.get("description")?.trim();

  if (grade) body.grade = grade;
  if (style) body.style = style;
  if (Number.isFinite(height) && height > 0) body.height = height;
  if (Number.isFinite(bolts) && bolts >= 0) body.bolts = bolts;
  if (desc) body.description = desc;

  const btn = form.querySelector(".si-submit");
  if (btn) { btn.disabled = true; btn.textContent = "Ajout..."; }

  try {
    const res = await fetch(`${API_BASE_URL}/api/climbing-routes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    showToast("Voie ajoutée !");
    form.reset();
    loadSpotRoutes(spotId);
  } catch (err) {
    console.error("[submitRoute]", err);
    showToast("Erreur lors de l'ajout de la voie.", true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Ajouter la voie"; }
  }
}

/* ------------------------------------------------------------------ */
/* Photo viewer (plein écran simple)                                    */
/* ------------------------------------------------------------------ */
window.openPhoto = function(url) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out";
  const img = document.createElement("img");
  img.src = url;
  img.style.cssText = "max-width:95vw;max-height:92vh;border-radius:6px;object-fit:contain";
  overlay.appendChild(img);
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
};

/* ------------------------------------------------------------------ */
/* Upload photos                                                        */
/* ------------------------------------------------------------------ */
window.openPhotoUpload = function(spotId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.multiple = true;
  input.style.display = "none";
  document.body.appendChild(input);

  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    if (!files.length) { input.remove(); return; }
    if (files.length > 5) { showToast("Maximum 5 photos par upload.", true); input.remove(); return; }

    const token = getMapToken();
    if (!token) { showToast("Tu dois être connecté.", true); input.remove(); return; }

    showToast("Upload en cours…");
    const formData = new FormData();
    files.forEach(f => formData.append("photos", f));

    try {
      const res = await fetch(`${API_BASE_URL}/api/spots/${spotId}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      showToast(`${json.photos?.length || files.length} photo(s) ajoutée(s) !`);
      // Mettre à jour les photos dans allSpots sans recharger toute la page
      const idx = allSpots.findIndex(s => s.id === spotId);
      if (idx !== -1 && json.photos) {
        allSpots[idx].photos = [...(allSpots[idx].photos || []), ...json.photos];
      }
      closeSheet();
    } catch (err) {
      showToast("Erreur upload : " + err.message, true);
    } finally {
      input.remove();
    }
  });

  input.click();
};
window.submitRoute = submitRoute;
