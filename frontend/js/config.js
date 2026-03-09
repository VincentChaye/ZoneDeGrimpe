// config.js

// URL du backend en production
const PROD_API = "https://zonedegrimpe.onrender.com";

// Détection locale
function isLocalHost(hostname) {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(hostname);
}

// Récupération sûre de la variable d'environnement Vite (si présente)
let envBaseUrl = undefined;
try {
  // eslint-disable-next-line no-undef
  envBaseUrl = import.meta?.env?.VITE_API_BASE_URL;
} catch {
  envBaseUrl = undefined;
}

// Détermination automatique de l’URL de base
export const API_BASE_URL =
  envBaseUrl ||
  (typeof window !== "undefined" && isLocalHost(window.location.hostname)
    ? "http://localhost:3000"
    : PROD_API);

// Préfixe pour les routes backend
export const API_PATH_PREFIX = "/api";

// Constantes pour le cache
export const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes
export const CACHE_KEYS = {
  SPOTS: "cache_spots_v1",
};
