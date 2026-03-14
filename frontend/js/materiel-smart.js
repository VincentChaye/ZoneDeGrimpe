// UI functions will be loaded from ui.js script tag

// --- Auth guard: redirige vers login si pas de token ---
(function ensureAuth() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) throw new Error("no-auth");
    const obj = JSON.parse(raw);
    if (!obj?.token || !obj?.user?._id) throw new Error("bad-auth");
  } catch {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `./login.html?next=${next}`;
  }
})();

// === Config API ===
const API_BASE = (window.APP_CONFIG?.API_URL || "http://localhost:3000") + "/api";
const ENDPOINT = {
  USER_MAT: API_BASE + "/user_materiel",
  SPECS: API_BASE + "/materiel_specs",
};

// --- Auth helpers ---
function getAuth() {
  try {
    const s = localStorage.getItem("auth");
    if (!s) return { userId: null, token: null };
    const obj = JSON.parse(s);
    const userId = obj?.user?._id || obj?._id || obj?.userId || null;
    const token = obj?.token || obj?.jwt || obj?.accessToken || null;
    return { userId, token };
  } catch {
    return { userId: null, token: null };
  }
}

async function fetchJSON(url, opts = {}) {
  const { token } = getAuth();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} – ${text || res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

// === Configuration du matériel ===
const MATERIAL_CONFIG = {
  // Catégories chargées dynamiquement depuis l'API
  categories: {},
  availableCategories: [], // Liste simple des noms de catégories

  // États possibles
  states: {
    "new": "Neuf",
    "good": "Bon état",
    "worn": "Usé mais utilisable",
    "retire-soon": "À retirer bientôt",
    "retired": "Retiré du service"
  }
};

// Fonction pour récupérer les spécifications des catégories depuis l'API
async function loadCategoriesFromAPI() {
  try {
    const response = await fetchJSON(ENDPOINT.SPECS);
    const specs = response.items || [];
    
    // Construire l'objet categories avec les defaults depuis Materiel_Specs
    specs.forEach(spec => {
      const category = spec.category;
      const defaults = spec.lifecycleDefaults || {};
      
      MATERIAL_CONFIG.categories[category] = {
        inspectionInterval: defaults.maxMonthsBetweenInspections || 12,
        maxUsage: defaults.maxOutings || null,
        description: defaults.notes || `Équipement de type ${category}`
      };
    });
    
    // Créer la liste simple des catégories triée
    MATERIAL_CONFIG.availableCategories = Object.keys(MATERIAL_CONFIG.categories).sort();
    
    console.log("Catégories chargées:", MATERIAL_CONFIG.availableCategories);
  } catch (err) {
    console.error("Erreur lors du chargement des catégories:", err);
    // Valeurs par défaut en cas d'erreur
    MATERIAL_CONFIG.categories = {
      "Autre": {
        inspectionInterval: 6,
        maxUsage: null,
        description: "Autre équipement"
      }
    };
    MATERIAL_CONFIG.availableCategories = ["Autre"];
  }
}

// === UI refs ===
let listEl, addBtn, modal, form, title, search, tagFilter;

function initializeUIElements() {
  if (typeof initCommonUI === 'function' && !document.body.hasAttribute('data-ui-initialized')) {
    initCommonUI();
    document.body.setAttribute('data-ui-initialized', 'true');
  }
  listEl = document.getElementById("gearList");
  addBtn = document.getElementById("addGearBtn");
  modal = document.getElementById("gearModal");
  form = document.getElementById("gearForm");
  title = document.getElementById("gearFormTitle");
  search = document.getElementById("gearSearch");
  tagFilter = document.getElementById("gearTagFilter");
}

// Fonction pour remplir le filtre de catégories
function populateCategoryFilter() {
  if (!tagFilter) return;
  
  // Sauvegarder la valeur actuelle
  const currentValue = tagFilter.value;
  
  // Vider et remplir avec les nouvelles catégories
  tagFilter.innerHTML = '<option value="">Toutes catégories</option>';
  
  MATERIAL_CONFIG.availableCategories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    tagFilter.appendChild(option);
  });
  
  // Restaurer la valeur si elle existe toujours
  if (currentValue && MATERIAL_CONFIG.availableCategories.includes(currentValue)) {
    tagFilter.value = currentValue;
  }
}

