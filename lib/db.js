'use strict';

/**
 * Data layer for nodebb-plugin-rules-quiz.
 *
 * All persistence goes through NodeBB's database abstraction
 * (`require.main.require('./src/database')`). No HTTP, no rendering, no user/
 * group/notification calls live here.
 *
 * See SPEC §2, §3, §4, §5 for the binding contract.
 */

const db = require.main.require('./src/database');
const csvParseSync = require('csv-parse/sync');
const { defaultSettings, KEYS } = require('./defaults');

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------

/**
 * True for plain JSON objects (not arrays, not null).
 * @param {*} v
 * @returns {boolean}
 */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Recursively merge `src` into `dst`. Arrays and primitives in `src` replace
 * the corresponding value in `dst`. Returns a new object; inputs are not
 * mutated.
 * @param {object} dst
 * @param {object} src
 * @returns {object}
 */
function deepMerge(dst, src) {
  const out = {};
  const dstObj = isPlainObject(dst) ? dst : {};
  const srcObj = isPlainObject(src) ? src : {};
  const keys = new Set([...Object.keys(dstObj), ...Object.keys(srcObj)]);
  keys.forEach((k) => {
    const dv = dstObj[k];
    const sv = srcObj[k];
    if (Object.prototype.hasOwnProperty.call(srcObj, k)) {
      if (isPlainObject(dv) && isPlainObject(sv)) {
        out[k] = deepMerge(dv, sv);
      } else {
        out[k] = sv;
      }
    } else {
      out[k] = dv;
    }
  });
  return out;
}

/**
 * Safe JSON.parse. Returns `fallback` on any parse error.
 * @param {string} str
 * @param {*} fallback
 * @returns {*}
 */
function safeParse(str, fallback) {
  if (typeof str !== 'string' || str === '') {
    return fallback;
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

/**
 * Coerce a value to boolean using common truthy strings.
 * @param {*} v
 * @returns {boolean}
 */
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
  }
  return false;
}

/**
 * Coerce a value to integer; returns `dflt` on NaN.
 * @param {*} v
 * @param {number} dflt
 * @returns {number}
 */
function toInt(v, dflt) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : dflt;
}

/**
 * Today's date as YYYY-MM-DD (UTC).
 * @param {number} [ts] millis
 * @returns {string}
 */
