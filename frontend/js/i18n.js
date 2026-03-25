/**
 * Systeme i18n leger pour ZoneDeGrimpe
 * - Fichiers JSON par langue dans /i18n/
 * - data-i18n="key" sur les elements HTML
 * - data-i18n-placeholder="key" pour les placeholders
 * - data-i18n-title="key" pour les titres
 * - t(key, params) pour les strings dynamiques
 */

const SUPPORTED_LANGS = ["fr", "en", "es"];
const DEFAULT_LANG = "fr";
let currentLang = DEFAULT_LANG;
let translations = {};

/** Detecte la langue preferee */
function detectLang() {
  // 1. URL param
  const url = new URLSearchParams(window.location.search).get("lang");
  if (url && SUPPORTED_LANGS.includes(url)) return url;
  // 2. localStorage
  const stored = localStorage.getItem("zdg_lang");
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  // 3. User DB prefs (stocke dans localStorage.auth)
  try {
    const auth = JSON.parse(localStorage.getItem("auth") || "{}");
    const pref = auth?.user?.preferences?.lang;
    if (pref && SUPPORTED_LANGS.includes(pref)) return pref;
  } catch {}
  // 4. Browser
  const nav = (navigator.language || "").slice(0, 2).toLowerCase();
  if (SUPPORTED_LANGS.includes(nav)) return nav;
  // 5. Default
  return DEFAULT_LANG;
}

/** Charge le fichier de traduction */
async function loadTranslations(lang) {
  try {
    // Chemin relatif depuis n'importe quelle page
    const base = document.querySelector('script[src*="i18n.js"]')?.src;
    const dir = base ? new URL("../i18n/", base).href : "./i18n/";
    const res = await fetch(`${dir}${lang}.json`, { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[i18n] Impossible de charger ${lang}.json:`, e.message);
    return {};
  }
}

/** Recupere une traduction avec interpolation */
function t(key, params) {
  let str = translations[key];
  if (str === undefined) return key; // fallback: affiche la cle
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return str;
}

/** Traduit tous les elements du DOM avec data-i18n* */
function translateDOM(root = document) {
  // textContent
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = t(key);
    if (val !== key) el.textContent = val;
  });
  // placeholder
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const val = t(key);
    if (val !== key) el.placeholder = val;
  });
  // title / aria-label
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const val = t(key);
    if (val !== key) el.setAttribute("title", val);
  });
  // aria-label
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    const val = t(key);
    if (val !== key) el.setAttribute("aria-label", val);
  });
}

/** Change la langue et re-traduit immediatement */
async function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem("zdg_lang", lang);
  document.documentElement.lang = lang;
  translations = await loadTranslations(lang);
  translateDOM();
  // Sync tous les selecteurs de langue
  document.querySelectorAll("#langSelect, .lang-select").forEach((sel) => {
    if (sel.value !== lang) sel.value = lang;
  });
  // Evenement pour que d'autres modules puissent reagir
  window.dispatchEvent(new CustomEvent("zdg:lang-changed", { detail: { lang } }));
}

/** Langue courante */
function getLang() {
  return currentLang;
}

/** Liste des langues supportees */
function getSupportedLangs() {
  return [...SUPPORTED_LANGS];
}

/** Init: detecte et charge */
async function initI18n() {
  const lang = detectLang();
  currentLang = lang;
  document.documentElement.lang = lang;
  translations = await loadTranslations(lang);
  translateDOM();
}

export { t, translateDOM, setLanguage, getLang, getSupportedLangs, initI18n, SUPPORTED_LANGS };