let rows = [];
let editingId = null;

// === Helpers ===
function escapeHTML(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// === Formulaire intelligent ===
function createSmartForm() {
  // Générer les options de catégories dynamiquement
  const categoryOptions = MATERIAL_CONFIG.availableCategories.map(category => {
    const config = MATERIAL_CONFIG.categories[category];
    return `<option value="${category}" title="${config.description}">${category}</option>`;
  }).join('');
  
  const formHTML = `
    <button type="button" class="modal__close" id="modalCloseBtn" aria-label="Fermer">×</button>
    <h2 id="gearFormTitle">Équipement</h2>
    
    <!-- Informations de base -->
    <div class="form-section">
      <h3>Informations générales</h3>
      
      <label>Nom de l'équipement (optionnel)
        <input name="name" class="input" placeholder="Ex: Corde principale, Casque rouge..." />
      </label>
      
      <label>Catégorie *
        <select name="category" class="select" required>
          <option value="">Choisir une catégorie...</option>
          ${categoryOptions}
        </select>
      </label>
      
      <div class="form-row">
        <label>Marque
          <input name="brand" class="input" placeholder="Ex: Petzl, Black Diamond..." />
        </label>
        <label>Modèle
          <input name="model" class="input" placeholder="Ex: Mambo 10.1mm, Vector..." />
        </label>
      </div>
    </div>

    <!-- État et utilisation -->
    <div class="form-section">
      <h3>État et utilisation</h3>
      
      <label>État actuel
        <select name="state" class="select">
          ${Object.entries(MATERIAL_CONFIG.states).map(([key, label]) =>
    `<option value="${key}">${label}</option>`
  ).join('')}
        </select>
      </label>
      
      <div class="usage-section" id="usageSection">
        <label>Nombre d'utilisations
          <div class="usage-controls">
            <button type="button" class="btn btn--ghost" id="decreaseUsage">-</button>
            <input type="number" name="usageCount" class="input usage-input" min="0" value="0" readonly />
            <button type="button" class="btn btn--ghost" id="increaseUsage">+</button>
          </div>
          <small class="usage-hint" id="usageHint"></small>
        </label>
      </div>
    </div>

    <!-- Achat (optionnel) -->
    <div class="form-section">
      <h3>Informations d'achat (optionnel)</h3>
      
      <div class="form-row">
        <label>Date d'achat
          <input type="date" name="purchaseDate" class="input" />
        </label>
        <label>Prix (€)
          <input type="number" name="price" class="input" step="0.01" min="0" placeholder="0.00" />
        </label>
      </div>
    </div>

    <!-- Inspection intelligente -->
    <div class="form-section">
      <h3>Inspection</h3>
      
      <label>Dernière inspection
        <input type="date" name="lastInspection" class="input" />
      </label>
      
      <div class="inspection-info" id="inspectionInfo">
        <p class="info-text">La prochaine inspection sera calculée automatiquement selon la catégorie.</p>
      </div>
    </div>

    <!-- Notes -->
    <div class="form-section">
      <label>Notes et observations
        <textarea name="notes" class="input" rows="3" placeholder="Défauts observés, historique, particularités..."></textarea>
      </label>
    </div>

    <menu class="modal__actions">
      <button type="button" class="btn btn--ghost" id="cancelBtn">Annuler</button>
      <button type="submit" class="btn" id="gearSubmitBtn">Enregistrer</button>
    </menu>
    <input type="hidden" name="id" />
  `;

  if (form) form.innerHTML = formHTML;
  setupFormInteractions();
  setupModalCloseHandlers();
}

function setupModalCloseHandlers() {
  const closeBtn = form.querySelector('#modalCloseBtn');
  const cancelBtn = form.querySelector('#cancelBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.close();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (modal) modal.close();
    });
  }
}

