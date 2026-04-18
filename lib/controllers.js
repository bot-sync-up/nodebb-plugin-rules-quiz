'use strict';

/**
 * HTTP controllers for nodebb-plugin-rules-quiz.
 *
 * All exports are `(req, res)` Express handlers. Controllers do no scoring
 * themselves: they delegate to `lib/policy` and only persist via `lib/db`.
 */

const db = require('./db');
const policy = require('./policy');
const notify = require('./notify');
const util = require('./util');
const markdown = require('./markdown');

/**
 * Pull the body of the first post of a NodeBB topic, best-effort.
 * Used to embed the rules thread inside the quiz page.
 *
 * @param {string} url e.g. "/topic/5489" or "/topic/5489/some-slug"
 * @returns {Promise<string>} rendered HTML, or '' on failure.
 */
async function tryFetchTopicBody(url) {
  try {
    const m = /\/topic\/(\d+)/.exec(String(url || ''));
    if (!m) return '';
    const tid = Number(m[1]);
    const topics = require.main.require('./src/topics');
    const posts = require.main.require('./src/posts');
    const mainPid = await topics.getTopicField(tid, 'mainPid');
    if (!mainPid) return '';
    const p = await posts.getPostFields(mainPid, ['content']);
    if (!p || !p.content) return '';
    // Let NodeBB's configured parser render the content.
    try {
      const plugins = require.main.require('./src/plugins');
      const parsed = await plugins.hooks.fire('filter:parse.raw', String(p.content));
      if (parsed && typeof parsed === 'string') return parsed;
    } catch (e) { /* fall through to markdown */ }
    return markdown.render(String(p.content));
  } catch (e) {
    return '';
  }
}

const DEFAULT_STATS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Strip server-only fields from a question before sending it to the client.
 *
 * Removes `correct` flags from each option and the canonical answer fields
 * (`answerText`, `answerRegex`, `explanationMarkdown`). The originals stay
 * server-side until after submit / explanation rendering.
 *
 * @param {object} q
 * @returns {object}
 */
function stripQuestionForClient(q) {
  if (!q || typeof q !== 'object') return q;
  const safe = Object.assign({}, q);
  if (Array.isArray(safe.options)) {
    safe.options = safe.options.map((opt) => {
      const o = Object.assign({}, opt);
      delete o.correct;
      return o;
    });
  }
  delete safe.answerText;
  delete safe.answerRegex;
  delete safe.explanationMarkdown;
  return safe;
}

/**
 * Resolve the request locale, defaulting to `en-GB`.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function pickLang(req) {
  return (req && (req.locale || (req.query && req.query.lang))) || 'en-GB';
}

/**
 * Build the data block shared by `renderQuizPage` and `getQuizData`.
 *
 * @param {import('express').Request} req
 * @returns {Promise<object>}
 */
async function buildQuizPayload(req) {
  const uid = req.uid;
  const [settings, userState, allQuestions] = await Promise.all([
    db.getSettings(),
    db.getUserState(uid),
    db.listQuestions({}),
  ]);
  const picked = policy.pickQuestionsForAttempt(allQuestions || [], settings);
  const safeQuestions = (picked || []).map(stripQuestionForClient);
  const lang = pickLang(req);

  // Pre-render markdown server-side so the template doesn't show raw ## / **.
  const rulesText = settings && settings.rules && settings.rules.rulesText;
  const introMd = settings && settings.intro && settings.intro.markdown;
  let rulesHtml = rulesText ? markdown.render(rulesText) : '';
  const introHtml = introMd ? markdown.render(introMd) : '';

  // If no inline rules text was set, and rulesUrl points to a topic on this
  // forum, try to embed that topic's first post inside the quiz page.
  if (!rulesHtml && settings && settings.rules && settings.rules.rulesUrl) {
    const fetched = await tryFetchTopicBody(settings.rules.rulesUrl);
    if (fetched) rulesHtml = fetched;
  }

  return {
    rtl: lang === 'he',
    lang: lang,
    settings: settings,
    user: { uid: uid },
    questions: safeQuestions,
    gateAck: !!(userState && userState.gateAck),
    status: userState ? userState.status : 'pending',
    rulesHtml: rulesHtml,
    introHtml: introHtml,
  };
}

