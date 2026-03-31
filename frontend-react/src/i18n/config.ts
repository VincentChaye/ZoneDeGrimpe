import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './fr.json';
import en from './en.json';
import es from './es.json';

export const SUPPORTED_LANGS = ['fr', 'en', 'es'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

function detectLang(): Lang {
  // 1. URL param
  const url = new URLSearchParams(window.location.search).get('lang');
  if (url && SUPPORTED_LANGS.includes(url as Lang)) return url as Lang;

  // 2. localStorage
  const stored = localStorage.getItem('zdg_lang');
  if (stored && SUPPORTED_LANGS.includes(stored as Lang)) return stored as Lang;

  // 3. User DB prefs
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    const pref = auth?.user?.preferences?.lang;
    if (pref && SUPPORTED_LANGS.includes(pref as Lang)) return pref as Lang;
  } catch { /* ignore */ }

  // 4. Browser
  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  if (SUPPORTED_LANGS.includes(nav as Lang)) return nav as Lang;

  return 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    es: { translation: es },
  },
  lng: detectLang(),
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;