function setupFormInteractions() {
  const categorySelect = form.querySelector('[name="category"]');
  const usageInput = form.querySelector('[name="usageCount"]');
  const decreaseBtn = form.querySelector('#decreaseUsage');
  const increaseBtn = form.querySelector('#increaseUsage');
  const usageHint = form.querySelector('#usageHint');
  const inspectionInfo = form.querySelector('#inspectionInfo');
  const lastInspectionInput = form.querySelector('[name="lastInspection"]');

  // Gestion des boutons +/-
  decreaseBtn.addEventListener('click', () => {
    const current = parseInt(usageInput.value) || 0;
    if (current > 0) {
      usageInput.value = current - 1;
      updateUsageHint();
    }
  });

  increaseBtn.addEventListener('click', () => {
    const current = parseInt(usageInput.value) || 0;
    usageInput.value = current + 1;
    updateUsageHint();
  });

  // Mise à jour des hints selon la catégorie
  categorySelect.addEventListener('change', () => {
    updateUsageHint();
    updateInspectionInfo();
  });

  lastInspectionInput.addEventListener('change', updateInspectionInfo);

  function updateUsageHint() {
    const category = categorySelect.value;
    const usage = parseInt(usageInput.value) || 0;

    if (!category || !MATERIAL_CONFIG.categories[category]) {
      usageHint.textContent = '';
      return;
    }

    const config = MATERIAL_CONFIG.categories[category];
    if (config.maxUsage) {
      const percentage = Math.round((usage / config.maxUsage) * 100);
      let message = `${usage}/${config.maxUsage} utilisations (${percentage}%)`;

      if (percentage > 90) {
        message += ' ⚠️ À remplacer';
        usageHint.className = 'usage-hint warning';
      } else if (percentage > 70) {
        message += ' ⚡ Surveiller';
        usageHint.className = 'usage-hint caution';
      } else {
        usageHint.className = 'usage-hint';
      }

      usageHint.textContent = message;
    } else {
      usageHint.textContent = `${usage} utilisations`;
      usageHint.className = 'usage-hint';
    }
  }

  function updateInspectionInfo() {
    const category = categorySelect.value;
    const lastInspection = lastInspectionInput.value;

    if (!category || !MATERIAL_CONFIG.categories[category]) {
      inspectionInfo.innerHTML = '<p class="info-text">Sélectionnez une catégorie pour voir les recommandations d\'inspection.</p>';
      return;
    }

    const config = MATERIAL_CONFIG.categories[category];
    let html = `<p class="info-text">Inspection recommandée tous les <strong>${config.inspectionInterval} mois</strong> pour cette catégorie.</p>`;

    if (lastInspection) {
      const nextInspection = addMonths(new Date(lastInspection), config.inspectionInterval);
      const today = new Date();
      const daysUntil = Math.ceil((nextInspection - today) / (1000 * 60 * 60 * 24));

      html += `<p class="info-text">Prochaine inspection prévue : <strong>${formatDate(nextInspection)}</strong>`;

      if (daysUntil < 0) {
        html += ` ⚠️ <span class="warning">En retard de ${Math.abs(daysUntil)} jours</span>`;
      } else if (daysUntil <= 30) {
        html += ` ⚡ <span class="caution">Dans ${daysUntil} jours</span>`;
      } else {
        html += ` ✅ <span class="ok">Dans ${daysUntil} jours</span>`;
      }

      html += '</p>';
    }

    inspectionInfo.innerHTML = html;
  }

  // Initialisation
  updateUsageHint();
  updateInspectionInfo();
}

