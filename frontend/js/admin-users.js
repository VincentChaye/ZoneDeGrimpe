// js/admin-users.js
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

// --- État ---
let currentPage = 0;
let currentTotal = 0;
let currentSearch = "";
const PAGE_SIZE = 20;

async function init() {
  await loadUsers();

  const searchInput = document.getElementById("userSearch");
  const searchBtn = document.getElementById("searchBtn");

  searchBtn.addEventListener("click", () => {
    currentSearch = searchInput.value.trim();
    currentPage = 0;
    loadUsers();
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      currentSearch = searchInput.value.trim();
      currentPage = 0;
      loadUsers();
    }
  });
}

async function loadUsers() {
  try {
    const params = new URLSearchParams({
      limit: PAGE_SIZE,
      skip: currentPage * PAGE_SIZE,
      ...(currentSearch ? { search: currentSearch } : {}),
    });
    const res = await fetch(`${API}/users?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    const { items, total } = await res.json();

    currentTotal = total;
    document.getElementById("statTotal").textContent = total;

    const admins = items.filter((u) => u.roles?.includes("admin")).length;
    document.getElementById("statAdmins").textContent = admins;

    renderTable(items);
    renderMobile(items);
    renderPagination();
  } catch (e) {
    document.getElementById("usersTableBody").innerHTML =
      `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#dc2626">Erreur : ${e.message}</td></tr>`;
  }
}

function renderTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-2)">Aucun utilisateur trouvé.</td></tr>`;
    return;
  }

  const myId = getAuth()?.user?._id;

  tbody.innerHTML = users.map((u) => {
    const roles = Array.isArray(u.roles) ? u.roles : ["user"];
    const isAdminUser = roles.includes("admin");
    const date = u.security?.createdAt ? new Date(u.security.createdAt).toLocaleDateString("fr-FR") : "—";
    const isSelf = String(u._id) === String(myId);

    return `
      <tr>
        <td>
          <strong>${esc(u.displayName || "—")}</strong>
          ${isSelf ? '<span class="status-badge" style="background:var(--surface-2);color:var(--text-2);margin-left:.3rem">Vous</span>' : ""}
        </td>
        <td>${esc(u.email || "—")}</td>
        <td><span class="status-badge status-badge--${isAdminUser ? "admin" : "user"}">${roles.join(", ")}</span></td>
        <td><span class="status-badge status-badge--${u.status || "active"}">${u.status || "active"}</span></td>
        <td>${date}</td>
        <td>
          <div class="admin-actions">
            ${!isSelf ? `
              <button class="btn btn--compact ${isAdminUser ? "btn--ghost" : ""}"
                onclick="toggleAdmin('${u._id}', ${isAdminUser})">
                ${isAdminUser ? "Retirer admin" : "Promouvoir"}
              </button>
              ${u.status !== "banned"
                ? `<button class="btn btn--compact btn--ghost" onclick="banUser('${u._id}', '${esc(u.displayName || u.email)}')">Bannir</button>`
                : `<button class="btn btn--compact btn--ghost" onclick="unbanUser('${u._id}')">Débannir</button>`
              }
              <button class="btn btn--danger btn--compact" onclick="deleteUser('${u._id}', '${esc(u.displayName || u.email)}')">🗑</button>
            ` : "<em style='font-size:.8rem;color:var(--text-2)'>—</em>"}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderMobile(users) {
  const list = document.getElementById("usersMobileList");
  const myId = getAuth()?.user?._id;

  list.innerHTML = users.map((u) => {
    const roles = Array.isArray(u.roles) ? u.roles : ["user"];
    const isAdminUser = roles.includes("admin");
    const isSelf = String(u._id) === String(myId);

    return `
      <div class="pending-card">
        <div class="pending-card__header">
          <h3 class="pending-card__title">${esc(u.displayName || "—")}${isSelf ? " <em>(vous)</em>" : ""}</h3>
          <span class="status-badge status-badge--${isAdminUser ? "admin" : "user"}">${roles.join(", ")}</span>
        </div>
        <p class="pending-card__meta">${esc(u.email || "—")}</p>
        ${!isSelf ? `
          <div class="pending-card__actions">
            <button class="btn ${isAdminUser ? "btn--ghost" : ""}" onclick="toggleAdmin('${u._id}', ${isAdminUser})">
              ${isAdminUser ? "Retirer admin" : "Promouvoir admin"}
            </button>
            <button class="btn btn--ghost btn--danger" onclick="deleteUser('${u._id}', '${esc(u.displayName || u.email)}')">Supprimer</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function renderPagination() {
  const pages = Math.ceil(currentTotal / PAGE_SIZE);
  const pg = document.getElementById("usersPagination");
  if (pages <= 1) { pg.innerHTML = ""; return; }
  pg.innerHTML = `
    <button class="btn btn--ghost btn--compact" onclick="changePage(-1)" ${currentPage === 0 ? "disabled" : ""}>←</button>
    <span style="font-size:.88rem;color:var(--text-2)">${currentPage + 1} / ${pages}</span>
    <button class="btn btn--ghost btn--compact" onclick="changePage(1)" ${currentPage >= pages - 1 ? "disabled" : ""}>→</button>
  `;
}

window.changePage = (dir) => {
  currentPage += dir;
  loadUsers();
};

// --- Actions utilisateurs ---
window.toggleAdmin = async (id, currentlyAdmin) => {
  const newRoles = currentlyAdmin ? ["user"] : ["admin"];
  const label = currentlyAdmin ? "retirer les droits admin de" : "promouvoir en admin";
  if (!confirm(`Confirmer : ${label} cet utilisateur ?`)) return;
  try {
    const res = await fetch(`${API}/users/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ roles: newRoles }),
    });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast(currentlyAdmin ? "Droits admin retirés" : "Utilisateur promu admin");
    loadUsers();
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

window.banUser = async (id, name) => {
  if (!confirm(`Bannir "${name}" ?`)) return;
  try {
    const res = await fetch(`${API}/users/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: "banned" }),
    });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Utilisateur banni");
    loadUsers();
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

window.unbanUser = async (id) => {
  try {
    const res = await fetch(`${API}/users/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: "active" }),
    });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Utilisateur débanni");
    loadUsers();
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

window.deleteUser = async (id, name) => {
  if (!confirm(`Supprimer définitivement le compte "${name}" ? Cette action est irréversible.`)) return;
  try {
    const res = await fetch(`${API}/users/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Erreur " + res.status);
    showToast("Compte supprimé");
    loadUsers();
  } catch (e) { showToast("Erreur : " + e.message, true); }
};

// --- Helpers ---
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
