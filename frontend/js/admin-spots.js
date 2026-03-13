// js/admin-spots.js
import { initCommonUI } from "./ui.js";
initCommonUI();

const API = (window.APP_CONFIG?.API_URL || "http://localhost:3000") + "/api";

function getAuth() {
  try { return JSON.parse(localStorage.getItem("auth") || "null"); } catch { return null; }
}
function getToken() { return getAuth()?.token || ""; }
function isAdmin() { return getAuth()?.user?.roles?.includes("admin") ?? false; }
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

const adminContent = document.getElementById("adminContent");
const accessDenied = document.getElementById("accessDenied");

// --- State ---
const PAGE_SIZE = 20;
let spotsPage = 0;
let spotsTotal = 0;
let pendingItems = [];
let pendingEditsItems = [];
let selectedPending = new Set();
let selectedEdits = new Set();
let groupByUser = false;
let rejectCallback = null;

if (!getToken()) {
  location.href = "./login.html?next=" + encodeURIComponent(location.pathname);
} else if (!isAdmin()) {
  accessDenied.hidden = false;
} else {
  adminContent.hidden = false;
  init();
}

// --- Tabs ---
document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".admin-tab-content").forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab)?.classList.add("active");
  });
});

// --- Init ---
async function init() {
  await Promise.all([loadPending(), loadPendingEdits(), loadSpotsPage()]);

  // Pending filters
  document.getElementById("pendingSearch").addEventListener("input", debounce(renderPendingView, 200));
  document.getElementById("pendingTypeFilter").addEventListener("change", renderPendingView);
  document.getElementById("pendingGroupToggle").addEventListener("click", () => {
    groupByUser = !groupByUser;
    const btn = document.getElementById("pendingGroupToggle");
    btn.classList.toggle("active", groupByUser);
    renderPendingView();
  });

  // Edits filter
  document.getElementById("editsSearch").addEventListener("input", debounce(renderEditsView, 200));

  // Spots table filters → reset page et refetch
  document.getElementById("spotSearch").addEventListener("input", debounce(() => { spotsPage = 0; loadSpotsPage(); }, 300));
  document.getElementById("spotStatusFilter").addEventListener("change", () => { spotsPage = 0; loadSpotsPage(); });

  // Bulk bar buttons
  document.getElementById("bulkApprove").addEventListener("click", handleBulkApprove);
  document.getElementById("bulkReject").addEventListener("click", () => {
    const { ids, type } = getBulkSelection();
    if (ids.length) openRejectModal(ids, type);
  });
  document.getElementById("bulkClear").addEventListener("click", clearSelection);

  // Reject modal buttons
  document.getElementById("rejectCancel").addEventListener("click", () => {
    document.getElementById("rejectModal").close();
    rejectCallback = null;
  });
  document.getElementById("rejectConfirm").addEventListener("click", async () => {
    const reason = document.getElementById("rejectReason").value.trim();
    document.getElementById("rejectModal").close();
    if (rejectCallback) {
      await rejectCallback(reason);
      rejectCallback = null;
    }
  });
}

// ── Pending spots ─────────────────────────────────────────────────────────────