// === Conversion des données ===
function formToPayload(fd) {
  const category = fd.get("category") || "Autre";
  const lastInspection = fd.get("lastInspection");

  // Calcul automatique de la prochaine inspection
  let nextInspection = null;
  if (lastInspection && MATERIAL_CONFIG.categories[category]) {
    const config = MATERIAL_CONFIG.categories[category];
    nextInspection = addMonths(new Date(lastInspection), config.inspectionInterval);
  }

  const payload = {
    category,
    specs: {
      name: fd.get("name") || null,
      brand: fd.get("brand") || null,
      model: fd.get("model") || null,
    },
    lifecycle: {
      condition: fd.get("state") || "good",
      notes: fd.get("notes") || null,
      usageCount: parseInt(fd.get("usageCount")) || 0,
    }
  };

  // Ajout des dates d'inspection si disponibles
  if (lastInspection) {
    payload.lifecycle.lastInspectionAt = new Date(lastInspection).toISOString();
  }
  if (nextInspection) {
    payload.lifecycle.nextInspectionAt = nextInspection.toISOString();
  }

  // Ajout des informations d'achat si disponibles
  const purchaseDate = fd.get("purchaseDate");
  const price = fd.get("price");

  if (purchaseDate) {
    payload.purchase = { date: new Date(purchaseDate).toISOString() };
  }

  if (price) {
    payload.specs.price = parseFloat(price);
  }

  return payload;
}

function fillFormFromRow(item) {
  form.reset();

  if (!item) return;

  form.elements.id.value = item._id;
  form.elements.name.value = item?.specs?.name || "";
  form.elements.brand.value = item?.specs?.brand || "";
  form.elements.model.value = item?.specs?.model || "";
  form.elements.category.value = item?.category || "";
  form.elements.state.value = item?.lifecycle?.condition || "good";
  form.elements.usageCount.value = item?.lifecycle?.usageCount || 0;
  form.elements.notes.value = item?.lifecycle?.notes || "";

  if (item?.purchase?.date) {
    form.elements.purchaseDate.value = formatDate(item.purchase.date);
  }

  if (item?.specs?.price) {
    form.elements.price.value = item.specs.price;
  }

  if (item?.lifecycle?.lastInspectionAt) {
    form.elements.lastInspection.value = formatDate(item.lifecycle.lastInspectionAt);
  }

  // Déclencher les mises à jour des hints
  setTimeout(() => {
    const categorySelect = form.querySelector('[name="category"]');
    const lastInspectionInput = form.querySelector('[name="lastInspection"]');

    categorySelect.dispatchEvent(new Event('change'));
    lastInspectionInput.dispatchEvent(new Event('change'));
  }, 100);
}

// === Affichage des cartes ===
const CATEGORY_ICONS = {
  "Corde": "🪢", "Dégaine": "🪝", "Casque": "⛑️", "Baudrier": "🧗",
  "Chausson": "👟", "Friend": "⚙️", "Mousqueton": "🔗", "Sac": "🎒",
  "Magnésie": "⚪", "Coinceur": "🔩", "Longe": "🪤", "Vêtement": "🧥",
  "Crochet": "🪝", "Plaquette": "🔩", "Dévisseur": "🔧", "Autre": "📦"
};

function rowToCard(item) {
  const cat = item?.category || "Autre";
  const icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS[Object.keys(CATEGORY_ICONS).find(k => cat.toLowerCase().includes(k.toLowerCase())) || "Autre"] || "📦";
  const name = item?.specs?.name
    || (`${item?.specs?.brand || ""} ${item?.specs?.model || ""}`.trim())
    || cat
    || "?";
  const shortName = name.length > 10 ? name.substring(0, 10) + "…" : name;
  const condition = item?.lifecycle?.condition || "good";

  // Update gear count stat after render
  setTimeout(() => {
    const rows_count = document.getElementById('gearList')?.querySelectorAll('.inv-cell').length;
    if (window.updateGearCount && rows_count !== undefined) window.updateGearCount(rows_count);
  }, 50);

  return `
    <div class="inv-cell inv-cell--${condition}" title="${escapeHTML(name)}\n${escapeHTML(cat)} · ${condition}">
      <div class="inv-cell__icon">${icon}</div>
      <div class="inv-cell__name">${escapeHTML(shortName)}</div>
      <button class="inv-cell__edit" data-edit="${item._id}" title="Modifier">✎</button>
      <button class="inv-cell__del" data-del="${item._id}" title="Supprimer">×</button>
    </div>`;
}

