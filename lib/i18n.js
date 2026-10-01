'use strict';

/**
 * Server-side strings for our templates.
 *
 * NodeBB up to 4.15 translated every [[namespace:key]] token in a rendered
 * page. 4.16 dropped that pass in favour of a {tx(...)} template helper,
 * which older versions don't have — so a template written either way breaks
 * on the other. Our templates use plain data instead ({t.rules_heading}),
 * filled here from the language files: that renders the same on every
 * supported version, server-side and in ajaxify's client-side render.
 */

const NS = 'rulesquiz';
const FALLBACK_LANG = 'en-GB';
const RTL_LANGS = ['he', 'ar', 'fa', 'ur'];

function loadNamespace(lang) {
  return new Promise((resolve) => {
    try {
      const translator = require.main.require('./src/translator');
      translator.getTranslations(lang, NS, (strings) => resolve(strings || {}));
    } catch (e) {
      resolve({});
    }
  });
}

function sanitizeLang(lang) {
  return typeof lang === 'string' && /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(lang) ? lang : '';
}

/**
 * The language NodeBB itself renders this request in — same order as
 * NodeBB's render middleware: ?lang=, then the user's (or ACP) setting.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} [res]
 * @param {boolean} [acp] use the ACP language setting
 * @returns {Promise<string>}
 */
async function resolveLang(req, res, acp) {
  const fromQuery = sanitizeLang(req && req.query && req.query.lang);
  if (fromQuery) return fromQuery;
  let config = res && res.locals && res.locals.config;
  if (!config || !(config.userLang || config.acpLang)) {
    try {
      const user = require.main.require('./src/user');
      config = await user.getSettings((req && req.uid) || 0);
    } catch (e) {
      config = {};
    }
  }
  return sanitizeLang(acp ? config.acpLang : config.userLang) || FALLBACK_LANG;
}

/**
 * All strings of our namespace for `lang`, with en-GB filling any gaps,
 * keyed for template use: 'rules.heading' → t.rules_heading.
 *
 * @param {string} lang
 * @param {(key: string) => boolean} [filter]
 * @returns {Promise<Object<string, string>>}
 */
async function templateStrings(lang, filter) {
  const [base, local] = await Promise.all([
    loadNamespace(FALLBACK_LANG),
    lang === FALLBACK_LANG ? {} : loadNamespace(lang),
  ]);
  const merged = Object.assign({}, base, local);
  const t = {};
  Object.keys(merged).forEach((key) => {
    if (filter && !filter(key)) return;
    t[key.replace(/\./g, '_')] = merged[key];
  });
  return t;
}

function isRtl(lang) {
  return RTL_LANGS.indexOf(String(lang || '').split(/[-_]/)[0]) !== -1;
}

module.exports = { resolveLang, templateStrings, isRtl, sanitizeLang };