async function loadPending() {
  try {
    const res = await fetch(`${API}/spots/pending?limit=500`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    const { items, total } = await res.json();
    pendingItems = items;
    document.getElementById("statPending").textContent = total;
    document.getElementById("pendingBadge").textContent = total;
    renderPendingView();
  } catch (e) {
    document.getElementById("pendingList").innerHTML =
      `<div class="admin-empty"><p>⚠️</p><p>Erreur : ${e.message}</p></div>`;
  }
}

function renderPendingView() {
  const q = document.getElementById("pendingSearch").value.toLowerCase();
  const type = document.getElementById("pendingTypeFilter").value;

  const items = pendingItems.filter((s) => {
    const author = s.submittedBy?.displayName || s.createdBy?.displayName || "";
    const matchQ = !q || s.name?.toLowerCase().includes(q) || author.toLowerCase().includes(q);
    const matchType = !type || s.type === type;
    return matchQ && matchType;
  });

  if (groupByUser) {
    renderPendingGrouped(items);
  } else {
    renderPendingFlat(items);
  }
}

function renderPendingFlat(items) {
  const container = document.getElementById("pendingList");
  if (!items.length) {
    container.innerHTML = `<div class="admin-empty"><p>✅</p><p>Aucune demande en attente.</p></div>`;
    return;
  }
  container.innerHTML = items.map((s) => renderPendingCard(s)).join("");
}

function renderPendingGrouped(items) {
  const container = document.getElementById("pendingList");
  if (!items.length) {
    container.innerHTML = `<div class="admin-empty"><p>✅</p><p>Aucune demande en attente.</p></div>`;
    return;
  }

  const groups = {};
  items.forEach((s) => {
    const author = s.submittedBy?.displayName || s.createdBy?.displayName || "Inconnu";
    const uid = s.submittedBy?.uid || s.createdBy?.uid || "unknown";
    if (!groups[uid]) groups[uid] = { author, uid, items: [] };
    groups[uid].items.push(s);
  });

  container.innerHTML = Object.values(groups).map(({ author, uid, items: gi }) => {
    const ids = gi.map((s) => String(s._id));
    const idsJson = JSON.stringify(ids);
    return `
      <div class="user-group">
        <div class="user-group__header">
          <div class="user-group__info">
            <span class="user-group__name">${esc(author)}</span>
            <span class="user-group__count">${gi.length} spot${gi.length > 1 ? "s" : ""}</span>
          </div>
          <div class="user-group__actions">
            <button class="btn btn--compact" onclick="approveAll(${JSON.stringify(idsJson)}, 'spot')">✅ Tout approuver</button>
            <button class="btn btn--danger btn--compact" onclick="openRejectModal(${JSON.stringify(idsJson)}, 'spot')">❌ Tout rejeter</button>
          </div>
        </div>
        ${gi.map((s) => renderPendingCard(s)).join("")}
      </div>
    `;
  }).join("");
}

function renderPendingCard(s) {
  const coords = s.location?.coordinates;
  const lat = coords ? coords[1].toFixed(5) : null;
  const lng = coords ? coords[0].toFixed(5) : null;
  const mapUrl = lat ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15` : null;
  const author = s.submittedBy?.displayName || s.createdBy?.displayName || "Inconnu";
  const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : "—";
  const id = String(s._id);
  const checked = selectedPending.has(id);

  return `
    <div class="pending-card ${checked ? "pending-card--selected" : ""}" id="pc-${id}">
      <div class="pending-card__header">
        <label class="pending-card__check">
          <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleSelect('${id}', 'spot', this.checked)" />
        </label>
        <h3 class="pending-card__title">${esc(s.name)}</h3>
        <span class="type-chip type-chip--${s.type || "crag"}">${s.type || "—"}</span>
      </div>
      <p class="pending-card__meta">
        <strong>Niveaux :</strong> ${s.niveau_min || "?"} → ${s.niveau_max || "?"} &nbsp;·&nbsp;
        <strong>Orient. :</strong> ${s.orientation || "—"}
        ${mapUrl ? `&nbsp;·&nbsp; <a href="${mapUrl}" target="_blank" class="admin-link">📍 Carte</a>` : ""}
      </p>
      ${s.description ? `<p class="pending-card__meta pending-card__desc">${esc(s.description.slice(0, 140))}${s.description.length > 140 ? "…" : ""}</p>` : ""}
      <p class="pending-card__meta">
        <strong>Par :</strong> ${esc(author)} &nbsp;·&nbsp; <strong>Le :</strong> ${date}
      </p>
      <div class="pending-card__actions">
        <button class="btn" onclick="approveSpot('${id}')">✅ Approuver</button>
        <button class="btn btn--danger" onclick="openRejectModal(['${id}'], 'spot')">❌ Rejeter</button>
      </div>
    </div>
  `;
}

// ── Pending edits ─────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  name: "Nom", type: "Type", niveau_min: "Niveau min", niveau_max: "Niveau max",
  orientation: "Orientation", description: "Description", url: "URL", soustype: "Sous-type",
};

async function loadPendingEdits() {
  try {
    const res = await fetch(`${API}/spot-edits/pending`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    const { items, total } = await res.json();
    pendingEditsItems = items;
    document.getElementById("statPendingEdits").textContent = total;
    document.getElementById("editsBadge").textContent = total;
    renderEditsView();
  } catch (e) {
    document.getElementById("editsList").innerHTML =
      `<div class="admin-empty"><p>⚠️</p><p>Erreur : ${e.message}</p></div>`;
  }
}

function renderEditsView() {
  const q = document.getElementById("editsSearch").value.toLowerCase();
  const items = pendingEditsItems.filter((e) => {
    const author = e.proposedBy?.displayName || "";
    const name = e.spotName || "";
    return !q || name.toLowerCase().includes(q) || author.toLowerCase().includes(q);
  });
  renderPendingEdits(items);
}

function renderPendingEdits(items) {
  const container = document.getElementById("editsList");
  if (!items.length) {
    container.innerHTML = `<div class="admin-empty"><p>✅</p><p>Aucune modification en attente.</p></div>`;
    return;
  }

  container.innerHTML = items.map((e) => {
    const author = e.proposedBy?.displayName || "Inconnu";
    const date = e.createdAt ? new Date(e.createdAt).toLocaleDateString("fr-FR") : "—";
    const id = String(e._id);
    const checked = selectedEdits.has(id);

    const diffRows = Object.entries(e.changes).map(([key, newVal]) => {
      const oldVal = e.previousValues?.[key];
      const label = FIELD_LABELS[key] || key;
      return `
        <div class="edit-diff-row">
          <span class="edit-diff-row__field">${esc(label)}</span>
          <span class="edit-diff-row__old">${esc(String(oldVal ?? "—"))}</span>
          <span class="edit-diff-row__arrow">→</span>
          <span class="edit-diff-row__new">${esc(String(newVal ?? "—"))}</span>
        </div>`;
    }).join("");

    return `
      <div class="pending-card ${checked ? "pending-card--selected" : ""}" id="ec-${id}">
        <div class="pending-card__header">
          <label class="pending-card__check">
            <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleSelect('${id}', 'edit', this.checked)" />
          </label>
          <h3 class="pending-card__title">✏️ ${esc(e.spotName || "Spot inconnu")}</h3>
          <span class="status-badge status-badge--pending">Modif.</span>
        </div>
        <div class="edit-diff">${diffRows}</div>
        <p class="pending-card__meta">
          <strong>Par :</strong> ${esc(author)} &nbsp;·&nbsp; <strong>Le :</strong> ${date}
        </p>
        <div class="pending-card__actions">
          <button class="btn" onclick="approveEdit('${id}')">✅ Approuver</button>
          <button class="btn btn--danger" onclick="openRejectModal(['${id}'], 'edit')">❌ Rejeter</button>
        </div>
      </div>
    `;
  }).join("");
}

// ── All spots table (pagination serveur) ──────────────────────────────────────

async function loadSpotsPage() {
  const name   = document.getElementById("spotSearch").value.trim();
  const status = document.getElementById("spotStatusFilter").value;

  const params = new URLSearchParams({ limit: PAGE_SIZE, skip: spotsPage * PAGE_SIZE });
  if (name)   params.set("name", name);
  if (status) params.set("status", status);

  const tbody     = document.getElementById("spotsTableBody");
  const mobileList = document.getElementById("spotsMobileList");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-2)">Chargement…</td></tr>`;

  try {
    const res = await fetch(`${API}/spots/admin?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    const { items, total, totalAll, totalApproved } = await res.json();

    spotsTotal = total;
    document.getElementById("statTotal").textContent    = totalAll;
    document.getElementById("statApproved").textContent = totalApproved;

    renderTable(items);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--c-danger)">Erreur : ${e.message}</td></tr>`;
    mobileList.innerHTML = "";
  }
}

function renderTable(items) {
  const tbody      = document.getElementById("spotsTableBody");
  const mobileList = document.getElementById("spotsMobileList");

  if (!items.length) {
    tbody.innerHTML     = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-2)">Aucun spot trouvé.</td></tr>`;
    mobileList.innerHTML = `<div class="admin-empty"><p>🔍</p><p>Aucun spot trouvé.</p></div>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = items.map((s) => {
    const st     = s.status || "approved";
    const author = s.submittedBy?.displayName || s.createdBy?.displayName || "—";
    const date   = s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : "—";
    return `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td>${s.type || "—"}</td>
        <td><span class="status-badge status-badge--${st}">${st}</span></td>
        <td>${esc(author)}</td>
        <td>${date}</td>
        <td>
          <div class="admin-actions">
            ${st === "pending"  ? `<button class="btn btn--compact" onclick="approveSpot('${s._id}')">✅</button><button class="btn btn--danger btn--compact" onclick="openRejectModal(['${s._id}'], 'spot')">❌</button>` : ""}
            ${st === "rejected" ? `<button class="btn btn--compact btn--ghost" onclick="approveSpot('${s._id}')">↩</button>` : ""}
            <button class="btn btn--danger btn--compact btn--ghost" onclick="deleteSpot('${s._id}', '${esc(s.name)}')">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  mobileList.innerHTML = items.map((s) => {
    const st     = s.status || "approved";
    const author = s.submittedBy?.displayName || s.createdBy?.displayName || "—";
    return `
      <div class="pending-card">
        <div class="pending-card__header">
          <h3 class="pending-card__title">${esc(s.name)}</h3>
          <span class="status-badge status-badge--${st}">${st}</span>
        </div>
        <p class="pending-card__meta"><strong>Type :</strong> ${s.type || "—"} · <strong>Par :</strong> ${esc(author)}</p>
        <div class="pending-card__actions">
          ${st === "pending" ? `<button class="btn" onclick="approveSpot('${s._id}')">Approuver</button><button class="btn btn--danger" onclick="openRejectModal(['${s._id}'], 'spot')">Rejeter</button>` : ""}
          <button class="btn btn--ghost btn--danger" onclick="deleteSpot('${s._id}', '${esc(s.name)}')">Supprimer</button>
        </div>
      </div>
    `;
  }).join("");

  renderPagination();
}

function renderPagination() {
  const pages = Math.ceil(spotsTotal / PAGE_SIZE);
  const pg    = document.getElementById("spotsPagination");
  if (pages <= 1) { pg.innerHTML = ""; return; }
  pg.innerHTML = `
    <button class="btn btn--ghost btn--compact" onclick="changePage(-1)" ${spotsPage === 0 ? "disabled" : ""}>←</button>
    <span style="font-size:.88rem;color:var(--text-2)">${spotsPage + 1} / ${pages} <small style="opacity:.6">(${spotsTotal} spots)</small></span>
    <button class="btn btn--ghost btn--compact" onclick="changePage(1)" ${spotsPage >= pages - 1 ? "disabled" : ""}>→</button>
  `;
}

window.changePage = (dir) => { spotsPage += dir; loadSpotsPage(); };

// ── Selection & bulk ──────────────────────────────────────────────────────────

window.toggleSelect = (id, type, checked) => {
  const sel = type === "spot" ? selectedPending : selectedEdits;
  if (checked) sel.add(id); else sel.delete(id);
  const card = document.getElementById(type === "spot" ? `pc-${id}` : `ec-${id}`);
  if (card) card.classList.toggle("pending-card--selected", checked);
  updateBulkBar();
};

function updateBulkBar() {
  const total = selectedPending.size + selectedEdits.size;
  const bar = document.getElementById("bulkBar");
  bar.hidden = total === 0;
  document.getElementById("bulkCount").textContent = `${total} sélectionné${total > 1 ? "s" : ""}`;
}

function clearSelection() {
  selectedPending.clear();
  selectedEdits.clear();
  document.querySelectorAll(".pending-card input[type=checkbox]").forEach((cb) => { cb.checked = false; });
  document.querySelectorAll(".pending-card--selected").forEach((c) => c.classList.remove("pending-card--selected"));
  updateBulkBar();
}

function getBulkSelection() {
  // If both types selected, prioritize spots
  if (selectedPending.size > 0) return { ids: [...selectedPending], type: "spot" };
  return { ids: [...selectedEdits], type: "edit" };
}

async function handleBulkApprove() {
  if (selectedPending.size > 0) {
    await approveAll([...selectedPending], "spot");
  }
  if (selectedEdits.size > 0) {
    await approveAll([...selectedEdits], "edit");
  }
}

window.approveAll = async (idsJson, type) => {
  const ids = typeof idsJson === "string" ? JSON.parse(idsJson) : idsJson;
  try {
    await Promise.all(ids.map((id) =>
      type === "spot"
        ? fetch(`${API}/spots/${id}/approve`, { method: "PATCH", headers: authHeaders() })
        : fetch(`${API}/spot-edits/${id}/approve`, { method: "PATCH", headers: authHeaders() })
    ));
    showToast(`${ids.length} élément${ids.length > 1 ? "s" : ""} approuvé${ids.length > 1 ? "s" : ""} ✅`);
    clearSelection();
    if (type === "spot") await Promise.all([loadPending(), loadSpotsPage()]);
    else await loadPendingEdits();
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

// ── Reject modal ──────────────────────────────────────────────────────────────

window.openRejectModal = (idsJson, type) => {
  const ids = typeof idsJson === "string" ? JSON.parse(idsJson) : idsJson;
  document.getElementById("rejectReason").value = "";
  rejectCallback = async (reason) => {
    try {
      await Promise.all(ids.map((id) => rejectById(id, type, reason)));
      showToast(`${ids.length} élément${ids.length > 1 ? "s" : ""} rejeté${ids.length > 1 ? "s" : ""}`);
      clearSelection();
      if (type === "spot") await Promise.all([loadPending(), loadSpotsPage()]);
      else await loadPendingEdits();
    } catch (e) { showToast("Erreur : " + e.message, true); }
  };
  document.getElementById("rejectModal").showModal();
};

async function rejectById(id, type, reason) {
  const url = type === "spot" ? `${API}/spots/${id}/reject` : `${API}/spot-edits/${id}/reject`;
  const res = await fetch(url, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ reason }) });
  if (!res.ok) throw new Error("Erreur " + res.status);
}

// ── Individual spot actions ───────────────────────────────────────────────────

window.approveSpot = async (id) => {
  try {
    const res = await fetch(`${API}/spots/${id}/approve`, { method: "PATCH", headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Spot approuvé ✅");
    await Promise.all([loadPending(), loadSpotsPage()]);
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

window.approveEdit = async (id) => {
  try {
    const res = await fetch(`${API}/spot-edits/${id}/approve`, { method: "PATCH", headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Modification approuvée ✅");
    await loadPendingEdits();
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

window.deleteSpot = async (id, name) => {
  if (!confirm(`Supprimer définitivement "${name}" ?`)) return;
  try {
    const res = await fetch(`${API}/spots/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Spot supprimé");
    await Promise.all([loadPending(), loadSpotsPage()]);
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function esc(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let toastTimer;
function showToast(msg, isError = false) {
  let toast = document.getElementById("adminToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "adminToast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = "map-toast" + (isError ? " map-toast--error" : "");
  toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = "none"; }, 3500);
}