// === API calls ===
async function apiList() {
  const qs = new URLSearchParams();
  if (tagFilter && tagFilter.value) qs.set("category", tagFilter.value);
  const res = await fetchJSON(`${ENDPOINT.USER_MAT}?${qs.toString()}`);
  return res.items || [];
}

async function apiCreate(payload) {
  const res = await fetchJSON(ENDPOINT.USER_MAT, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res?.id;
}

async function apiPatch(id, partial) {
  await fetchJSON(`${ENDPOINT.USER_MAT}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(partial),
  });
}

async function apiDelete(id) {
  await fetchJSON(`${ENDPOINT.USER_MAT}/${id}`, { method: "DELETE" });
}

// === UI actions ===
async function refresh() {
  try {
    const q = (search && search.value || "").toLowerCase();
    rows = await apiList();

    const filtered = rows.filter(item => {
      const searchText = JSON.stringify(item).toLowerCase();
      return !q || searchText.includes(q);
    });

    if (listEl) listEl.innerHTML = filtered.length
      ? filtered.map(rowToCard).join("")
      : `<div class="inv-empty"><p>📦</p><p>Aucun matériel pour le moment</p></div>`;

    // Attacher les événements
    if (listEl) listEl.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = rows.find(x => String(x._id) === btn.dataset.edit);
        editingId = item?._id || null;
        if (title) title.textContent = "Modifier l'équipement";
        fillFormFromRow(item);
        if (modal) modal.showModal();
      });
    });

    if (listEl) listEl.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const item = rows.find(x => String(x._id) === btn.dataset.del);
        const itemName = item?.specs?.name || item?.category || "cet équipement";

        if (!confirm(`Êtes-vous sûr de vouloir supprimer "${itemName}" ?`)) return;

        try {
          await apiDelete(btn.dataset.del);
          await refresh();
        } catch (err) {
          alert(`Erreur lors de la suppression : ${err.message}`);
        }
      });
    });

  } catch (err) {
    console.error("Erreur lors du chargement:", err);
    if (listEl) listEl.innerHTML = `<div class="error-state">
      <p>❌ Erreur de chargement</p>
      <p>${escapeHTML(err.message)}</p>
      <button class="btn" onclick="refresh()">Réessayer</button>
    </div>`;
  }
}

// === Event listeners ===
function openAddGearModal() {
  editingId = null;
  if (title) title.textContent = "Nouvel équipement";

  // Reset le formulaire
  if (form) {
    form.reset();

    // Réinitialiser les interactions du formulaire
    setTimeout(() => {
      const categorySelect = form.querySelector('[name="category"]');
      if (categorySelect) {
        categorySelect.dispatchEvent(new Event('change'));
      }
    }, 50);
  }

  // Ouvrir le modal
  if (modal) {
    modal.showModal();
  } else {
    console.error("Modal non trouvé");
  }
}



// === Event listeners (configurés après le DOM) ===
function setupEventListeners() {
  // Soumission du formulaire
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const submitBtn = form.querySelector('#gearSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = "Enregistrement...";

        const fd = new FormData(form);
        const payload = formToPayload(fd);

        console.log("📦 Envoi du payload:", payload);

        if (editingId) {
          console.log("✏️ Modification de l'équipement", editingId);
          await apiPatch(editingId, payload);
        } else {
          console.log("➕ Ajout d'un nouvel équipement");
          const newId = await apiCreate(payload);
          console.log("✅ Équipement ajouté avec l'ID:", newId);
        }

        if (modal) modal.close();
        await refresh();

      } catch (err) {
        console.error("❌ Erreur lors de l'enregistrement:", err);
        alert(`Erreur : ${err.message}`);
      } finally {
        const submitBtn = form.querySelector('#gearSubmitBtn');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Enregistrer";
        }
      }
    });
  }

  // Fermeture du modal
  if (modal) {
    modal.addEventListener("close", () => {
      editingId = null;
      if (form) form.reset();
    });
  }

  // Recherche et filtres
  if (search) search.addEventListener("input", refresh);
  if (tagFilter) tagFilter.addEventListener("change", refresh);
}

// === Gestion des onglets ===
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;

      // Désactiver tous les onglets
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Activer l'onglet sélectionné
      button.classList.add('active');
      const targetContent = document.getElementById(`tab-${targetTab}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // Actions spécifiques selon l'onglet
      switch (targetTab) {
        case 'inventory':
          refresh();
          break;
        case 'maintenance':
          initMaintenanceTab();
          break;
        case 'advice':
          initAdviceTab();
          break;
        case 'stats':
          initStatsTab();
          break;
      }
    });
  });
}

