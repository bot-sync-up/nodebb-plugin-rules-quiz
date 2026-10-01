'use strict';

/**
 * Pure policy logic — no DB writes, no NodeBB internals.
 * Easy to unit-test in isolation.
 */

/**
 * Should this user be required to take the quiz?
 * @param {{uid:number, groups?:string[], reputation?:number, joindate?:number}} user
 * @param {object} userState
 * @param {object} settings
 * @returns {boolean}
 */
function needsQuiz(user, userState, settings) {
  if (!settings || !settings.enabled) return false;
  if (!user || !user.uid) return false;
  if (userState && (userState.status === 'passed' || userState.status === 'exempt')) return false;
  if (isExempt(user, settings)) return false;
  // Any other status (pending, failed_cooldown, locked) still needs the quiz.
  // Previously a new user only counted while status was 'pending', so failing
  // once under cooldown/lock mode (status failed_cooldown/locked) silently
  // stopped gating them.
  return isTargeted(user, settings);
}

/**
 * Is this user within the quiz program at all, regardless of whether they
 * have passed? needsQuiz uses it for onboarding, and the per-reply /
 * per-topic gates use it too: a member the program doesn't target must not
 * be gated by those either.
 *
 * "New users" are those who joined at/after settings.activatedAt (stamped
 * once when the plugin first starts). Members who predate it are "existing"
 * and are targeted only through the explicit existing-user rules below.
 * Without that cutoff every pre-existing member was gated the moment the
 * plugin was installed.
 * @returns {boolean}
 */
function isTargeted(user, settings) {
  if (!settings || !settings.enabled) return false;
  if (!user || !user.uid) return false;
  const a = settings.appliesTo || {};

  if (a.newUsers) {
    const cutoff = Number(settings.activatedAt || 0);
    const joined = Number(user.joindate || 0);
    // cutoff === 0 means "not stamped yet" — treat everyone as new until
    // init stamps it (pre-0.8.2 behaviour).
    if (!cutoff || joined >= cutoff) return true;
  }

  if (a.existingUsers) return true;
  if (Array.isArray(a.groups) && a.groups.length && (user.groups || []).some(g => a.groups.includes(g))) return true;
  if (a.minReputation != null && Number(user.reputation || 0) < Number(a.minReputation)) return true;
  if (a.joinedAfter != null && Number(user.joindate || 0) >= Number(a.joinedAfter)) return true;
  if (a.joinedBefore != null && Number(user.joindate || 0) <= Number(a.joinedBefore)) return true;

  return false;
}

/**
 * Is this user exempt from the quiz altogether?
 * @returns {boolean}
 */
function isExempt(user, settings) {
  if (!user) return false;
  // Group-based exemption.
  const exempt = (settings && settings.exemptGroups) || [];
  const userGroups = user.groups || [];
  if (exempt.length && userGroups.some((g) => exempt.includes(g))) return true;
  // Reputation-based exemption: users with reputation >= the configured
  // threshold are trusted and skip all gates. Advertised in the ACP but
  // previously never enforced here. null / 0 disables.
  const minRep = settings && settings.exemptMinReputation;
  if (minRep != null && Number(minRep) > 0 && Number(user.reputation || 0) >= Number(minRep)) {
    return true;
  }
  return false;
}

/**
 * Is this request path exempt from the gate redirect?
 * @returns {boolean}
 */
function isPathExempt(path, settings) {
  if (!path) return true;
  const list = (settings && settings.exemptPaths) || [];
  // Match exact path OR a proper path-segment prefix. Previously used
  // path.indexOf(p) === 0, which made /login also exempt /login-help and
  // /loginbypass — an admin foot-gun and a potential gate bypass.
  return list.some((p) => p && (path === p || path.indexOf(p + '/') === 0));
}

/**
 * Pick the questions to ask this attempt, honoring sample size and shuffle settings.
 * @param {Array} all
 * @param {object} settings
 * @returns {Array}
 */
