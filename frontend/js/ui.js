/**
 * Gestion du thème clair/foncé + burger + UI commune
 */
function initCommonUI() {
  // Sécurité : Empêcher l'initialisation multiple
  if (document.body.hasAttribute("data-ui-initialized")) return;
  document.body.setAttribute("data-ui-initialized", "true");

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // --- Menu hamburger ---
  const hamburger = document.getElementById("hamburger");
  const nav = document.getElementById("nav");

  if (hamburger && nav) {
    const links = Array.from(nav.querySelectorAll("a"));

    const openNav = () => {
      nav.classList.add("nav--open");
      hamburger.classList.add("is-open");
      hamburger.setAttribute("aria-expanded", "true");
      document.body.setAttribute("data-nav-open", "true");
      (links[0] || nav).focus?.();
    };

    const closeNav = () => {
      nav.classList.remove("nav--open");
      hamburger.classList.remove("is-open");
      hamburger.setAttribute("aria-expanded", "false");
      document.body.setAttribute("data-nav-open", "false");
      hamburger.focus?.();
    };

    const toggle = () => {
      nav.classList.contains("nav--open") ? closeNav() : openNav();
    };

    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });

    document.addEventListener("click", (e) => {
      if (
        nav.classList.contains("nav--open") &&
        !nav.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        closeNav();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("nav--open")) {
        closeNav();
      }
    });

    links.forEach((a) => a.addEventListener("click", () => closeNav()));
  }

  // --- Thème clair / foncé ---
  const themeToggle = document.getElementById("themeToggle");
  // Récupérer la préférence ou utiliser 'light' par défaut
  const saved = localStorage.getItem("zdg_theme_pref") || "light";
  
  // Appliquer le thème immédiatement
  applyTheme(saved);

  // Attacher l'événement au bouton SI il existe
  if (themeToggle) {
    // Mettre à jour le texte du bouton
    themeToggle.textContent = saved === "dark" ? "Clair ☀️" : "Foncé 🌙";
    
    themeToggle.addEventListener("click", (e) => {
      e.preventDefault(); // Empêche le comportement par défaut si c'est dans un form ou un lien
      const current = document.documentElement.dataset.theme;
      const next = current === "dark" ? "light" : "dark";
      
      localStorage.setItem("zdg_theme_pref", next);
      applyTheme(next);
      themeToggle.textContent = next === "dark" ? "Clair ☀️" : "Foncé 🌙";
    });
  }
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  // Note: Les couleurs de fond/texte sont maintenant gérées par le CSS (variables)
  // On laisse le CSS faire le travail basé sur l'attribut data-theme
}

export { initCommonUI, applyTheme };

// Expose globally (utilisé par parametres.js chargé séparément)
window.initCommonUI = initCommonUI;
window.applyTheme   = applyTheme;

// Auto-init quand ui.js est chargé directement (ex: parametres.html)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initCommonUI());
} else {
  initCommonUI();
}