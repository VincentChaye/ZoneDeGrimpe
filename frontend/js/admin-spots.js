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

// --- Vérification accès ---
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

// --- Données ---
let allSpots = [];
let filteredSpots = [];
let currentPage = 0;
const PAGE_SIZE = 20;

async function init() {
  await Promise.all([loadPending(), loadAllSpots()]);

  document.getElementById("spotSearch").addEventListener("input", debounce(applyFilters, 300));
  document.getElementById("spotStatusFilter").addEventListener("change", applyFilters);
}

async function loadPending() {
  try {
    const res = await fetch(`${API}/spots/pending`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    const { items, total } = await res.json();

    document.getElementById("statPending").textContent = total;
    document.getElementById("pendingBadge").textContent = total;

    renderPending(items);
  } catch (e) {
    document.getElementById("pendingList").innerHTML =
      `<div class="admin-empty"><p>⚠️</p><p>Erreur : ${e.message}</p></div>`;
  }
}

async function loadAllSpots() {
  try {
    const res = await fetch(`${API}/spots?limit=5000&format=flat`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    allSpots = await res.json();

    // Charge aussi les pending pour avoir les données complètes dans "Tous"
    const resPending = await fetch(`${API}/spots/pending?limit=500`, { headers: authHeaders() });
    if (resPending.ok) {
      const { items } = await resPending.json();
      // Ajoute les pending qui ne sont pas déjà dans allSpots
      items.forEach((p) => {
        if (!allSpots.find((s) => String(s._id) === String(p._id))) {
          allSpots.push({ ...p, id: p._id.toString() });
        }
      });
    }

    document.getElementById("statTotal").textContent = allSpots.length;
    const approved = allSpots.filter((s) => !s.status || s.status === "approved").length;
    document.getElementById("statApproved").textContent = approved;

    filteredSpots = [...allSpots];
    renderTable();
  } catch (e) {
    document.getElementById("spotsTableBody").innerHTML =
      `<tr><td colspan="6" style="text-align:center;color:#dc2626">Erreur : ${e.message}</td></tr>`;
  }
}

function renderPending(items) {
  const container = document.getElementById("pendingList");
  if (!items.length) {
    container.innerHTML = `<div class="admin-empty"><p>✅</p><p>Aucune demande en attente.</p></div>`;
    return;
  }

  container.innerHTML = items.map((s) => {
    const coords = s.location?.coordinates;
    const lat = coords ? coords[1].toFixed(5) : "—";
    const lng = coords ? coords[0].toFixed(5) : "—";
    const author = s.submittedBy?.displayName || s.createdBy?.displayName || "Inconnu";
    const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : "—";

    return `
      <div class="pending-card" id="pc-${s._id}">
        <div class="pending-card__header">
          <h3 class="pending-card__title">${esc(s.name)}</h3>
          <span class="status-badge status-badge--pending">En attente</span>
        </div>
        <p class="pending-card__meta">
          <strong>Type :</strong> ${s.type || "—"} &nbsp;|&nbsp;
          <strong>Niveau :</strong> ${s.niveau_min || "?"} → ${s.niveau_max || "?"} &nbsp;|&nbsp;
          <strong>Orientation :</strong> ${s.orientation || "—"}
        </p>
        <p class="pending-card__meta">
          <strong>Coordonnées :</strong> ${lat}, ${lng}
        </p>
        ${s.description ? `<p class="pending-card__meta"><strong>Description :</strong> ${esc(s.description)}</p>` : ""}
        <p class="pending-card__meta">
          <strong>Soumis par :</strong> ${esc(author)} &nbsp;|&nbsp; <strong>Le :</strong> ${date}
        </p>
        <div class="pending-card__actions">
          <button class="btn" onclick="approveSpot('${s._id}')">✅ Approuver</button>
          <button class="btn btn--danger" onclick="rejectSpot('${s._id}')">❌ Rejeter</button>
        </div>
      </div>
    `;
  }).join("");
}

function applyFilters() {
  const q = document.getElementById("spotSearch").value.toLowerCase();
  const status = document.getElementById("spotStatusFilter").value;

  filteredSpots = allSpots.filter((s) => {
    const matchName = !q || s.name?.toLowerCase().includes(q);
    const matchStatus = !status || (s.status || "approved") === status;
    return matchName && matchStatus;
  });
  currentPage = 0;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("spotsTableBody");
  const mobileList = document.getElementById("spotsMobileList");
  const start = currentPage * PAGE_SIZE;
  const page = filteredSpots.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-2)">Aucun spot trouvé.</td></tr>`;
    mobileList.innerHTML = `<div class="admin-empty"><p>🔍</p><p>Aucun spot trouvé.</p></div>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = page.map((s) => {
    const st = s.status || "approved";
    const author = s.submittedBy?.displayName || s.createdBy?.displayName || "—";
    const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString("fr-FR") : "—";
    return `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td>${s.type || "—"}</td>
        <td><span class="status-badge status-badge--${st}">${st}</span></td>
        <td>${esc(author)}</td>
        <td>${date}</td>
        <td>
          <div class="admin-actions">
            ${st === "pending" ? `<button class="btn btn--compact" onclick="approveSpot('${s._id}')">✅</button><button class="btn btn--danger btn--compact" onclick="rejectSpot('${s._id}')">❌</button>` : ""}
            ${st === "rejected" ? `<button class="btn btn--compact btn--ghost" onclick="approveSpot('${s._id}')">↩</button>` : ""}
            <button class="btn btn--danger btn--compact btn--ghost" onclick="deleteSpot('${s._id}', '${esc(s.name)}')">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  mobileList.innerHTML = page.map((s) => {
    const st = s.status || "approved";
    const author = s.submittedBy?.displayName || s.createdBy?.displayName || "—";
    return `
      <div class="pending-card">
        <div class="pending-card__header">
          <h3 class="pending-card__title">${esc(s.name)}</h3>
          <span class="status-badge status-badge--${st}">${st}</span>
        </div>
        <p class="pending-card__meta"><strong>Type :</strong> ${s.type || "—"} · <strong>Par :</strong> ${esc(author)}</p>
        <div class="pending-card__actions">
          ${st === "pending" ? `<button class="btn" onclick="approveSpot('${s._id}')">Approuver</button><button class="btn btn--danger" onclick="rejectSpot('${s._id}')">Rejeter</button>` : ""}
          <button class="btn btn--ghost btn--danger" onclick="deleteSpot('${s._id}', '${esc(s.name)}')">Supprimer</button>
        </div>
      </div>
    `;
  }).join("");

  renderPagination();
}

function renderPagination() {
  const total = filteredSpots.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const pg = document.getElementById("spotsPagination");
  if (pages <= 1) { pg.innerHTML = ""; return; }

  pg.innerHTML = `
    <button class="btn btn--ghost btn--compact" onclick="changePage(-1)" ${currentPage === 0 ? "disabled" : ""}>←</button>
    <span style="font-size:.88rem;color:var(--text-2)">${currentPage + 1} / ${pages}</span>
    <button class="btn btn--ghost btn--compact" onclick="changePage(1)" ${currentPage >= pages - 1 ? "disabled" : ""}>→</button>
  `;
}

window.changePage = (dir) => {
  currentPage += dir;
  renderTable();
};

// --- Actions spots ---
window.approveSpot = async (id) => {
  try {
    const res = await fetch(`${API}/spots/${id}/approve`, { method: "PATCH", headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Spot approuvé ✅");
    await Promise.all([loadPending(), loadAllSpots()]);
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

window.rejectSpot = async (id) => {
  const reason = prompt("Raison du rejet (optionnel) :") ?? undefined;
  if (reason === undefined) return; // annulé
  try {
    const res = await fetch(`${API}/spots/${id}/reject`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Spot rejeté");
    await Promise.all([loadPending(), loadAllSpots()]);
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

window.deleteSpot = async (id, name) => {
  if (!confirm(`Supprimer définitivement "${name}" ?`)) return;
  try {
    const res = await fetch(`${API}/spots/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Spot supprimé");
    await Promise.all([loadPending(), loadAllSpots()]);
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

// --- Helpers ---
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