function pickQuestionsForAttempt(all, settings) {
  if (!Array.isArray(all) || !all.length) return [];
  const q = (settings && settings.quiz) || {};
  let pool = all.slice();
  if (q.shuffleQuestions) shuffleInPlace(pool);
  else pool.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const n = Number(q.sampleSize || 0);
  if (n > 0 && n < pool.length) pool = pool.slice(0, n);
  if (q.shuffleAnswers) {
    pool = pool.map(qq => Object.assign({}, qq, {
      options: Array.isArray(qq.options) ? shuffleInPlace(qq.options.slice()) : qq.options,
    }));
  }
  return pool;
}

/**
 * Score a submitted attempt against the canonical question set.
 * @param {Array} questions
 * @param {Object} answers — { qid: optionIdOrText | optionId[] }
 * @param {object} settings
 * @returns {{score:number, total:number, passed:boolean, perQuestion:Array}}
 */
function scoreAttempt(questions, answers, settings) {
  let score = 0;
  let total = 0;
  const perQuestion = [];
  const a = answers || {};

  for (const q of questions) {
    // weight=0 was previously coerced to 1 by (q.weight || 1) — losing
    // admin intent for skip-counting questions. Also guard NaN / negative.
    let w = Number(q.weight);
    if (!Number.isFinite(w) || w < 0) w = 1;
    if (w === 0) { perQuestion.push({ qid: q.qid, correct: false, given: a[q.qid], weight: 0 }); continue; }
    total += w;
    const given = a[q.qid];
    let correct = false;

    if (q.type === 'single' || q.type === 'truefalse') {
      const winner = (q.options || []).find(o => o.correct);
      correct = !!winner && given != null && String(given) === String(winner.id);
    } else if (q.type === 'multi') {
      const winners = new Set((q.options || []).filter(o => o.correct).map(o => String(o.id)));
      const givenSet = new Set((Array.isArray(given) ? given : []).map(String));
      correct = winners.size === givenSet.size && [...winners].every(x => givenSet.has(x));
    } else if (q.type === 'freetext') {
      const txt = String(given == null ? '' : given).trim();
      if (q.answerRegex) {
        try { correct = new RegExp(q.answerRegex, 'i').test(txt); }
        catch (e) { correct = false; }
      } else if (q.answerText) {
        correct = txt.toLowerCase() === String(q.answerText).trim().toLowerCase();
      }
    }

    if (correct) score += w;
    perQuestion.push({ qid: q.qid, correct, given, weight: w });
  }

  const q = (settings && settings.quiz) || {};
  let passed;
  if (q.passMode === 'all') passed = score === total;
  else if (q.passMode === 'min_correct') passed = score >= Number(q.passMinCorrect || 0);
  else passed = total > 0 && (score / total) * 100 >= Number(q.passPercent || 80);

  return { score, total, passed, perQuestion };
}

/**
 * Decide whether the user is allowed to attempt the quiz right now.
 * @param {object} userState
 * @param {object} settings
 * @param {number} now
 * @returns {{allowed:boolean, reasonCode?:string, retryAfterMs?:number}}
 */
function canAttempt(userState, settings, now) {
  now = now || Date.now();
  const s = userState || {};
  const f = (settings && settings.onFail) || {};

  if (s.status === 'locked') return { allowed: false, reasonCode: 'locked' };
  if (s.status === 'failed_cooldown' && f.mode === 'cooldown') {
    const until = (s.lastAttemptAt || 0) + Number(f.cooldownSec || 0) * 1000;
    if (now < until) return { allowed: false, reasonCode: 'cooldown', retryAfterMs: until - now };
  }
  if (f.mode === 'lock_after_attempts' && Number(f.lockAfterAttempts || 0) > 0
      && (s.attempts || 0) >= Number(f.lockAfterAttempts)) {
    return { allowed: false, reasonCode: 'locked' };
  }
  if (f.mode === 'daily_limit' && Number(f.maxAttemptsPerDay || 0) > 0) {
    const last24h = now - 24 * 3600 * 1000;
    if ((s.lastAttemptAt || 0) > last24h && (s.attempts || 0) >= Number(f.maxAttemptsPerDay)) {
      return { allowed: false, reasonCode: 'daily_limit', retryAfterMs: (s.lastAttemptAt + 24 * 3600 * 1000) - now };
    }
  }
  return { allowed: true };
}

