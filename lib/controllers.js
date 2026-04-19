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

const winston = (() => {
  try { return require.main.require('winston'); }
  catch (e) { return { info: console.log, warn: console.warn, error: console.error }; }
})();

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
/**
 * Produce a mode-aware copy of settings, overlaying `postGate` or
 * `topicGate` onto the `quiz` block so that pickQuestionsForAttempt and
 * scoreAttempt honor the smaller per-post / per-topic quiz sizes.
 *
 * @param {object} settings The full stored settings object.
 * @param {'onboarding'|'post'|'topic'} mode
 * @returns {object} A shallow-cloned settings object with `.quiz` replaced.
 */
function settingsForMode(settings, mode) {
  if (mode === 'post' && settings && settings.postGate) {
    return Object.assign({}, settings, {
      quiz: Object.assign({}, settings.quiz, {
        sampleSize: settings.postGate.sampleSize,
        passPercent: settings.postGate.passPercent,
        passMode: settings.quiz && settings.quiz.passMode,
      }),
    });
  }
  if (mode === 'topic' && settings && settings.topicGate) {
    return Object.assign({}, settings, {
      quiz: Object.assign({}, settings.quiz, {
        sampleSize: settings.topicGate.sampleSize,
        passPercent: settings.topicGate.passPercent,
        passMode: settings.quiz && settings.quiz.passMode,
      }),
    });
  }
  return settings;
}

