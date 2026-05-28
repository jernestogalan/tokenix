/**
 * src/lib/i18n.js
 * Server-side i18n helper — loads locale JSON and resolves translation keys.
 * Usage: const t = getTranslator('es'); t('hero.title') => 'Cuenta Tokens.'
 */

const path = require('path');
const fs   = require('fs');

const SUPPORTED_LANGS = ['en', 'es', 'zh', 'de'];
const DEFAULT_LANG    = 'en';
const LOCALES_DIR     = path.join(__dirname, '..', 'i18n');

// Cache parsed locale objects in memory after first load
const _cache = {};

/**
 * Load and cache a locale JSON file.
 * @param {string} lang - Language code (en | es | zh | de)
 * @returns {object} Flat/nested translation object
 */
function loadLocale(lang) {
  const code = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  if (_cache[code]) return _cache[code];

  const filePath = path.join(LOCALES_DIR, `${code}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    _cache[code] = JSON.parse(raw);
  } catch (err) {
    console.error(`[i18n] Failed to load locale "${code}":`, err.message);
    _cache[code] = {};
  }
  return _cache[code];
}

/**
 * Resolve a dot-notation key within a nested object.
 * Example: get({hero:{title:'foo'}}, 'hero.title') => 'foo'
 */
function get(obj, key) {
  return key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
}

/**
 * Return a translator function for the given language.
 * The translator falls back to English if a key is missing.
 *
 * @param {string} lang
 * @returns {function(string, object?): string}
 */
function getTranslator(lang) {
  const locale = loadLocale(lang);
  const fallback = loadLocale(DEFAULT_LANG);

  return function t(key, vars = {}) {
    let value = get(locale, key) ?? get(fallback, key) ?? key;
    // Simple variable interpolation: {{varName}}
    if (vars && typeof value === 'string') {
      value = value.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? '');
    }
    return value;
  };
}

/**
 * Express middleware that attaches res.locals.t and res.locals.lang.
 * Reads lang from: query ?lang=, cookie tokenia_lang, Accept-Language header.
 */
function i18nMiddleware(req, res, next) {
  const fromQuery  = req.query && req.query.lang;
  const fromCookie = req.cookies && req.cookies.tokenia_lang;
  const fromHeader = (req.headers['accept-language'] || '').split(',')[0].split('-')[0].toLowerCase();

  const raw  = fromQuery || fromCookie || fromHeader || DEFAULT_LANG;
  const lang = SUPPORTED_LANGS.includes(raw) ? raw : DEFAULT_LANG;

  res.locals.lang = lang;
  res.locals.t    = getTranslator(lang);
  next();
}

module.exports = { getTranslator, i18nMiddleware, SUPPORTED_LANGS, DEFAULT_LANG };
