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
    const seed = require('./lib/seed');
    const r = await seed.seedIfEmpty(db);
    if (r.seeded > 0) winston.info('[rules-quiz] seeded ' + r.seeded + ' starter questions');
  } catch (e) {
    winston.warn('[rules-quiz] seed failed: ' + e.message);
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
 * Two-stage gate for writes:
 *   1. Onboarding gate: user hasn't passed the initial rules quiz at all.
 *      (Same behavior as before — blocks regardless of kind.)
 *   2. Per-kind gate: even after onboarding, the first N replies and the
 *      first M topics each require a fresh mini-quiz. The quiz handshake
 *      is done via a session-scoped token set by POST /submit on a pass.
 *
 * @param {'post'|'topic'} kind  `'post'` for replies, `'topic'` for new topics.
 * @param {object} data  NodeBB hook payload.
 * @returns {Promise<object>}
 */
async function guardKind(kind, data) {
  const uid = data && (data.uid || (data.data && data.data.uid));
  if (!uid) return data;

  const settings = await db.getSettings();
  if (!settings.enabled) return data;
  if (settings.blockMode === 'modal_soft') return data;

  const user = await getMinimalUser(uid);
  if (policy.isExempt(user, settings)) return data;

  const state = await db.getUserState(uid);

  // --- Stage 1: onboarding gate --------------------------------------
  // If they still need the initial quiz, block every kind of write.
  if (policy.needsQuiz(user, state || {}, settings)) {
    const e = new Error('[[rulesquiz:error.must_pass_first]]');
    e.code = 'rules-quiz:not-passed';
    throw e;
  }

  // --- Stage 2: per-kind gate ----------------------------------------
  const gate = kind === 'topic' ? settings.topicGate : settings.postGate;
  if (!gate || !gate.enabled) return data;
  const limit = Number(gate.applyForFirstN || 0);
  if (limit <= 0) return data;

  const countField = kind === 'topic' ? 'topicsCreated' : 'postsCreated';
  const already = Number((state && state[countField]) || 0);
  if (already >= limit) return data; // past the gate window — free to post

  // Token handshake via the user-state hash (DB-backed) — socket.io hook
  // contexts don't carry req.session, so storing the token only in the
  // session would make the gate impossible to pass. Session is kept as a
  // belt-and-braces backup.
  const now = Date.now();
  const dbField = kind === 'topic' ? 'topicTokenExp' : 'postTokenExp';
  const dbExp = Number((state && state[dbField]) || 0);
  let hasToken = dbExp > now;

  if (!hasToken) {
    const req = (data && (data.req || (data.data && data.data.req))) || null;
    const session = req && req.session;
    const tokenField = kind === 'topic' ? 'rqTopicToken' : 'rqPostToken';
    const token = session && session[tokenField];
    if (token && token.exp && token.exp > now) {
      hasToken = true;
      try { if (session) delete session[tokenField]; } catch (_) { /* noop */ }
    }
  }

  if (hasToken) {
    // Consume (single-use) + increment the kind counter.
    const nextState = {};
    nextState[countField] = already + 1;
    nextState[dbField] = 0;
    await db.setUserState(uid, nextState);
    winston.info('[rules-quiz] ' + kind + ' gate PASSED uid=' + uid + ' count=' + (already + 1) + '/' + limit);
    return data;
  }

  // No valid token — redirect them to the right mini-quiz.
  // Embed the gate code in the error message too, so the client-side
  // gate-redirect.js script can reliably detect it in the toast text.
  const code = kind === 'topic' ? 'rules-quiz:topic-gate' : 'rules-quiz:post-gate';
  const key = kind === 'topic' ? 'error.need_topic_quiz' : 'error.need_post_quiz';
  winston.info('[rules-quiz] ' + kind + ' gate BLOCKED uid=' + uid + ' (no token)');
  const e = new Error('[[rulesquiz:' + key + ']] [' + code + ']');
  e.code = code;
  throw e;
}

plugin.guardPost = async function (data) {
  try {
    return await guardKind('post', data);
  } catch (e) {
    if (e.code && e.code.indexOf('rules-quiz:') === 0) throw e;
    winston.error('[rules-quiz] guardPost: ' + e.stack);
    return data;
  }
};

plugin.guardTopic = async function (data) {
  try {
    return await guardKind('topic', data);
  } catch (e) {
    if (e.code && e.code.indexOf('rules-quiz:') === 0) throw e;
    winston.error('[rules-quiz] guardTopic: ' + e.stack);
    return data;
  }
};

/**
 * filter:post.shouldQueue fires for every reply / topic attempt, BEFORE
 * NodeBB decides whether to put the post into its moderation queue.
 * Hooking here lets us gate posts that would otherwise bypass
 * filter:topic.reply / filter:topic.create via the queue path.
 *
 * Payload: { shouldQueue, uid, data }. We leave shouldQueue untouched
 * — we only throw to reject the attempt entirely.
 */
plugin.guardShouldQueue = async function (payload) {
  try {
    const uid = payload && payload.uid;
    if (!uid) return payload;
    const d = payload.data || {};
    // Distinguish topic vs reply: new topics have `cid` + `title` and no `tid`;
    // replies have a `tid`. If we can't tell, assume reply (post gate, the
    // smaller / more common case).
    const kind = (d.cid && d.title && !d.tid) ? 'topic' : 'post';
    await guardKind(kind, { uid: uid, data: d });
    return payload;
  } catch (e) {
    if (e.code && e.code.indexOf('rules-quiz:') === 0) throw e;
    winston.error('[rules-quiz] guardShouldQueue: ' + e.stack);
    return payload;
  }
};

/**
 * filter:post-queue.save is our final line of defense — fires right
 * before the queued post is actually persisted to the review queue.
 * If shouldQueue was already past us, this still catches it.
 */
plugin.guardQueued = async function (payload) {
  try {
    const uid = payload && payload.uid;
    if (!uid) return payload;
    const type = payload && payload.type;  // 'reply' | 'topic'
    const kind = type === 'topic' ? 'topic' : 'post';
    const d = payload.data || {};
    await guardKind(kind, { uid: uid, data: d });
    return payload;
  } catch (e) {
    if (e.code && e.code.indexOf('rules-quiz:') === 0) throw e;
    winston.error('[rules-quiz] guardQueued: ' + e.stack);
    return payload;
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
