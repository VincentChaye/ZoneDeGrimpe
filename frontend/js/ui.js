import { initI18n, setLanguage, getLang, getSupportedLangs, translateDOM } from "./i18n.js";

/**
 * Gestion du thème clair/foncé + UI commune + i18n
 */
function initCommonUI() {
  if (document.body.hasAttribute("data-ui-initialized")) return;
  document.body.setAttribute("data-ui-initialized", "true");

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // --- Thème clair / foncé ---
  const saved = localStorage.getItem("zdg_theme_pref") || "light";
  applyTheme(saved);

  const updateToggleLabel = (mode) => {
    document.querySelectorAll("#themeToggle, #themeToggleSettings").forEach((btn) => {
      if (btn) btn.textContent = mode === "dark" ? "Clair ☀️" : "Foncé 🌙";
    });
  };

  updateToggleLabel(saved);

  document.querySelectorAll("#themeToggle, #themeToggleSettings").forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("zdg_theme_pref", next);
      applyTheme(next);
      updateToggleLabel(next);
    });
  });

  // --- Selecteur de langue ---
  initLangSelector();

  // --- i18n ---
  initI18n();

  // --- Notification bell ---
  initNotifBell();
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
}

/** Initialise la cloche de notifications */
function initNotifBell() {
  const bell = document.getElementById("notifBell");
  const badge = document.getElementById("notifBadge");
  if (!bell || !badge) return;

  let auth;
  try { auth = JSON.parse(localStorage.getItem("auth") || "null"); } catch { return; }
  if (!auth?.token) return;

  bell.style.display = "";
  const apiUrl = window.APP_CONFIG?.API_URL || "http://localhost:3000";

  async function fetchCount() {
    try {
      const res = await fetch(`${apiUrl}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return;
      const { count } = await res.json();
      badge.textContent = count > 0 ? (count > 99 ? "99+" : count) : "";
    } catch {}
  }

  fetchCount();
  setInterval(fetchCount, 60000);
}

/** Initialise le selecteur de langue dans le header */
function initLangSelector() {
  const sel = document.getElementById("langSelect");
  if (!sel) return;
  sel.value = getLang();
  sel.addEventListener("change", (e) => {
    setLanguage(e.target.value);
  });
}

export { initCommonUI, applyTheme, translateDOM };

window.initCommonUI = initCommonUI;
window.applyTheme   = applyTheme;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initCommonUI());
} else {
  initCommonUI();
}

// Enregistrement du Service Worker (PWA)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