function initMaintenanceTab() {
  const checkInspectionsBtn = document.getElementById('checkInspectionsBtn');
  const checkRetireBtn = document.getElementById('checkRetireBtn');
  const inspectionDays = document.getElementById('inspectionDays');
  const retireThreshold = document.getElementById('retireThreshold');
  const inspectionsList = document.getElementById('inspectionsList');
  const retireList = document.getElementById('retireList');

  if (checkInspectionsBtn) {
    checkInspectionsBtn.addEventListener('click', async () => {
      const days = parseInt(inspectionDays.value) || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + days);

      const items = await apiList();
      const needsInspection = items.filter(item => {
        if (!item.lifecycle?.nextInspectionAt) return false;
        const nextInspection = new Date(item.lifecycle.nextInspectionAt);
        return nextInspection <= cutoffDate;
      });

      if (needsInspection.length === 0) {
        inspectionsList.innerHTML = '<p class="info-text">✅ Aucune inspection prévue dans cette période</p>';
      } else {
        inspectionsList.innerHTML = needsInspection.map(item => {
          const name = item?.specs?.name || item?.category || "Équipement";
          const nextDate = new Date(item.lifecycle.nextInspectionAt).toLocaleDateString();
          const daysUntil = Math.ceil((new Date(item.lifecycle.nextInspectionAt) - new Date()) / (1000 * 60 * 60 * 24));
          const urgency = daysUntil < 0 ? 'urgent' : daysUntil <= 7 ? 'warning' : 'normal';

          return `
            <div class="maintenance-item ${urgency}">
              <h4>${escapeHTML(name)}</h4>
              <p>Inspection prévue : ${nextDate} ${daysUntil < 0 ? `(en retard de ${Math.abs(daysUntil)} jours)` : `(dans ${daysUntil} jours)`}</p>
            </div>
          `;
        }).join('');
      }
    });
  }

  if (checkRetireBtn) {
    checkRetireBtn.addEventListener('click', async () => {
      const threshold = parseFloat(retireThreshold.value) || 0.8;
      const items = await apiList();
      const toRetire = items.filter(item => {
        const usage = item.lifecycle?.usageCount || 0;
        const category = item.category;
        const config = MATERIAL_CONFIG.categories[category];

        if (!config?.maxUsage) return false;

        const usageRatio = usage / config.maxUsage;
        return usageRatio >= threshold;
      });

      if (toRetire.length === 0) {
        retireList.innerHTML = '<p class="info-text">✅ Aucun matériel à remplacer selon ce seuil</p>';
      } else {
        retireList.innerHTML = toRetire.map(item => {
          const name = item?.specs?.name || item?.category || "Équipement";
          const usage = item.lifecycle?.usageCount || 0;
          const config = MATERIAL_CONFIG.categories[item.category];
          const percentage = Math.round((usage / config.maxUsage) * 100);

          return `
            <div class="maintenance-item urgent">
              <h4>${escapeHTML(name)}</h4>
              <p>Usure : ${usage}/${config.maxUsage} utilisations (${percentage}%)</p>
            </div>
          `;
        }).join('');
      }
    });
  }
}

