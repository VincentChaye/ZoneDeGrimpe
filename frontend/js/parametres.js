// frontend/js/parametres.js
// initCommonUI sera disponible globalement via ui.js

// Configuration API
const API_BASE_URL = window.APP_CONFIG?.API_URL || "http://localhost:3000";
const API_PATH_PREFIX = "/api";

// Initialiser l'UI commune (ui.js s'auto-initialise maintenant)
if (typeof initCommonUI === 'function' && !document.body.hasAttribute('data-ui-initialized')) {
  initCommonUI();
  document.body.setAttribute('data-ui-initialized', 'true');
}

/* ---------- Session (localStorage.auth) ---------- */
function getAuth() {
  try { return JSON.parse(localStorage.getItem("auth") || "null"); } catch { return null; }
}
function setAuth(val) {
  try { if (!val) localStorage.removeItem("auth"); else localStorage.setItem("auth", JSON.stringify(val)); } catch {}
}
function getToken() { return getAuth()?.token || ""; }
function apiUrl(path, params) {
  const url = new URL(`${API_PATH_PREFIX}${path}`, API_BASE_URL);
  if (params) for (const [k,v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}
async function handleHttp(res) {
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j?.error || j?.message || msg; } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
}

/* ---------- Niveau: labels ---------- */
const LEVEL_LABELS = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};
function levelToLabel(v) { return LEVEL_LABELS[String(v || "").toLowerCase()] || "—"; }

/* ---------- DOM ---------- */
const root = document.getElementById("settingsRoot");
const el = {
  displayName: document.getElementById("displayName"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  role: document.getElementById("role"),
  level: document.getElementById("level"),
  avatarImg: document.getElementById("avatarImg"),
  editPhoneBtn: document.getElementById("editPhoneBtn"),
  editAvatarBtn: document.getElementById("editAvatarBtn"),
  editLevelBtn: document.getElementById("editLevelBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
};

main().catch(err => {
  console.error(err);
  alert("Impossible de charger vos paramètres. Veuillez vous reconnecter.");
  location.href = "./login.html?next=" + encodeURIComponent(location.pathname);
});

async function main() {
  const token = getToken();
  if (!token) {
    location.href = "./login.html?next=" + encodeURIComponent(location.pathname);
    return;
  }

  const me = await fetchMe();
  fill(me);
  root.hidden = false;

  el.editPhoneBtn.addEventListener("click", onEditPhone);
  el.editAvatarBtn.addEventListener("click", onEditAvatar);
  el.editLevelBtn.addEventListener("click", onEditLevel);
  el.logoutBtn.addEventListener("click", onLogout);
  el.deleteBtn.addEventListener("click", onDeleteAccount);
}

function fill(me) {
  el.displayName.textContent = me.displayName || "—";
  el.email.textContent = me.email || "—";
  el.phone.textContent = me.phone || "—";
  el.role.textContent = Array.isArray(me.roles) ? me.roles.join(", ") : (me.roles || "—");
  el.level.textContent = levelToLabel(me.profile?.level);
  el.avatarImg.src = me.avatarUrl || "./assets/avatar-default.jpg";

  const a = getAuth();
  if (a?.user) {
    a.user = { ...a.user, ...me };
    setAuth(a);
  }
}

async function fetchMe() {
  const headers = { "Authorization": `Bearer ${getToken()}` };
  const r = await fetch(apiUrl("/users/me"), { headers, cache: "no-store", mode: "cors" });
  await handleHttp(r);
  return r.json(); // <-- attend un user direct (back ajusté)
}

/* ---------- Actions ---------- */
async function onEditPhone() {
  const current = el.phone.textContent.trim();
  const value = prompt("Nouveau numéro de téléphone :", current === "—" ? "" : current);
  if (value == null) return;

  const r = await fetch(apiUrl("/users/me"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify({ phone: value.trim() || null }),
  });
  await handleHttp(r);
  fill(await r.json());
}

async function onEditAvatar() {
  const current = el.avatarImg.src;
  const value = prompt("URL de l’avatar (image publique) :", current || "");
  if (value == null) return;

  const r = await fetch(apiUrl("/users/me"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify({ avatarUrl: value.trim() || null }),
  });
  await handleHttp(r);
  fill(await r.json());
}

async function onEditLevel() {
  const choices = ["debutant", "intermediaire", "avance"];
  const current = (getAuth()?.user?.profile?.level) || "debutant";
  const msg =
    "Choisis un niveau:\n" +
    "- debutant\n" +
    "- intermediaire\n" +
    "- avance\n\n" +
    `Niveau actuel: ${current}`;
  const value = prompt(msg, current);
  if (value == null) return;

  const lvl = String(value).toLowerCase().trim();
  if (!choices.includes(lvl)) {
    alert("Niveau invalide. Valeurs autorisées: debutant, intermediaire, avance");
    return;
  }

  const r = await fetch(apiUrl("/users/me"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`
    },
    body: JSON.stringify({ level: lvl }),
  });
  await handleHttp(r);
  fill(await r.json());
}

function onLogout() {
  setAuth(null);
  location.href = "./login.html";
}

async function onDeleteAccount() {
  const ok = confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est définitive.");
  if (!ok) return;

  const uid = getAuth()?.user?._id;
  if (!uid) {
    alert("Session invalide.");
    return;
  }

  const r = await fetch(apiUrl(`/users/${uid}`), {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${getToken()}` }
  });
  await handleHttp(r);

  setAuth(null);
  alert("Votre compte a été supprimé.");
  location.href = "./register.html";
}

