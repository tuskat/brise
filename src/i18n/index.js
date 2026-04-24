/**
 * i18n module — lightweight translation system for Brise.
 *
 * Two modes:
 *   1) JS imperative:  t('dashboard.title')  → "Dashboard"
 *   2) HTML declarative: <span data-i18n="dashboard.title"></span>
 *      → applyTranslations() fills textContent from the active dictionary
 *
 * Locale is read from localStorage('brise_locale') on init.
 * Changing locale + calling applyTranslations() updates the entire page
 * instantly — no reload needed.
 */

import en from './translations/en.js';
import fr from './translations/fr.js';

// ── Registry ──

const dictionaries = { en, fr };

const STORAGE_KEY = 'brise_locale';
const DEFAULT_LOCALE = 'en';

let currentLocale = DEFAULT_LOCALE;

// ── Init from localStorage ──

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && dictionaries[stored]) return stored;
  } catch {
    // localStorage unavailable (SSR, etc.)
  }
  // Try navigator.language as a hint
  try {
    const navLang = (navigator.language || 'en').split('-')[0];
    if (dictionaries[navLang]) return navLang;
  } catch {
    // navigator unavailable
  }
  return DEFAULT_LOCALE;
}

// ── Public API ──

/**
 * Translate a key, with optional interpolation.
 * Supports {key} placeholders in the translation string.
 *
 * @param {string} key   — dot-path key like 'dashboard.title'
 * @param {object} vars  — optional { ms: 42, ... } for interpolation
 * @returns {string}     — translated string, or the key itself if missing
 */
export function t(key, vars) {
  const dict = dictionaries[currentLocale] || dictionaries[DEFAULT_LOCALE];
  let str = dict[key] || dictionaries[DEFAULT_LOCALE][key] || key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
    }
  }

  return str;
}

/**
 * Get the current locale code.
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Set the active locale and persist to localStorage.
 * Returns the locale that was actually set (may differ if invalid).
 */
export function setLocale(locale) {
  if (!dictionaries[locale]) {
    console.warn(`[i18n] Unknown locale "${locale}", falling back to "${DEFAULT_LOCALE}"`);
    locale = DEFAULT_LOCALE;
  }
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage unavailable
  }
  return locale;
}

/**
 * Get list of available locale codes.
 */
export function getAvailableLocales() {
  return Object.keys(dictionaries);
}

/**
 * Initialize locale from storage. Called once on app startup.
 * Safe to call multiple times.
 */
export function initLocale() {
  currentLocale = readStoredLocale();
  return currentLocale;
}

// ═══════════════════════════════════════════════════════════
// DOM WALKER — fills [data-i18n] elements from active dictionary
// ═══════════════════════════════════════════════════════════

/**
 * Walk all elements with data-i18n / data-i18n-placeholder /
 * data-i18n-aria / data-i18n-title and fill them from the
 * active translation dictionary.
 *
 * Call once on boot, and again after setLocale().
 */
export function applyTranslations() {
  // textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (!key) return;
    const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined;
    el.textContent = t(key, vars);
  });

  // placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (!key) return;
    el.setAttribute('placeholder', t(key));
  });

  // aria-label
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.dataset.i18nAria;
    if (!key) return;
    el.setAttribute('aria-label', t(key));
  });

  // title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (!key) return;
    el.setAttribute('title', t(key));
  });

  // <option> value="ollama" data-i18n="proxies.form.schemaOllama"
  document.querySelectorAll('option[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (!key) return;
    el.textContent = t(key);
  });

  // Update <html lang>
  document.documentElement.lang = currentLocale;

  // Sync locale select if present
  const localeSelect = document.getElementById('locale-select');
  if (localeSelect) localeSelect.value = currentLocale;
}

/**
 * Init locale + apply all translations.
 * Called once on page boot, after the skeleton is showing.
 */
export function initI18n() {
  initLocale();
  applyTranslations();
}
