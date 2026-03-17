// frontend/config.js
const PROD_API = "https://zonedegrimpe.onrender.com";

function isLocalHost(host) {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(host);
}

// Configuration globale pour l'application
window.APP_CONFIG = {
  API_URL: window && window.location && isLocalHost(window.location.hostname) ? "http://localhost:3000" : PROD_API
};

// Export pour compatibilité avec les modules ES6 si nécessaire
if (typeof module != 'undefined' && module.exports) {
  module.exports = { API_BASE_URL: window.APP_CONFIG.API_URL };
}
