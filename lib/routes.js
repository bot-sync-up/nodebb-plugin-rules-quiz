'use strict';

/**
 * Route registration for nodebb-plugin-rules-quiz.
 *
 * Wires page and JSON-API endpoints onto a NodeBB router using the
 * core `helpers` module. Tolerant of both static:app.load and
 * static:api.routes hook shapes, and falls back to direct router
 * registration on NodeBB versions (≤ 2.5) that lack `setupApiRoute`.
 */

const controllers = require('./controllers');
const util = require('./util');

const USER_API_BASE = '/api/v3/plugins/rules-quiz';
const ADMIN_API_BASE = '/api/v3/plugins/rules-quiz/admin';

/**
 * Mount a JSON API route, preferring `helpers.setupApiRoute` (NodeBB 2.6+)
 * and falling back to direct `router[method]` registration otherwise.
 *
 * @param {object} router
 * @param {object} helpers
 * @param {string} method
 * @param {string} path
 * @param {Function[]} mws
 * @param {Function} controller
 * @returns {void}
 */
function mountApi(router, helpers, method, path, mws, controller) {
  if (helpers && typeof helpers.setupApiRoute === 'function') {
    helpers.setupApiRoute(router, method, path, mws || [], controller);
    return;
  }
  const m = String(method).toLowerCase();
  if (typeof router[m] === 'function') {
    router[m](path, ...(mws || []), controller);
  }
}

/**
 * Plugin route setup. Invoked from both `static:app.load` and
 * `static:api.routes` — accepts either signature shape.
 *
 * @param {object} params
 * @param {object} params.router
 * @param {object} params.middleware
 * @param {object} [params.helpers]
 * @param {object} [params.app]
 * @returns {void}
 */
function setup(params) {
  const router = params && params.router;
  const middleware = (params && params.middleware) || {};
  let helpers = params && params.helpers;
  if (!helpers) {
    try {
      helpers = require.main.require('./src/routes/helpers');
    } catch (_) {
      helpers = {};
    }
  }

  if (!router) {
    return;
  }

  // ---- User-facing page route -----------------------------------------
  if (helpers && typeof helpers.setupPageRoute === 'function') {
    helpers.setupPageRoute(
      router,
      '/quiz',
      [middleware.ensureLoggedIn].filter(Boolean),
      controllers.renderQuizPage
    );
  }

  // ---- User JSON API --------------------------------------------------
  const ensureLoggedIn = middleware.ensureLoggedIn ? [middleware.ensureLoggedIn] : [];
  mountApi(router, helpers, 'get',  USER_API_BASE + '/quiz',   ensureLoggedIn, controllers.getQuizData);
  mountApi(router, helpers, 'post', USER_API_BASE + '/ack',    ensureLoggedIn, controllers.ackRules);
  mountApi(router, helpers, 'post', USER_API_BASE + '/submit', ensureLoggedIn, controllers.submitQuiz);

  // ---- Admin page -----------------------------------------------------
  if (helpers && typeof helpers.setupAdminPageRoute === 'function') {
    helpers.setupAdminPageRoute(
      router,
      '/admin/plugins/rules-quiz',
      [],
      controllers.getAdminPage
    );
  }

  // ---- Admin JSON API (auth gated inside controllers via util.requireAdmin) ----
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/questions',           [], controllers.adminListQuestions);
  mountApi(router, helpers, 'post',   ADMIN_API_BASE + '/questions',           [], controllers.adminCreateQuestion);
  mountApi(router, helpers, 'put',    ADMIN_API_BASE + '/questions/:qid',      [], controllers.adminUpdateQuestion);
  mountApi(router, helpers, 'delete', ADMIN_API_BASE + '/questions/:qid',      [], controllers.adminDeleteQuestion);
  mountApi(router, helpers, 'post',   ADMIN_API_BASE + '/questions/import',    [], controllers.adminImportQuestions);
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/settings',            [], controllers.adminGetSettings);
  mountApi(router, helpers, 'put',    ADMIN_API_BASE + '/settings',            [], controllers.adminSaveSettings);
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/stats',               [], controllers.adminGetStats);
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/users/:uid/attempts', [], controllers.adminGetUserAttempts);

  // Reference util to ensure consumers keep it in scope; harmless lint-quieter.
  void util;
}

module.exports = { setup };