/**
 * GET `/quiz` — render the rules → intro → questions page.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function renderQuizPage(req, res) {
  const payload = await buildQuizPayload(req);
  res.render('quiz/index', payload);
}

/**
 * GET `/api/v3/plugins/rules-quiz/quiz` — JSON variant of `renderQuizPage`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function getQuizData(req, res) {
  const payload = await buildQuizPayload(req);
  util.jsonOk(res, payload);
}

/**
 * POST `/api/v3/plugins/rules-quiz/ack` — record that the user has read
 * and accepted the forum rules. Requires a logged-in user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function ackRules(req, res) {
  if (!req.uid) {
    util.jsonErr(res, 401, 'not-authorized');
    return;
  }
  await db.setUserState(req.uid, { gateAck: true });
  util.jsonOk(res, { ok: true });
}

/**
 * POST `/api/v3/plugins/rules-quiz/submit` — score and persist a quiz attempt.
 *
 * Pipeline:
 *   1. Verify `policy.canAttempt`. If denied → JSON `{ ok:false, reason, retryAfterMs }`.
 *   2. Open a new attempt via `db.startAttempt`.
 *   3. Score via `policy.scoreAttempt`.
 *   4. Persist via `db.finishAttempt`.
 *   5. Apply outcome → `db.setUserState`.
 *   6. On pass → `notify.notifyUserPassed` and (optional) success-group add.
 *   7. If attempts crossed `notifyAdminOnFails` → notify admins.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function submitQuiz(req, res) {
  if (!req.uid) {
    util.jsonErr(res, 401, 'not-authorized');
    return;
  }
  const uid = req.uid;
  const [userState, settings, allQuestions] = await Promise.all([
    db.getUserState(uid),
    db.getSettings(),
    db.listQuestions({}),
  ]);

  const gate = policy.canAttempt(userState, settings, util.now());
  if (!gate || !gate.allowed) {
    util.jsonOk(res, {
      ok: false,
      reason: gate && gate.reasonCode,
      retryAfterMs: gate && gate.retryAfterMs,
    });
    return;
  }

  const started = await db.startAttempt(uid);
  const aid = started && started.aid;

  const answers = (req.body && req.body.answers) || {};
  const scored = policy.scoreAttempt(allQuestions || [], answers, settings);

  await db.finishAttempt(aid, {
    answers: answers,
    score: scored.score,
    total: scored.total,
    passed: scored.passed,
  });

  const newState = policy.applyOutcome(userState, scored, settings);
  await db.setUserState(uid, newState);

  if (scored.passed) {
    try {
      await notify.notifyUserPassed(uid);
    } catch (_) { /* non-fatal */ }
    const group = settings && settings.onSuccess && settings.onSuccess.addToGroup;
    if (group) {
      try {
        await notify.addUserToSuccessGroup(uid, group);
      } catch (_) { /* non-fatal */ }
    }
  }

  const attempts = (newState && typeof newState.attempts === 'number')
    ? newState.attempts
    : ((userState && userState.attempts) || 0) + 1;
  const threshold = settings && settings.notifyAdminOnFails;
  if (!scored.passed && threshold && attempts >= threshold) {
    try {
      await notify.notifyAdminsRepeatedFails(uid, attempts);
    } catch (_) { /* non-fatal */ }
  }

  util.jsonOk(res, {
    ok: true,
    passed: scored.passed,
    score: scored.score,
    total: scored.total,
    perQuestion: scored.perQuestion,
    redirectTo: scored.passed
      ? (settings && settings.onSuccess && settings.onSuccess.redirectTo) || null
      : null,
  });
}