/**
 * Compute the new user state after scoring an attempt.
 * @returns {object} new partial state to persist
 */
function applyOutcome(userState, scored, settings) {
  const now = Date.now();
  const attempts = (userState && userState.attempts || 0) + 1;
  const f = (settings && settings.onFail) || {};

  const next = {
    attempts,
    lastAttemptAt: now,
  };

  if (scored.passed) {
    next.status = 'passed';
    next.passedAt = now;
    return next;
  }

  if (f.mode === 'cooldown') next.status = 'failed_cooldown';
  else if (f.mode === 'lock_after_attempts' && Number(f.lockAfterAttempts || 0) > 0 && attempts >= Number(f.lockAfterAttempts)) next.status = 'locked';
  else if (f.mode === 'daily_limit') next.status = 'pending';
  else next.status = 'pending';

  return next;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** Lifetime of a mini-quiz token (controllers.submitQuiz mints it). */
const TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * The one place that decides whether `user` may make a write right now.
 * Pure: no DB access, no side effects. The write hook acts on the verdict
 * (and consumes the token), and /gate-status reports it to the browser, so
 * the client-side redirect can never disagree with the server.
 *
 * @param {'post'|'topic'} kind  'post' = reply, 'topic' = new topic
 * @param {object} user   from getMinimalUser (groups, joindate, postcount...)
 * @param {object} state  the user's quiz state
 * @param {object} settings
 * @param {number} now    ms
 * @returns {{allowed: boolean, reason: string}} reason is one of:
 *   disabled, exempt, needs-onboarding, not-targeted, gate-off, past-window,
 *   token (allowed by an unused token), retry (NodeBB rejected the previous
 *   attempt, so the spent token still counts), needs-quiz
 */
function evaluateWrite(kind, user, state, settings, now) {
  const s = state || {};
  if (!settings || !settings.enabled) return { allowed: true, reason: 'disabled' };
  if (isExempt(user, settings) || s.status === 'exempt') return { allowed: true, reason: 'exempt' };
  if (needsQuiz(user, s, settings)) return { allowed: false, reason: 'needs-onboarding' };
  if (!isTargeted(user, settings)) return { allowed: true, reason: 'not-targeted' };

  const gate = kind === 'topic' ? settings.topicGate : settings.postGate;
  const limit = gate && gate.enabled ? Number(gate.applyForFirstN || 0) : 0;
  if (limit <= 0) return { allowed: true, reason: 'gate-off' };
  const already = Number(s[kind === 'topic' ? 'topicsCreated' : 'postsCreated'] || 0);
  if (already >= limit) return { allowed: true, reason: 'past-window' };

  if (Number(s[kind === 'topic' ? 'topicTokenExp' : 'postTokenExp'] || 0) > now) {
    return { allowed: true, reason: 'token' };
  }
  const liveCount = Number((kind === 'topic' ? user.topiccount : user.postcount) || 0);
  if (s.pendingKind === kind
      && now - Number(s.pendingAt || 0) < TOKEN_TTL_MS
      && Number(s.pendingCount) === liveCount) {
    return { allowed: true, reason: 'retry' };
  }
  return { allowed: false, reason: 'needs-quiz' };
}

module.exports = {
  TOKEN_TTL_MS,
  evaluateWrite,
  needsQuiz,
  isTargeted,
  isExempt,
  isPathExempt,
  pickQuestionsForAttempt,
  scoreAttempt,
  canAttempt,
  applyOutcome,
};
