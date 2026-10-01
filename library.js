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
const { getMinimalUser } = require('./lib/users');

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
 * Write gate. policy.evaluateWrite decides; this applies the verdict:
 *   - needs-onboarding → reject (the user hasn't passed the rules quiz)
 *   - token            → allow, consume the single-use token, count the write
 *   - retry            → allow without a new quiz: NodeBB rejected the
 *                        previous attempt after the token was spent
 *   - needs-quiz       → reject, the user must pass the per-reply/topic quiz
 *   - anything else    → allow (exempt, not targeted, past the window...)
 *
 * Called only from guardShouldQueue, under a per-user lock.
 *
 * @param {'post'|'topic'} kind  `'post'` for replies, `'topic'` for new topics.
 * @param {object} data  { uid, data, queued }
 * @returns {Promise<object>}
 */
async function guardKind(kind, data) {
  const uid = data && (data.uid || (data.data && data.data.uid));
  if (!uid) return data;

  const settings = await db.getSettings();
  if (!settings.enabled) return data;

  const [user, state] = await Promise.all([getMinimalUser(uid), db.getUserState(uid)]);
  const now = Date.now();
  const verdict = policy.evaluateWrite(kind, user, state, settings, now);

  if (verdict.reason === 'needs-onboarding') {
    // The [code] marker lets gate-redirect.js recognise the rejection.
    const e = new Error('[[rulesquiz:error.must_pass_first]] [rules-quiz:not-passed]');
    e.code = 'rules-quiz:not-passed';
    throw e;
  }

  if (verdict.reason === 'token') {
    const countField = kind === 'topic' ? 'topicsCreated' : 'postsCreated';
    const dbField = kind === 'topic' ? 'topicTokenExp' : 'postTokenExp';
    const already = Number(state[countField] || 0);
    let newCount = already + 1;
    try {
      newCount = await db.incrUserField(uid, countField, 1);
    } catch (_) {
      await db.setUserState(uid, { [countField]: already + 1 });
    }
    // This hook runs before NodeBB validates the post (length, flood
    // control...). Remember the attempt and the user's NodeBB post/topic
    // count, so a retry after a rejection isn't sent back to the quiz.
    // A queued post is final, so nothing to remember for it.
    const liveCount = Number((kind === 'topic' ? user.topiccount : user.postcount) || 0);
    const pending = data.queued
      ? { pendingKind: '', pendingAt: 0, pendingCount: 0 }
      : { pendingKind: kind, pendingAt: now, pendingCount: liveCount };
    await db.setUserState(uid, Object.assign({ [dbField]: 0, lastGateAt: now, lastGateKind: kind }, pending));
    winston.info('[rules-quiz] ' + kind + ' gate PASSED uid=' + uid + ' count=' + newCount);
    return data;
  }

  if (verdict.reason === 'retry') {
    await db.setUserState(uid, { pendingAt: now });
    winston.info('[rules-quiz] ' + kind + ' gate PASSED uid=' + uid + ' (retry after NodeBB rejected the previous attempt)');
    return data;
  }

  if (verdict.allowed) return data;

  // needs-quiz: send them to the right mini-quiz.
  // Embed the gate code in the error message too, so the client-side
  // gate-redirect.js script can recognise the rejection.
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
    await withUserLock(uid, () => guardKind(kind, { uid: uid, data: d, queued: !!payload.shouldQueue }));
    return payload;
  } catch (e) {
    if (e.code && e.code.indexOf('rules-quiz:') === 0) throw e;
    winston.error('[rules-quiz] guardShouldQueue: ' + e.stack);
    return payload;
  }
};

module.exports = plugin;
