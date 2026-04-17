'use strict';

/**
 * Shared helpers for nodebb-plugin-rules-quiz.
 *
 * Thin wrappers around NodeBB internals plus tiny stateless utilities.
 * Keep this module dependency-free apart from `require.main.require` calls,
 * so it can be imported from any layer (controllers, middleware, hooks).
 */

const user = require.main.require('./src/user');

/**
 * Check whether a uid belongs to the administrators group.
 *
 * Wraps NodeBB's `user.isAdministrator` so callers don't need to reach
 * into core directly.
 *
 * @param {number|string} uid
 * @returns {Promise<boolean>}
 */
async function isAdministrator(uid) {
  if (!uid) return false;
  return !!(await user.isAdministrator(uid));
}

/**
 * Guard helper for admin-only HTTP endpoints.
 *
 * Resolves to `true` when the request's `req.uid` is an administrator.
 * On failure (missing uid or non-admin) writes a 403 JSON response
 * `{ error: 'forbidden' }` to `res` and resolves to `false`. Callers
 * should `return` immediately when this returns `false`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<boolean>}
 */
async function requireAdmin(req, res) {
  const uid = req && req.uid;
  if (!uid) {
    jsonErr(res, 403, 'forbidden');
    return false;
  }
  const ok = await isAdministrator(uid);
  if (!ok) {
    jsonErr(res, 403, 'forbidden');
    return false;
  }
  return true;
}

/**
 * Write a 200 JSON success envelope.
 *
 * @param {import('express').Response} res
 * @param {*} data
 * @returns {void}
 */
function jsonOk(res, data) {
  res.status(200).json(data === undefined ? { ok: true } : data);
}

/**
 * Write a JSON error envelope with the given HTTP status code.
 *
 * @param {import('express').Response} res
 * @param {number} code
 * @param {string} msg
 * @returns {void}
 */
function jsonErr(res, code, msg) {
  res.status(code || 500).json({ error: msg || 'error' });
}

/**
 * Current epoch milliseconds. Wrapped so tests can stub if needed.
 *
 * @returns {number}
 */
function now() {
  return Date.now();
}

/**
 * Parse JSON safely, returning `fallback` on any error or non-string input.
 *
 * @param {string} str
 * @param {*} fallback
 * @returns {*}
 */
function safeJsonParse(str, fallback) {
  if (typeof str !== 'string' || !str.length) return fallback;
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

module.exports = {
  isAdministrator,
  requireAdmin,
  jsonOk,
  jsonErr,
  now,
  safeJsonParse,
};
