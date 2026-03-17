import { initCommonUI } from "./ui.js";

initCommonUI();

// Masquer le bouton "Créer un compte" si l'utilisateur est déjà connecté
try {
  const auth = JSON.parse(localStorage.getItem("auth") || "null");
  if (auth?.token) {
    const btnSecondary = document.querySelector(".hero__btn-secondary");
    if (btnSecondary) btnSecondary.style.display = "none";
  }
} catch {}
// Emplacements pour charger des modules dynamiques sur la home au besoin.
