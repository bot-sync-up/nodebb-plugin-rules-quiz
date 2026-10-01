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

const { withUserLock } = require('./lib/lock');

/**
 * static:app.load
 * Initial setup: ensure default settings exist, mount page routes.
 */
plugin.init = async function (params) {
  try {
    const settings = await db.getSettings();
    // Stamp the activation cutoff ONCE. After this, only users who join
    // from now on count as "new" for gating — existing members are not
    // retroactively blocked. (See policy.needsQuiz.)
    if (!settings.activatedAt) {
      await db.setSettings({ activatedAt: Date.now() });
      winston.info('[rules-quiz] activation cutoff stamped — existing members will NOT be gated as new');
    }
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
    // The page-level gate redirect only fires for 'block_all'. In
    // 'block_write' (and legacy 'modal_soft', now equivalent) the user can
    // browse freely and is blocked only at write time by guardKind.
    if (settings.blockMode !== 'block_all') return data;

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
 *      first M topics each require a fresh mini-quiz. POST /submit mints a
 *      single-use token in the user-state hash on a pass; this consumes it.
 *
 * Called only from guardShouldQueue, under a per-user lock.
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
  // 'modal_soft' was a no-op mode (it blocked nothing) — removed from the
  // ACP in v0.8.0. Any stored value now behaves like 'block_write' so the
  // gate actually enforces. 'block_all' also blocks writes.

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

  // Single-use token minted by POST /submit when the mini-quiz is passed.
  // Stored in the user-state hash (DB) because the write hook has no session.
  const now = Date.now();
  const dbField = kind === 'topic' ? 'topicTokenExp' : 'postTokenExp';
  const hasToken = Number((state && state[dbField]) || 0) > now;

  if (hasToken) {
    // Consume the token and count the write. The caller holds a per-user
    // lock, so a concurrent submit can't also see this token.
    let newCount = already + 1;
    try {
      newCount = await db.incrUserField(uid, countField, 1);
    } catch (_) {
      // Fallback to the non-atomic path if incr isn't available.
      await db.setUserState(uid, { [countField]: already + 1 });
    }
    await db.setUserState(uid, { [dbField]: 0, lastGateAt: now, lastGateKind: kind });
    winston.info('[rules-quiz] ' + kind + ' gate PASSED uid=' + uid + ' count=' + newCount + '/' + limit);
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

/**
 * filter:post.shouldQueue — the ONLY write gate.
 *
 * NodeBB calls posts.shouldQueue(caller.uid, payload) from the user-facing
 * create/reply API (src/api/topics.js) for every topic and reply a user
 * submits, before deciding whether to queue it. It is NOT called when a
 * moderator approves a queued post (posts.submitFromQueue calls
 * topics.post/reply directly) or splits/merges posts (fork.js calls
 * Topics.create with the original author's uid). Gating here therefore
 * covers every user-initiated write exactly once, and never blocks a
 * moderator acting on a not-yet-passed user's content — which the old
 * filter:topic.create / filter:topic.reply / filter:post-queue.save hooks did.
 *
 * Payload: { shouldQueue, uid, data }. We leave shouldQueue untouched
 * — we only throw to reject the attempt entirely.
 */
plugin.guardShouldQueue = async function (payload) {
  try {
    const uid = payload && payload.uid;
    if (!uid) return payload;
    const d = payload.data || {};
    // New-topic vs reply detection. A new topic ALWAYS carries a non-empty
    // string `title`; a reply NEVER does. Older logic also required `cid`
    // and the absence of `tid`, but in the live NodeBB flow `tid` may be
    // assigned mid-pipeline (when `posts.shouldQueue` is called from
    // inside `Topics.post` after `Topics.create` has already materialised
    // the topic id). The title check is the only signal that's stable.
    const looksLikeTopic = !!(d && typeof d.title === 'string' && d.title.trim().length > 0);
    const kind = looksLikeTopic ? 'topic' : 'post';
    winston.info('[rules-quiz] guardShouldQueue uid=' + uid + ' kind=' + kind
      + ' title=' + (d.title ? JSON.stringify(d.title).slice(0, 60) : '(none)')
      + ' tid=' + (d.tid || '-') + ' cid=' + (d.cid || '-')
      + ' payloadType=' + (payload.type || '-'));
    await withUserLock(uid, () => guardKind(kind, { uid: uid, data: d }));
    return payload;
  } catch (e) {
    if (e.code && e.code.indexOf('rules-quiz:') === 0) throw e;
    winston.error('[rules-quiz] guardShouldQueue: ' + e.stack);
    return payload;
  }
};

async function getMinimalUser(uid) {
  // Be defensive: each of the three lookups can throw independently
  // (e.g., DB blip, NodeBB API change). Returning {uid} with no groups
  // used to make admins fail-CLOSED — they'd lose group-based exemption
  // and get blocked by their own gate. We try each lookup individually,
  // also consult isAdministrator/isGlobalMod directly so we never lose
  // staff exemption due to a groups-lookup failure.
  const user = (() => { try { return require.main.require('./src/user'); } catch (e) { return null; } })();
  const groups = (() => { try { return require.main.require('./src/groups'); } catch (e) { return null; } })();
  let data = {};
  let groupNames = [];
  if (user) {
    try { data = await user.getUserFields(uid, ['uid', 'username', 'reputation', 'joindate']) || {}; } catch (_) { /* keep {} */ }
    try {
      const isAdmin = await user.isAdministrator(uid);
      if (isAdmin) groupNames.push('administrators');
    } catch (_) { /* noop */ }
    try {
      if (typeof user.isGlobalModerator === 'function') {
        const isMod = await user.isGlobalModerator(uid);
        if (isMod) groupNames.push('Global Moderators');
      }
    } catch (_) { /* noop */ }
  }
  if (groups) {
    try {
      const arr = await groups.getUserGroups([uid]);
      const list = (arr && arr[0]) || [];
      list.forEach((g) => { if (g && g.name && groupNames.indexOf(g.name) === -1) groupNames.push(g.name); });
    } catch (_) { /* keep what we have */ }
  }
  return Object.assign({}, data, { uid: uid, groups: groupNames });
}

module.exports = plugin;