/**
 * GET `/admin/plugins/rules-quiz` — render the ACP page shell.
 *
 * Detailed data (questions list, stats, etc.) is fetched by the admin
 * client JS via the `/admin` API endpoints below.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function getAdminPage(req, res) {
  const [settings, allQuestions] = await Promise.all([
    db.getSettings(),
    db.listQuestions({}),
  ]);
  res.render('admin/plugins/rules-quiz', {
    settings: settings,
    questionCount: Array.isArray(allQuestions) ? allQuestions.length : 0,
    lang: pickLang(req),
  });
}

/**
 * GET `/api/v3/plugins/rules-quiz/admin/questions` — list all questions.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminListQuestions(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const limit = req.query && req.query.limit ? parseInt(req.query.limit, 10) : undefined;
  const offset = req.query && req.query.offset ? parseInt(req.query.offset, 10) : undefined;
  const questions = await db.listQuestions({ limit: limit, offset: offset });
  util.jsonOk(res, { questions: questions });
}

/**
 * POST `/api/v3/plugins/rules-quiz/admin/questions` — create a question.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminCreateQuestion(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const created = await db.createQuestion(req.body || {});
  util.jsonOk(res, { question: created });
}

/**
 * PUT `/api/v3/plugins/rules-quiz/admin/questions/:qid` — update a question.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminUpdateQuestion(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const qid = req.params && req.params.qid;
  if (!qid) {
    util.jsonErr(res, 400, 'missing-qid');
    return;
  }
  const updated = await db.updateQuestion(qid, req.body || {});
  util.jsonOk(res, { question: updated });
}

/**
 * DELETE `/api/v3/plugins/rules-quiz/admin/questions/:qid` — delete a question.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminDeleteQuestion(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const qid = req.params && req.params.qid;
  if (!qid) {
    util.jsonErr(res, 400, 'missing-qid');
    return;
  }
  await db.deleteQuestion(qid);
  util.jsonOk(res, { ok: true });
}

/**
 * POST `/api/v3/plugins/rules-quiz/admin/questions/import` — bulk import.
 *
 * Body: `{ format: "json"|"csv", payload: string|object }`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminImportQuestions(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const body = req.body || {};
  const format = body.format || 'json';
  const payload = body.payload;
  const result = await db.importQuestions(format, payload);
  util.jsonOk(res, result);
}

/**
 * GET `/api/v3/plugins/rules-quiz/admin/settings` — fetch current settings.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminGetSettings(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const settings = await db.getSettings();
  util.jsonOk(res, { settings: settings });
}

/**
 * PUT `/api/v3/plugins/rules-quiz/admin/settings` — patch settings.
 *
 * Accepts a partial object; `db.setSettings` deep-merges with existing.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminSaveSettings(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const merged = await db.setSettings(req.body || {});
  util.jsonOk(res, { settings: merged });
}

/**
 * GET `/api/v3/plugins/rules-quiz/admin/stats` — aggregate stats.
 *
 * Query params: `from`, `to` (ISO date strings). Defaults to last 30 days.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminGetStats(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const q = req.query || {};
  const nowMs = util.now();
  let from = q.from ? Date.parse(q.from) : (nowMs - DEFAULT_STATS_WINDOW_MS);
  let to = q.to ? Date.parse(q.to) : nowMs;
  if (isNaN(from)) from = nowMs - DEFAULT_STATS_WINDOW_MS;
  if (isNaN(to)) to = nowMs;
  const stats = await db.getStats({ from: from, to: to });
  util.jsonOk(res, stats);
}

/**
 * GET `/api/v3/plugins/rules-quiz/admin/users/:uid/attempts` —
 * list attempt history for a single user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function adminGetUserAttempts(req, res) {
  if (!(await util.requireAdmin(req, res))) return;
  const targetUid = req.params && req.params.uid;
  if (!targetUid) {
    util.jsonErr(res, 400, 'missing-uid');
    return;
  }
  const limit = req.query && req.query.limit ? parseInt(req.query.limit, 10) : undefined;
  const attempts = await db.listUserAttempts(targetUid, { limit: limit });
  util.jsonOk(res, { attempts: attempts });
}

module.exports = {
  renderQuizPage,
  getQuizData,
  ackRules,
  submitQuiz,
  getAdminPage,
  adminListQuestions,
  adminCreateQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
  adminImportQuestions,
  adminGetSettings,
  adminSaveSettings,
  adminGetStats,
  adminGetUserAttempts,
};