function ymd(ts) {
  const d = ts ? new Date(ts) : new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * Serialize a question record for storage. Array/object fields are stringified.
 * @param {object} q
 * @returns {object}
 */
function serializeQuestion(q) {
  return {
    qid: q.qid,
    type: q.type || 'single',
    title: q.title || '',
    bodyMarkdown: q.bodyMarkdown || '',
    imageUrl: q.imageUrl || '',
    ruleLinkUrl: q.ruleLinkUrl || '',
    options: JSON.stringify(Array.isArray(q.options) ? q.options : []),
    answerText: q.answerText || '',
    answerRegex: q.answerRegex || '',
    explanationMarkdown: q.explanationMarkdown || '',
    weight: typeof q.weight === 'number' ? q.weight : 1,
    tags: JSON.stringify(Array.isArray(q.tags) ? q.tags : []),
    sort: typeof q.sort === 'number' ? q.sort : 100,
    createdAt: q.createdAt || Date.now(),
    updatedAt: q.updatedAt || Date.now(),
  };
}

/**
 * Hydrate a stored question hash into a typed object. JSON fields are parsed.
 * Returns null if `hash` is empty/missing.
 * @param {object|null} hash
 * @returns {object|null}
 */
function hydrateQuestion(hash) {
  if (!hash || typeof hash !== 'object' || Object.keys(hash).length === 0) {
    return null;
  }
  return {
    qid: toInt(hash.qid, 0),
    type: hash.type || 'single',
    title: hash.title || '',
    bodyMarkdown: hash.bodyMarkdown || '',
    imageUrl: hash.imageUrl || '',
    ruleLinkUrl: hash.ruleLinkUrl || '',
    options: safeParse(hash.options, []),
    answerText: hash.answerText || '',
    answerRegex: hash.answerRegex || '',
    explanationMarkdown: hash.explanationMarkdown || '',
    weight: hash.weight !== undefined ? Number(hash.weight) : 1,
    tags: safeParse(hash.tags, []),
    sort: hash.sort !== undefined ? Number(hash.sort) : 100,
    createdAt: toInt(hash.createdAt, 0),
    updatedAt: toInt(hash.updatedAt, 0),
  };
}

/**
 * Validate a question payload. Returns null on success, error message on fail.
 * @param {object} q
 * @returns {string|null}
 */
function validateQuestion(q) {
  if (!q || typeof q !== 'object') return 'question must be an object';
  const type = q.type || 'single';
  if (!['single', 'multi', 'truefalse', 'freetext'].includes(type)) {
    return 'invalid type: ' + type;
  }
  if (!q.title || typeof q.title !== 'string') {
    return 'title is required';
  }
  if (type === 'freetext') {
    if (!q.answerText && !q.answerRegex) {
      return 'freetext requires answerText or answerRegex';
    }
  } else {
    if (!Array.isArray(q.options) || q.options.length === 0) {
      return 'options are required for ' + type;
    }
    const hasCorrect = q.options.some((o) => o && o.correct);
    if (!hasCorrect) {
      return 'at least one option must be marked correct';
    }
  }
  return null;
}

/**
 * Bulk-fetch hashes by key. Uses `db.getObjects` if available, else falls back
 * to per-key `db.getObject`.
 * @param {string[]} keys
 * @returns {Promise<Array<object|null>>}
 */
async function getObjectsBulk(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  if (typeof db.getObjects === 'function') {
    return db.getObjects(keys);
  }
  return Promise.all(keys.map((k) => db.getObject(k)));
}

/**
 * Default state object for a user with no recorded quiz state.
 * @returns {object}
 */
function defaultUserState() {
  return {
    status: 'pending',
    attempts: 0,
    lastAttemptAt: 0,
    passedAt: 0,
    gateAck: false,
    postsCreated: 0,
    topicsCreated: 0,
    postTokenExp: 0,
    topicTokenExp: 0,
    returnTo: '',
    lastGateAt: 0,
    lastGateKind: '',
  };
}

/**
 * Hydrate stored user-state hash fields into typed values.
 * @param {object|null} hash
 * @returns {object}
 */
function hydrateUserState(hash) {
  const base = defaultUserState();
  if (!hash || typeof hash !== 'object') return base;
  return {
    status: hash.status || base.status,
    attempts: toInt(hash.attempts, base.attempts),
    lastAttemptAt: toInt(hash.lastAttemptAt, base.lastAttemptAt),
    passedAt: toInt(hash.passedAt, base.passedAt),
    gateAck: hash.gateAck === undefined ? base.gateAck : toBool(hash.gateAck),
    postsCreated: toInt(hash.postsCreated, base.postsCreated),
    topicsCreated: toInt(hash.topicsCreated, base.topicsCreated),
    postTokenExp: toInt(hash.postTokenExp, base.postTokenExp),
    topicTokenExp: toInt(hash.topicTokenExp, base.topicTokenExp),
    returnTo: hash.returnTo || base.returnTo,
    lastGateAt: toInt(hash.lastGateAt, base.lastGateAt),
    lastGateKind: hash.lastGateKind || base.lastGateKind,
  };
}

/**
 * Hydrate a stored attempt hash. Returns null if missing.
 * @param {object|null} hash
 * @returns {object|null}
 */
function hydrateAttempt(hash) {
  if (!hash || typeof hash !== 'object' || Object.keys(hash).length === 0) {
    return null;
  }
  return {
    aid: toInt(hash.aid, 0),
    uid: toInt(hash.uid, 0),
    startedAt: toInt(hash.startedAt, 0),
    finishedAt: toInt(hash.finishedAt, 0),
    score: hash.score !== undefined ? Number(hash.score) : 0,
    total: hash.total !== undefined ? Number(hash.total) : 0,
    passed: hash.passed === undefined ? false : toBool(hash.passed),
    answersJson: hash.answersJson || '',
    mode: hash.mode || 'onboarding',
  };
}

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

/**
 * Read the merged settings object. Stored value is deep-merged over
 * `defaultSettings` so newly-added defaults appear without migration.
 * @returns {Promise<object>}
 */
async function getSettings() {
  const raw = await db.getObjectField(KEYS.settings, 'value');
  const stored = safeParse(raw, {});
  return deepMerge(defaultSettings, stored);
}

/**
 * Persist a partial settings object. Deep-merges over current settings (not
 * defaults), writes the result, and returns it.
 * @param {object} partial
 * @returns {Promise<object>}
 */
async function setSettings(partial) {
  const current = await getSettings();
  const merged = deepMerge(current, partial || {});
  await db.setObjectField(KEYS.settings, 'value', JSON.stringify(merged));
  return merged;
}

/**
 * Reset settings to defaults and return them.
 * @returns {Promise<object>}
 */
async function resetSettings() {
  await db.setObjectField(KEYS.settings, 'value', JSON.stringify(defaultSettings));
  // return a fresh deep copy so callers can mutate safely
  return deepMerge(defaultSettings, {});
}

// ---------------------------------------------------------------------------
// questions
// ---------------------------------------------------------------------------

/**
 * List questions sorted by their `sort` score.
 * @param {{ limit?: number, offset?: number }} [opts]
 * @returns {Promise<Array<object>>}
 */
async function listQuestions(opts) {
  const offset = opts && Number.isFinite(opts.offset) ? opts.offset : 0;
  const limit = opts && Number.isFinite(opts.limit) ? opts.limit : -1;
  const stop = limit < 0 ? -1 : offset + limit - 1;
  const ids = await db.getSortedSetRange(KEYS.questions, offset, stop);
  if (!ids || ids.length === 0) return [];
  const keys = ids.map((qid) => KEYS.question(qid));
  const hashes = await getObjectsBulk(keys);
  return hashes.map(hydrateQuestion).filter((q) => q !== null);
}

/**
 * Read one question by id. Returns null if missing.
 * @param {number|string} qid
 * @returns {Promise<object|null>}
 */
async function getQuestion(qid) {
  if (qid === undefined || qid === null) return null;
  const hash = await db.getObject(KEYS.question(qid));
  return hydrateQuestion(hash);
}

/**
 * Create a question. Auto-assigns qid via `db.increment`. Indexes into the
 * questions sorted set with score = `data.sort ?? 100*qid`.
 * @param {object} data
 * @returns {Promise<object>} the created question
 */
async function createQuestion(data) {
  const qid = await db.increment(KEYS.nextQid);
  const now = Date.now();
  const sort = (data && typeof data.sort === 'number') ? data.sort : 100 * qid;
  const record = serializeQuestion({
    ...data,
    qid,
    sort,
    createdAt: now,
    updatedAt: now,
  });
  await db.setObject(KEYS.question(qid), record);
  await db.sortedSetAdd(KEYS.questions, sort, qid);
  return hydrateQuestion(record);
}

/**
 * Update a question. Merges `data` into the existing record, refreshes the
 * sorted-set score if `sort` changed, and returns the new state.
 * @param {number|string} qid
 * @param {object} data
 * @returns {Promise<object>}
 */
async function updateQuestion(qid, data) {
  const existing = await getQuestion(qid);
  if (!existing) {
    throw new Error('question not found: ' + qid);
  }
  const merged = {
    ...existing,
    ...(data || {}),
    qid: existing.qid,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
  const record = serializeQuestion(merged);
  await db.setObject(KEYS.question(qid), record);
  if (data && typeof data.sort === 'number' && data.sort !== existing.sort) {
    await db.sortedSetAdd(KEYS.questions, data.sort, qid);
  }
  return hydrateQuestion(record);
}

/**
 * Delete a question: removes the hash, the sorted-set membership, and the
 * fail-stat entry. No-op if absent.
 * @param {number|string} qid
 * @returns {Promise<void>}
 */
async function deleteQuestion(qid) {
  if (qid === undefined || qid === null) return;
  await db.delete(KEYS.question(qid));
  await db.sortedSetRemove(KEYS.questions, qid);
  await db.sortedSetRemove(KEYS.statsQuestionFails, qid);
}

/**
 * Parse a CSV options column like `a|Anything|0;b|On-topic|1`.
 * @param {string} str
 * @returns {Array<{id:string,text:string,correct:boolean}>}
 */
function parseCsvOptions(str) {
  if (!str || typeof str !== 'string') return [];
  return str
    .split(';')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const parts = seg.split('|');
      return {
        id: (parts[0] || '').trim(),
        text: (parts[1] || '').trim(),
        correct: toBool(parts[2]),
      };
    });
}