function initAdviceTab() {
  const getMaterialAdviceBtn = document.getElementById('getMaterialAdviceBtn');
  const getSpotsAdviceBtn = document.getElementById('getSpotsAdviceBtn');
  const getLocationBtn = document.getElementById('getLocationBtn');

  if (getLocationBtn) {
    getLocationBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            document.getElementById('adviceLat').value = position.coords.latitude.toFixed(6);
            document.getElementById('adviceLng').value = position.coords.longitude.toFixed(6);
            document.getElementById('spotsLat').value = position.coords.latitude.toFixed(6);
            document.getElementById('spotsLng').value = position.coords.longitude.toFixed(6);
          },
          (error) => {
            alert('Impossible d\'obtenir votre position : ' + error.message);
          }
        );
      } else {
        alert('La géolocalisation n\'est pas supportée par votre navigateur');
      }
    });
  }

  if (getMaterialAdviceBtn) {
    getMaterialAdviceBtn.addEventListener('click', async () => {
      const materialAdvice = document.getElementById('materialAdvice');
      materialAdvice.innerHTML = '<p>Analyse en cours...</p>';

      try {
        const items = await apiList();
        const analysis = analyzeMaterial(items);
        materialAdvice.innerHTML = analysis;
      } catch (err) {
        materialAdvice.innerHTML = `<p class="error">Erreur : ${err.message}</p>`;
      }
    });
  }

  if (getSpotsAdviceBtn) {
    getSpotsAdviceBtn.addEventListener('click', async () => {
      const spotsAdvice = document.getElementById('spotsAdvice');
      spotsAdvice.innerHTML = '<p>Recherche en cours...</p>';

      // Simulation d'une recherche de spots
      setTimeout(() => {
        spotsAdvice.innerHTML = `
          <div class="advice-results">
            <p class="info-text">🏔️ Fonctionnalité en développement</p>
            <p>La recherche de spots sera bientôt disponible avec l'intégration de la base de données des falaises.</p>
          </div>
        `;
      }, 1000);
    });
  }
}