async function buildQuizPayload(req) {
  const uid = req.uid;
  const [rawSettings, userState, allQuestions] = await Promise.all([
    db.getSettings(),
    db.getUserState(uid),
    db.listQuestions({}),
  ]);
  const mode = (req && req.query && ['post', 'topic'].indexOf(req.query.mode) !== -1)
    ? req.query.mode : 'onboarding';
  const settings = settingsForMode(rawSettings, mode);
  const picked = policy.pickQuestionsForAttempt(allQuestions || [], settings);
  const safeQuestions = (picked || []).map(stripQuestionForClient);

  // Preserve the page the user was on (if redirected here by a gate) so
  // we can bounce them back after a successful submit.
  try {
    if (req && req.session && req.query && typeof req.query.returnTo === 'string' && req.query.returnTo) {
      const rt = req.query.returnTo;
      if (/^\/[A-Za-z0-9\-_/?&=%#.]+$/.test(rt) && rt.indexOf('//') === -1) {
        req.session.rqReturnTo = rt;
      }
    }
  } catch (_) { /* noop */ }

  // Remember which qids were served so `submitQuiz` can score against the same
  // subset — not the entire question bank. Without this, a 40-question pool
  // with sampleSize=8 would score the 8 answered questions out of 40, making
  // it impossible to reach the pass threshold.
  // Also remember the mode so submit knows which gate to unlock on success.
  try {
    if (req.session) {
      req.session.rqPickedQids = (picked || []).map((q) => String(q.qid));
      req.session.rqMode = mode;
    }
  } catch (_) { /* no session on some route shapes — server-side fallback below */ }
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
    mode: mode,
    settings: settings,
    settingsJson: JSON.stringify(settings),
    user: { uid: uid },
    questions: safeQuestions,
    questionsJson: JSON.stringify(safeQuestions),
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
  // super-aggressive logging: these go straight to stdout so they appear in
  // NodeBB's log regardless of winston transport configuration.
  console.error('[rules-quiz] submitQuiz ENTRY uid=' + (req && req.uid)
    + ' body=' + JSON.stringify(req && req.body).slice(0, 400));
  if (!req.uid) {
    console.error('[rules-quiz] submitQuiz NO-UID');
    util.jsonErr(res, 401, 'not-authorized');
    return;
  }
  const uid = req.uid;
  const [userState, rawSettings, allQuestions] = await Promise.all([
    db.getUserState(uid),
    db.getSettings(),
    db.listQuestions({}),
  ]);

  // Mode priority: explicit body/query → stored session from the GET /quiz →
  // onboarding. This keeps the pass-threshold + sample-size consistent with
  // what the user actually saw on the quiz screen.
  const explicitMode = (req.body && req.body.mode)
    || (req.query && req.query.mode)
    || (req.session && req.session.rqMode)
    || 'onboarding';
  const mode = ['post', 'topic', 'onboarding'].indexOf(explicitMode) !== -1
    ? explicitMode : 'onboarding';
  const settings = settingsForMode(rawSettings, mode);

  const answers = (req.body && req.body.answers) || {};
  console.error('[rules-quiz] submit uid=' + uid + ' mode=' + mode
    + ' questionsInDb=' + (Array.isArray(allQuestions) ? allQuestions.length : 'N/A')
    + ' answersKeys=' + Object.keys(answers).join(',')
    + ' passMode=' + (settings && settings.quiz && settings.quiz.passMode)
    + ' passPercent=' + (settings && settings.quiz && settings.quiz.passPercent)
    + ' state.status=' + (userState && userState.status));
  winston.info('[rules-quiz] submit uid=' + uid + ' mode=' + mode
    + ' questionsInDb=' + (Array.isArray(allQuestions) ? allQuestions.length : 'N/A')
    + ' answersKeys=' + Object.keys(answers).join(',')
    + ' passMode=' + (settings && settings.quiz && settings.quiz.passMode)
    + ' passPercent=' + (settings && settings.quiz && settings.quiz.passPercent)
    + ' state.status=' + (userState && userState.status));

  const gate = policy.canAttempt(userState, settings, util.now());
  if (!gate || !gate.allowed) {
    winston.info('[rules-quiz] submit GATE-DENIED uid=' + uid + ' reason=' + (gate && gate.reasonCode));
    util.jsonOk(res, {
      ok: false,
      reason: gate && gate.reasonCode,
      retryAfterMs: gate && gate.retryAfterMs,
    });
    return;
  }

  const started = await db.startAttempt(uid);
  const aid = started && started.aid;

  // Score only the subset of questions we actually served this attempt.
  // Preference order: session-stored qids → answer-object keys → everything.
  let scoredQuestions = allQuestions || [];
  const pickedQids = (req.session && Array.isArray(req.session.rqPickedQids))
    ? req.session.rqPickedQids
    : [];
  if (pickedQids.length > 0) {
    const set = new Set(pickedQids.map(String));
    scoredQuestions = (allQuestions || []).filter((q) => set.has(String(q.qid)));
    console.error('[rules-quiz] submit scoring against SESSION qids=' + pickedQids.join(','));
  } else {
    const answerKeys = Object.keys(answers || {});
    if (answerKeys.length > 0) {
      const set = new Set(answerKeys.map(String));
      scoredQuestions = (allQuestions || []).filter((q) => set.has(String(q.qid)));
      console.error('[rules-quiz] submit scoring against ANSWER-KEYS qids=' + answerKeys.join(','));
    } else {
      console.error('[rules-quiz] submit scoring against ALL ' + scoredQuestions.length + ' questions (no session, no answers)');
    }
  }

  const scored = policy.scoreAttempt(scoredQuestions, answers, settings);
  winston.info('[rules-quiz] submit SCORED uid=' + uid
    + ' scoredAgainst=' + scoredQuestions.length + ' of ' + (allQuestions || []).length
    + ' score=' + scored.score + '/' + scored.total + ' passed=' + scored.passed);
  console.error('[rules-quiz] submit SCORED uid=' + uid
    + ' scoredAgainst=' + scoredQuestions.length + ' of ' + (allQuestions || []).length
    + ' score=' + scored.score + '/' + scored.total + ' passed=' + scored.passed);

  // Clear session pick so the next /quiz visit gets a fresh pick.
  try { if (req.session && req.session.rqPickedQids) delete req.session.rqPickedQids; } catch (_) { /* noop */ }

  await db.finishAttempt(aid, {
    answers: answers,
    score: scored.score,
    total: scored.total,
    passed: scored.passed,
  });

  const newState = policy.applyOutcome(userState, scored, settings);
  await db.setUserState(uid, newState);

  // Per-gate tokens: on a passing `post` / `topic` quiz, set a single-use
  // session token that `filter:topic.reply` / `filter:topic.create` will
  // consume the next time the user tries to post. Onboarding passes grant
  // no token because onboarding is not about a specific next write.
  if (scored.passed) {
    try {
      if (req.session && mode === 'post') {
        req.session.rqPostToken = { at: Date.now(), exp: Date.now() + 15 * 60 * 1000 };
      }
      if (req.session && mode === 'topic') {
        req.session.rqTopicToken = { at: Date.now(), exp: Date.now() + 15 * 60 * 1000 };
      }
    } catch (_) { /* noop */ }
    if (mode === 'onboarding') {
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

  // Build a rich perQuestion response so the client can show a full breakdown
  // (title, user's answer, correct answer, explanation) on the result screen.
  const byQid = new Map();
  for (const q of (allQuestions || [])) byQid.set(String(q.qid), q);
  const richPerQ = (scored.perQuestion || []).map((pq) => {
    const q = byQid.get(String(pq.qid)) || {};
    const opts = Array.isArray(q.options) ? q.options : [];
    const optById = new Map(opts.map((o) => [String(o.id), o]));

    // Normalize given into a readable string.
    let givenText = '';
    if (q.type === 'multi' && Array.isArray(pq.given)) {
      givenText = pq.given.map((id) => (optById.get(String(id)) || {}).text || id).join(', ');
    } else if (q.type === 'freetext') {
      givenText = String(pq.given == null ? '' : pq.given);
    } else {
      const o = optById.get(String(pq.given));
      givenText = o ? o.text : '';
    }

    // Resolve the correct answer.
    let correctText = '';
    if (q.type === 'multi') {
      correctText = opts.filter((o) => o.correct).map((o) => o.text).join(', ');
    } else if (q.type === 'freetext') {
      correctText = q.answerText || q.answerRegex || '';
    } else {
      const o = opts.find((oo) => oo.correct);
      correctText = o ? o.text : '';
    }

    return {
      qid: pq.qid,
      title: q.title || '',
      type: q.type || 'single',
      correct: !!pq.correct,
      given: givenText,
      correctAnswer: correctText,
      explanation: q.explanationMarkdown || '',
      ruleLinkUrl: q.ruleLinkUrl || '',
    };
  });

  winston.info('[rules-quiz] submit RESPONSE uid=' + uid + ' returning score=' + scored.score
    + '/' + scored.total + ' passed=' + scored.passed + ' perQ=' + richPerQ.length);

  // For gated modes, send the user back to where they were (e.g. the topic
  // page where they hit "reply"). Clear the stored returnTo so subsequent
  // navigations don't accidentally reuse it.
  let redirectTo = null;
  if (scored.passed) {
    if (mode === 'post' || mode === 'topic') {
      redirectTo = (req.session && req.session.rqReturnTo) || '/';
      try { if (req.session) delete req.session.rqReturnTo; } catch (_) { /* noop */ }
    } else {
      redirectTo = (settings && settings.onSuccess && settings.onSuccess.redirectTo) || null;
    }
  }

  util.jsonOk(res, {
    ok: true,
    passed: scored.passed,
    score: scored.score,
    total: scored.total,
    perQuestion: richPerQ,
    mode: mode,
    redirectTo: redirectTo,
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
  try {
    const body = req.body || {};
    winston.info('[rules-quiz] adminCreateQuestion body keys: '
      + Object.keys(body).join(','));
    const data = body.question ? body.question : body;
    const created = await db.createQuestion(data);
    util.jsonOk(res, { question: created });
  } catch (e) {
    winston.warn('[rules-quiz] adminCreateQuestion failed: ' + (e && e.message));
    res.status(400).json({ error: 'invalid-question', detail: e && e.message });
  }
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
  const body = req.body || {};
  winston.info('[rules-quiz] adminSaveSettings body keys: '
    + Object.keys(body).join(','));
  // Accept both a bare settings object and a wrapped { settings: {...} }.
  // Prefer the wrapped form when it looks like a plain object.
  const partial = (body && typeof body.settings === 'object' && body.settings !== null
    && !Array.isArray(body.settings))
    ? body.settings
    : body;
  await db.setSettings(partial || {});
  // Verify the write by re-reading from the DB so the client sees the
  // authoritative persisted state.
  const verified = await db.getSettings();
  util.jsonOk(res, { settings: verified });
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
