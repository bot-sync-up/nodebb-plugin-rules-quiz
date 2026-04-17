'use strict';

/**
 * nodebb-plugin-rules-quiz — main entry point.
 *
 * Wires NodeBB hooks declared in plugin.json to handlers in lib/*.
 * Compatibility: NodeBB 2.x / 3.x / 4.x.
 */

const db = require('./lib/db');
const policy = require('./lib/policy');
const routes = require('./lib/routes');
const controllers = require('./lib/controllers');

const winston = (() => {
  try { return require.main.require('winston'); }
  catch (e) { return { info: console.log, warn: console.warn, error: console.error }; }
})();

const plugin = {};

/**
 * static:app.load
 * Initial setup: ensure default settings exist, mount page routes.
 */
plugin.init = async function (params) {
  try {
    await db.getSettings();
  } catch (e) {
    winston.warn('[rules-quiz] could not initialise settings: ' + e.message);
  }

  try {
    routes.setup(params);
    winston.info('[rules-quiz] routes mounted');
  } catch (e) {
    winston.error('[rules-quiz] route setup failed: ' + e.stack);
  }
};

/**
 * static:api.routes
 * Some NodeBB versions deliver router/helpers here instead of in static:app.load.
 */
plugin.addRoutes = async function (params) {
  try {
    routes.setup(params);
  } catch (e) {
    winston.error('[rules-quiz] addRoutes failed: ' + e.stack);
  }
  return params;
};

/**
 * filter:admin.header.build
 * Adds the plugin entry to the ACP sidebar.
 */
plugin.addAdminNavigation = async function (header) {
  header.plugins = header.plugins || [];
  header.plugins.push({
    route: '/plugins/rules-quiz',
    icon: 'fa-question-circle',
    name: 'Rules Quiz',
  });
  return header;
};

/**
 * action:user.create
 * Marks the new user as needing the quiz, unless settings opt out.
 */
plugin.onUserCreate = async function (data) {
  try {
    const user = data && data.user;
    if (!user || !user.uid) return;
    const settings = await db.getSettings();
    if (!settings.enabled) return;
    if (!settings.appliesTo || !settings.appliesTo.newUsers) return;
    await db.setUserState(user.uid, { status: 'pending', attempts: 0, gateAck: false });
  } catch (e) {
    winston.error('[rules-quiz] onUserCreate: ' + e.stack);
  }
};

/**
 * action:user.loggedIn
 * For existing users matching the targeting rules, mark them pending so
 * the next page request gates them.
 */
plugin.onUserLoggedIn = async function (data) {
  try {
    const uid = data && (data.uid || (data.req && data.req.uid));
    if (!uid) return;
    const settings = await db.getSettings();
    if (!settings.enabled) return;

    const state = await db.getUserState(uid);
    if (state && (state.status === 'passed' || state.status === 'exempt')) return;

    const user = await getMinimalUser(uid);
    if (policy.isExempt(user, settings)) {
      if (!state || state.status !== 'exempt') {
        await db.setUserState(uid, { status: 'exempt' });
      }
      return;
    }

    if (policy.needsQuiz(user, state || {}, settings) && (!state || state.status === undefined)) {
      await db.setUserState(uid, { status: 'pending', attempts: state && state.attempts || 0, gateAck: false });
    }
  } catch (e) {
    winston.error('[rules-quiz] onUserLoggedIn: ' + e.stack);
  }
};

/**
 * response:router.page
 * Redirects gated users to /quiz on every page request unless the path is exempt.
 */
plugin.gate = async function (data) {
  try {
    const { req, res } = data || {};
    if (!req || !res || res.headersSent) return data;
    if (!req.uid || req.uid <= 0) return data;

    const settings = await db.getSettings();
    if (!settings.enabled) return data;

    if (policy.isPathExempt(req.path || req.url, settings)) return data;
    if (settings.blockMode === 'block_write' || settings.blockMode === 'modal_soft') return data;
    // block_all only redirects on every request

    const state = await db.getUserState(req.uid);
    if (!state || state.status === 'passed' || state.status === 'exempt') return data;

    const user = await getMinimalUser(req.uid);
    if (policy.isExempt(user, settings)) return data;
    if (!policy.needsQuiz(user, state, settings)) return data;

    const helpers = require.main.require('./src/controllers/helpers');
    helpers.redirect(res, '/quiz');
    return data;
  } catch (e) {
    winston.error('[rules-quiz] gate: ' + e.stack);
    return data;
  }
};

/**
 * filter:post.create / filter:topic.create / filter:topic.reply
 * Blocks writes for users who have not passed when blockMode != modal_soft.
 */
plugin.guardPost = async function (data) {
  try {
    const uid = data && (data.uid || (data.data && data.data.uid));
    if (!uid) return data;

    const settings = await db.getSettings();
    if (!settings.enabled) return data;
    if (settings.blockMode === 'modal_soft') return data;

    const state = await db.getUserState(uid);
    if (state && (state.status === 'passed' || state.status === 'exempt')) return data;

    const user = await getMinimalUser(uid);
    if (policy.isExempt(user, settings)) return data;
    if (!policy.needsQuiz(user, state || {}, settings)) return data;

    const err = new Error('[[rulesquiz:error.must_pass_first]]');
    err.code = 'rules-quiz:not-passed';
    throw err;
  } catch (e) {
    if (e.code === 'rules-quiz:not-passed') throw e;
    winston.error('[rules-quiz] guardPost: ' + e.stack);
    return data;
  }
};

async function getMinimalUser(uid) {
  try {
    const user = require.main.require('./src/user');
    const groups = require.main.require('./src/groups');
    const [data, userGroups, reputation, joindate] = await Promise.all([
      user.getUserFields(uid, ['uid', 'username', 'reputation', 'joindate']),
      groups.getUserGroups([uid]).then(arr => (arr && arr[0]) || []),
      Promise.resolve(),
      Promise.resolve(),
    ]);
    return Object.assign({}, data, {
      groups: (userGroups || []).map(g => g && g.name).filter(Boolean),
    });
  } catch (e) {
    return { uid };
  }
}

module.exports = plugin;