/**
 * Parse a CSV tags column. Either a JSON array string or pipe-separated.
 * @param {string} str
 * @returns {string[]}
 */
function parseCsvTags(str) {
  if (!str) return [];
  const trimmed = String(str).trim();
  if (trimmed.startsWith('[')) {
    const arr = safeParse(trimmed, null);
    if (Array.isArray(arr)) return arr.map(String);
  }
  return trimmed.split('|').map((s) => s.trim()).filter(Boolean);
}

/**
 * Convert one CSV row (object keyed by header) into a question payload.
 * @param {object} row
 * @returns {object}
 */
function csvRowToQuestion(row) {
  return {
    type: row.type || 'single',
    title: row.title || '',
    bodyMarkdown: row.bodyMarkdown || '',
    imageUrl: row.imageUrl || '',
    ruleLinkUrl: row.ruleLinkUrl || '',
    options: parseCsvOptions(row.options),
    answerText: row.answerText || '',
    answerRegex: row.answerRegex || '',
    explanationMarkdown: row.explanationMarkdown || '',
    weight: row.weight !== undefined && row.weight !== '' ? Number(row.weight) : 1,
    tags: parseCsvTags(row.tags),
    sort: row.sort !== undefined && row.sort !== '' ? Number(row.sort) : undefined,
  };
}

