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
  // NodeBB 4 does NOT populate `req.uid` on custom `/api/v3/*` routes unless
  // one of the `authenticateRequest` / `authenticateFull` middleware is
  // mounted on the handler chain. We accept whichever signature exists and
  // silently no-op if neither is available.
  const authenticate = [
    middleware.authenticateRequest,
    middleware.authenticateFull,
    middleware.authenticate,
  ].find((fn) => typeof fn === 'function');
  const authChain = authenticate ? [authenticate] : [];
  const userChain = authenticate
    ? (middleware.ensureLoggedIn ? [authenticate, middleware.ensureLoggedIn] : [authenticate])
    : (middleware.ensureLoggedIn ? [middleware.ensureLoggedIn] : []);

  mountApi(router, helpers, 'get',  USER_API_BASE + '/quiz',        userChain, controllers.getQuizData);
  mountApi(router, helpers, 'get',  USER_API_BASE + '/gate-status', userChain, controllers.getGateStatus);
  mountApi(router, helpers, 'post', USER_API_BASE + '/ack',         userChain, controllers.ackRules);
  mountApi(router, helpers, 'post', USER_API_BASE + '/submit',      userChain, controllers.submitQuiz);

  // ---- Admin page -----------------------------------------------------
  if (helpers && typeof helpers.setupAdminPageRoute === 'function') {
    helpers.setupAdminPageRoute(
      router,
      '/admin/plugins/rules-quiz',
      [],
      controllers.getAdminPage
    );
  }

  // ---- Admin JSON API -------------------------------------------------
  // Admin API routes must run through the session/auth middleware so
  // `req.uid` is populated before `util.requireAdmin` inspects it. We also
  // add `middleware.admin.checkPrivileges` when available so non-admins are
  // rejected at the framework layer before our handler even runs.
  const adminCheck = (middleware.admin && typeof middleware.admin.checkPrivileges === 'function')
    ? middleware.admin.checkPrivileges
    : null;
  const adminChain = [].concat(authChain, adminCheck ? [adminCheck] : []);

  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/questions',           adminChain, controllers.adminListQuestions);
  mountApi(router, helpers, 'post',   ADMIN_API_BASE + '/questions',           adminChain, controllers.adminCreateQuestion);
  mountApi(router, helpers, 'put',    ADMIN_API_BASE + '/questions/:qid',      adminChain, controllers.adminUpdateQuestion);
  mountApi(router, helpers, 'delete', ADMIN_API_BASE + '/questions/:qid',      adminChain, controllers.adminDeleteQuestion);
  mountApi(router, helpers, 'post',   ADMIN_API_BASE + '/questions/import',    adminChain, controllers.adminImportQuestions);
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/settings',            adminChain, controllers.adminGetSettings);
  mountApi(router, helpers, 'put',    ADMIN_API_BASE + '/settings',            adminChain, controllers.adminSaveSettings);
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/stats',               adminChain, controllers.adminGetStats);
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/users/:uid/attempts', adminChain, controllers.adminGetUserAttempts);

  // Per-user admin actions (v0.6.0). `:uid` routes are ordered so the more
  // specific `/attempts` above is matched first by Express's router.
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/failing-users',                adminChain, controllers.adminGetFailingUsers);
  mountApi(router, helpers, 'get',    ADMIN_API_BASE + '/users/:uid',                   adminChain, controllers.adminGetUser);
  mountApi(router, helpers, 'post',   ADMIN_API_BASE + '/users/:uid/reset-counters',    adminChain, controllers.adminResetUserCounters);
  mountApi(router, helpers, 'post',   ADMIN_API_BASE + '/users/:uid/reset-onboarding',  adminChain, controllers.adminResetUserOnboarding);
  mountApi(router, helpers, 'post',   ADMIN_API_BASE + '/users/:uid/exempt',            adminChain, controllers.adminExemptUser);
  mountApi(router, helpers, 'post',   ADMIN_API_BASE + '/users/:uid/unexempt',          adminChain, controllers.adminUnexemptUser);

  // Reference util to ensure consumers keep it in scope; harmless lint-quieter.
  void util;
}

module.exports = { setup };
