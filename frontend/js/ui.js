/**
 * Gestion du thème clair/foncé + UI commune
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
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
}

export { initCommonUI, applyTheme };

window.initCommonUI = initCommonUI;
window.applyTheme   = applyTheme;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initCommonUI());
} else {
  initCommonUI();
}