/**
 * Bulk-import questions. Skips invalid rows and collects errors.
 * @param {"json"|"csv"} format
 * @param {string|Array<object>} payload
 * @returns {Promise<{added:number, skipped:number, errors:Array<{row:number,message:string}>}>}
 */
async function importQuestions(format, payload) {
  const result = { added: 0, skipped: 0, errors: [] };
  let rows = [];

  if (format === 'json') {
    let arr = payload;
    if (typeof payload === 'string') {
      arr = safeParse(payload, null);
    }
    if (!Array.isArray(arr)) {
      result.errors.push({ row: 0, message: 'JSON payload must be an array of questions' });
      return result;
    }
    rows = arr;
  } else if (format === 'csv') {
    if (typeof payload !== 'string') {
      result.errors.push({ row: 0, message: 'CSV payload must be a string' });
      return result;
    }
    let parsed;
    try {
      parsed = csvParseSync.parse(payload, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e) {
      result.errors.push({ row: 0, message: 'CSV parse error: ' + e.message });
      return result;
    }
    rows = parsed.map(csvRowToQuestion);
  } else {
    result.errors.push({ row: 0, message: 'unsupported format: ' + format });
    return result;
  }

  for (let i = 0; i < rows.length; i += 1) {
    const q = rows[i];
    const err = validateQuestion(q);
    if (err) {
      result.skipped += 1;
      result.errors.push({ row: i + 1, message: err });
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await createQuestion(q);
      result.added += 1;
    } catch (e) {
      result.skipped += 1;
      result.errors.push({ row: i + 1, message: e.message || String(e) });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// user state
// ---------------------------------------------------------------------------

/**
 * Read a user's quiz state. Returns the default state when nothing is stored.
 * @param {number|string} uid
 * @returns {Promise<{status:string,attempts:number,lastAttemptAt:number,passedAt:number,gateAck:boolean}>}
 */
async function getUserState(uid) {
  if (uid === undefined || uid === null) return defaultUserState();
  // Read the entire hash rather than a fixed field list: the per-gate
  // counters and token expirations (postsCreated, postTokenExp, ...) are
  // written alongside the core fields and must round-trip through
  // `setUserState`.
  const hash = await db.getObject(KEYS.user(uid));
  return hydrateUserState(hash);
}

/**
 * Merge a partial state into a user's stored state and return the full state.
 * @param {number|string} uid
 * @param {object} partial
 * @returns {Promise<object>}
 */
async function setUserState(uid, partial) {
  const current = await getUserState(uid);
  const merged = { ...current, ...(partial || {}) };
  // Persist every field hydrateUserState expects so a round-trip through
  // `getUserState` returns identical values. gateAck is stored as 0/1 for
  // backend-agnostic boolean coercion.
  const toStore = {
    status: merged.status,
    attempts: merged.attempts,
    lastAttemptAt: merged.lastAttemptAt,
    passedAt: merged.passedAt,
    gateAck: merged.gateAck ? 1 : 0,
    postsCreated: merged.postsCreated || 0,
    topicsCreated: merged.topicsCreated || 0,
    postTokenExp: merged.postTokenExp || 0,
    topicTokenExp: merged.topicTokenExp || 0,
    returnTo: merged.returnTo || '',
    lastGateAt: merged.lastGateAt || 0,
    lastGateKind: merged.lastGateKind || '',
  };
  await db.setObject(KEYS.user(uid), toStore);
  return merged;
}

/**
 * Wipe a user's quiz state (the per-user hash and their attempts index).
 * @param {number|string} uid
 * @returns {Promise<void>}
 */
async function resetUserState(uid) {
  if (uid === undefined || uid === null) return;
  await db.delete(KEYS.user(uid));
  await db.delete(KEYS.userAttempts(uid));
}

// ---------------------------------------------------------------------------
// attempts
// ---------------------------------------------------------------------------

/**
 * Begin a new attempt for `uid`. Creates the attempt hash and indexes it.
 * @param {number|string} uid
 * @returns {Promise<{aid:number,startedAt:number}>}
 */
async function startAttempt(uid) {
  const aid = await db.increment(KEYS.nextAid);
  const startedAt = Date.now();
  const record = {
    aid,
    uid: toInt(uid, 0),
    startedAt,
    finishedAt: 0,
    score: 0,
    total: 0,
    passed: 0,
    answersJson: '',
  };
  await db.setObject(KEYS.attempt(aid), record);
  await db.sortedSetAdd(KEYS.userAttempts(uid), startedAt, aid);
  return { aid, startedAt };
}

/**
 * Finalize an attempt. Updates the hash, bumps fail stats for wrong questions
 * (when the attempt did not pass), and updates the daily aggregate.
 *
 * `answers` is a list of `{ qid, correct, given }` per-question records as
 * produced by `lib/policy.scoreAttempt`.
 *
 * `mode` (optional, default 'onboarding') selects which per-gate stats bucket
 * to bump — one of 'onboarding' | 'post' | 'topic'.
 *
 * @param {number|string} aid
 * @param {{ answers: Array<{qid:number,correct:boolean,given:*}>, score:number, total:number, passed:boolean, mode?:string }} payload
 * @returns {Promise<object|null>} the updated attempt record, or null if unknown
 */
async function finishAttempt(aid, payload) {
  if (aid === undefined || aid === null) return null;
  const existing = await db.getObject(KEYS.attempt(aid));
  if (!existing || Object.keys(existing).length === 0) return null;

  const settings = await getSettings();
  const finishedAt = Date.now();
  const passed = !!(payload && payload.passed);
  const answers = Array.isArray(payload && payload.answers) ? payload.answers : [];
  const score = payload && Number.isFinite(payload.score) ? payload.score : 0;
  const total = payload && Number.isFinite(payload.total) ? payload.total : 0;
  const rawMode = payload && payload.mode;
  const mode = (rawMode === 'post' || rawMode === 'topic') ? rawMode : 'onboarding';

  const update = {
    finishedAt,
    score,
    total,
    passed: passed ? 1 : 0,
    mode,
  };
  if (settings.logFullAnswers) {
    update.answersJson = JSON.stringify(answers);
  }
  await db.setObject(KEYS.attempt(aid), update);

  // bump fail stats for each wrong answer when not passed
  if (!passed) {
    for (let i = 0; i < answers.length; i += 1) {
      const a = answers[i];
      if (a && a.correct === false && a.qid !== undefined && a.qid !== null) {
        // eslint-disable-next-line no-await-in-loop
        await incFailStat(a.qid);
      }
    }
  }

  // daily aggregate (read-modify-write the hash field)
  const dateKey = ymd(finishedAt);
  const rawDay = await db.getObjectField(KEYS.statsDaily, dateKey);
  const day = safeParse(rawDay, { passed: 0, failed: 0 });
  if (passed) {
    day.passed = (day.passed || 0) + 1;
  } else {
    day.failed = (day.failed || 0) + 1;
  }
  await db.setObjectField(KEYS.statsDaily, dateKey, JSON.stringify(day));

  // per-gate aggregate (onboarding / post / topic). Stored as separate hash
  // keys so `getStats` can break the totals out per gate.
  try {
    const gateKey = KEYS.statsGate(mode);
    const field = passed ? 'passed' : 'failed';
    if (typeof db.incrObjectField === 'function') {
      await db.incrObjectField(gateKey, field);
    } else {
      const cur = await db.getObjectField(gateKey, field);
      const n = toInt(cur, 0) + 1;
      await db.setObjectField(gateKey, field, n);
    }
  } catch (_) { /* non-fatal */ }

  const merged = { ...existing, ...update };
  return hydrateAttempt(merged);
}

/**
 * List a user's attempts, newest first.
 * @param {number|string} uid
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<object>>}
 */
async function listUserAttempts(uid, opts) {
  if (uid === undefined || uid === null) return [];
  const limit = opts && Number.isFinite(opts.limit) ? opts.limit : 50;
  const stop = limit > 0 ? limit - 1 : -1;
  const ids = await db.getSortedSetRevRange(KEYS.userAttempts(uid), 0, stop);
  if (!ids || ids.length === 0) return [];
  const keys = ids.map((aid) => KEYS.attempt(aid));
  const hashes = await getObjectsBulk(keys);
  return hashes.map(hydrateAttempt).filter((a) => a !== null);
}

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------

/**
 * Increment the fail counter for a question.
 * @param {number|string} qid
 * @returns {Promise<void>}
 */
async function incFailStat(qid) {
  if (qid === undefined || qid === null) return;
  await db.sortedSetIncrBy(KEYS.statsQuestionFails, 1, qid);
}

/**
 * Aggregate stats for a date window. `from` / `to` are inclusive YYYY-MM-DD
 * strings or millis. Both are optional; missing bounds mean unbounded.
 *
 * `byGate` gives the per-gate pass/fail counts sourced from the per-gate
 * stat hashes (all-time — not date-filtered).
 *
 * @param {{ from?: string|number, to?: string|number }} [range]
 * @returns {Promise<{
 *   totals: { passed:number, failed:number },
 *   byGate: { onboarding:{p:number,f:number}, post:{p:number,f:number}, topic:{p:number,f:number} },
 *   hardestQuestions: Array<{ qid:number, fails:number }>,
 *   daily: Array<{ date:string, passed:number, failed:number }>
 * }>}
 */
async function getStats(range) {
  const from = range && range.from !== undefined ? toDateKey(range.from) : null;
  const to = range && range.to !== undefined ? toDateKey(range.to) : null;

  const allDays = await db.getObject(KEYS.statsDaily);
  const daily = [];
  let totalPassed = 0;
  let totalFailed = 0;

  if (allDays && typeof allDays === 'object') {
    const dates = Object.keys(allDays).sort();
    for (let i = 0; i < dates.length; i += 1) {
      const date = dates[i];
      if (from && date < from) continue;
      if (to && date > to) continue;
      const entry = safeParse(allDays[date], { passed: 0, failed: 0 });
      const passed = toInt(entry.passed, 0);
      const failed = toInt(entry.failed, 0);
      totalPassed += passed;
      totalFailed += failed;
      daily.push({ date, passed, failed });
    }
  }

  let hardestQuestions = [];
  const top = await db.getSortedSetRevRangeWithScores(
    KEYS.statsQuestionFails,
    0,
    9
  );
  if (Array.isArray(top)) {
    hardestQuestions = top.map((row) => ({
      qid: toInt(row.value, 0),
      fails: toInt(row.score, 0),
    }));
  }

  // Per-gate all-time totals. We don't date-filter these since the per-gate
  // hash only stores running counters; daily breakdown remains in `daily`.
  const gates = ['onboarding', 'post', 'topic'];
  const byGate = {};
  for (let i = 0; i < gates.length; i += 1) {
    const g = gates[i];
    // eslint-disable-next-line no-await-in-loop
    const h = await db.getObject(KEYS.statsGate(g));
    byGate[g] = {
      p: toInt(h && h.passed, 0),
      f: toInt(h && h.failed, 0),
    };
  }

  return {
    totals: { passed: totalPassed, failed: totalFailed },
    byGate,
    hardestQuestions,
    daily,
  };
}

/**
 * Coerce a date input to a YYYY-MM-DD key.
 * @param {string|number} v
 * @returns {string|null}
 */
function toDateKey(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return ymd(v);
  if (v instanceof Date) return ymd(v.getTime());
  return null;
}

// ---------------------------------------------------------------------------
// exports
// ---------------------------------------------------------------------------

module.exports = {
  // settings
  getSettings,
  setSettings,
  resetSettings,
  // questions
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  importQuestions,
  // user state
  getUserState,
  setUserState,
  resetUserState,
  // attempts
  startAttempt,
  finishAttempt,
  listUserAttempts,
  // stats
  incFailStat,
  getStats,
};