function analyzeMaterial(items) {
  if (items.length === 0) {
    return '<p class="info-text">📦 Aucun matériel à analyser. Ajoutez du matériel pour obtenir des conseils.</p>';
  }

  const categories = {};
  let totalValue = 0;
  let needsInspection = 0;
  let needsReplacement = 0;

  items.forEach(item => {
    const category = item.category || 'Autre';
    categories[category] = (categories[category] || 0) + 1;

    if (item.specs?.price) {
      totalValue += item.specs.price;
    }

    // Vérification inspection
    if (item.lifecycle?.nextInspectionAt) {
      const nextInspection = new Date(item.lifecycle.nextInspectionAt);
      const daysUntil = Math.ceil((nextInspection - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 30) needsInspection++;
    }

    // Vérification remplacement
    const usage = item.lifecycle?.usageCount || 0;
    const config = MATERIAL_CONFIG.categories[category];
    if (config?.maxUsage && usage / config.maxUsage >= 0.8) {
      needsReplacement++;
    }
  });

  let html = '<div class="analysis-results">';

  html += `<h4>📊 Résumé de votre inventaire</h4>`;
  html += `<p><strong>${items.length}</strong> équipements au total</p>`;

  html += '<h4>📦 Répartition par catégorie</h4>';
  html += '<ul>';
  Object.entries(categories).forEach(([cat, count]) => {
    html += `<li>${cat} : ${count} équipement${count > 1 ? 's' : ''}</li>`;
  });
  html += '</ul>';

  if (totalValue > 0) {
    html += `<h4>💰 Valeur estimée</h4>`;
    html += `<p><strong>${totalValue.toFixed(2)}€</strong> au total</p>`;
  }

  if (needsInspection > 0 || needsReplacement > 0) {
    html += '<h4>⚠️ Actions recommandées</h4>';
    if (needsInspection > 0) {
      html += `<p class="warning">🔍 ${needsInspection} équipement${needsInspection > 1 ? 's' : ''} nécessite${needsInspection > 1 ? 'nt' : ''} une inspection prochainement</p>`;
    }
    if (needsReplacement > 0) {
      html += `<p class="urgent">🔄 ${needsReplacement} équipement${needsReplacement > 1 ? 's' : ''} à remplacer bientôt</p>`;
    }
  } else {
    html += '<p class="success">✅ Votre matériel semble en bon état !</p>';
  }

  html += '</div>';
  return html;
}

function initStatsTab() {
  const inventoryStats = document.getElementById('inventoryStats');
  const valueStats = document.getElementById('valueStats');
  const conditionStats = document.getElementById('conditionStats');

  apiList().then(items => {
    // Stats inventaire
    const categories = {};
    items.forEach(item => {
      const cat = item.category || 'Autre';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    let inventoryHTML = `<p><strong>${items.length}</strong> équipements</p>`;
    inventoryHTML += '<div class="stats-breakdown">';
    Object.entries(categories).forEach(([cat, count]) => {
      inventoryHTML += `<div class="stat-item">${cat}: ${count}</div>`;
    });
    inventoryHTML += '</div>';
    inventoryStats.innerHTML = inventoryHTML;

    // Stats valeur
    const totalValue = items.reduce((sum, item) => sum + (item.specs?.price || 0), 0);
    const avgValue = items.length > 0 ? totalValue / items.length : 0;

    let valueHTML = `<p><strong>${totalValue.toFixed(2)}€</strong> au total</p>`;
    if (avgValue > 0) {
      valueHTML += `<p>Moyenne: ${avgValue.toFixed(2)}€</p>`;
    }
    valueStats.innerHTML = valueHTML;

    // Stats condition
    const conditions = {};
    items.forEach(item => {
      const cond = item.lifecycle?.condition || 'good';
      conditions[cond] = (conditions[cond] || 0) + 1;
    });

    let conditionHTML = '<div class="condition-breakdown">';
    Object.entries(conditions).forEach(([cond, count]) => {
      const label = MATERIAL_CONFIG.states[cond] || cond;
      const percentage = Math.round((count / items.length) * 100);
      conditionHTML += `
        <div class="condition-stat">
          <span class="condition-label">${label}</span>
          <span class="condition-count">${count} (${percentage}%)</span>
        </div>
      `;
    });
    conditionHTML += '</div>';
    conditionStats.innerHTML = conditionHTML;

  }).catch(err => {
    console.error('Erreur lors du chargement des stats:', err);
    inventoryStats.innerHTML = '<p class="error">Erreur de chargement</p>';
    valueStats.innerHTML = '<p class="error">Erreur de chargement</p>';
    conditionStats.innerHTML = '<p class="error">Erreur de chargement</p>';
  });
}

// === Initialisation ===
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Initialisation de la page matériel...");

  // Charger les catégories depuis l'API
  await loadCategoriesFromAPI();

  // Initialiser les éléments UI
  initializeUIElements();

  if (addBtn) {
    addBtn.addEventListener("click", openAddGearModal);
    console.log("Bouton Ajouter initialisé correctement");
  } else {
    console.error("Bouton Ajouter non trouvé lors de l'initialisation");
  }

  // Vérifier que tous les éléments essentiels sont présents
  const requiredElements = {
    form: form,
    listEl: listEl,
    addBtn: addBtn,
    modal: modal,
    search: search,
    tagFilter: tagFilter
  };

  const missingElements = Object.entries(requiredElements)
    .filter(([name, element]) => !element)
    .map(([name]) => name);

  if (missingElements.length > 0) {
    console.error('Éléments manquants:', missingElements.join(', '));
    if (listEl) {
      listEl.innerHTML = `<div class="error-state">
        <p>❌ Erreur d'initialisation</p>
        <p>Éléments manquants: ${missingElements.join(', ')}</p>
      </div>`;
    }
    return;
  }

  console.log("Tous les éléments UI sont présents");

  // Remplir le filtre de catégories
  populateCategoryFilter();
  console.log("Filtre de catégories rempli avec", MATERIAL_CONFIG.availableCategories.length, "catégories");

  // Initialiser les onglets
  initTabs();

  // Créer le formulaire intelligent
  createSmartForm();
  console.log("Formulaire intelligent créé");

  // Configurer les event listeners (IMPORTANT : après createSmartForm)
  setupEventListeners();
  console.log("Event listeners configurés");

  // Charger les données
  refresh();
  console.log("Chargement initial des données...");
});

// Export pour les tests
window.MaterialManager = {
  refresh,
  MATERIAL_CONFIG
};