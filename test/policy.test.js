'use strict';

/**
 * Unit tests — pure logic and template checks, no NodeBB internals required.
 * Run with: npm test   (plain `node test/policy.test.js`, works on Node 14+).
 *
 * A tiny zero-dependency assert harness so this runs anywhere without a
 * test framework install.
 */

const assert = require('assert');
const policy = require('../lib/policy');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    // eslint-disable-next-line no-console
    console.log('  ok   ' + name);
  } catch (e) {
    failed += 1;
    // eslint-disable-next-line no-console
    console.error('  FAIL ' + name + '\n         ' + (e && e.message));
  }
}

// --- isExempt --------------------------------------------------------------
test('isExempt: admin group is exempt', () => {
  const settings = { exemptGroups: ['administrators'] };
  assert.strictEqual(policy.isExempt({ groups: ['administrators'] }, settings), true);
});
test('isExempt: non-listed group is not exempt', () => {
  const settings = { exemptGroups: ['administrators'] };
  assert.strictEqual(policy.isExempt({ groups: ['registered-users'] }, settings), false);
});
test('isExempt: reputation threshold exempts', () => {
  const settings = { exemptGroups: [], exemptMinReputation: 50 };
  assert.strictEqual(policy.isExempt({ groups: [], reputation: 80 }, settings), true);
  assert.strictEqual(policy.isExempt({ groups: [], reputation: 20 }, settings), false);
});
test('isExempt: null reputation threshold disables it', () => {
  const settings = { exemptGroups: [], exemptMinReputation: null };
  assert.strictEqual(policy.isExempt({ groups: [], reputation: 9999 }, settings), false);
});

// --- isPathExempt ----------------------------------------------------------
test('isPathExempt: exact match', () => {
  const settings = { exemptPaths: ['/login'] };
  assert.strictEqual(policy.isPathExempt('/login', settings), true);
});
test('isPathExempt: proper segment prefix', () => {
  const settings = { exemptPaths: ['/api/quiz'] };
  assert.strictEqual(policy.isPathExempt('/api/quiz/submit', settings), true);
});
test('isPathExempt: substring is NOT exempt (the v0.7.8 fix)', () => {
  const settings = { exemptPaths: ['/login'] };
  assert.strictEqual(policy.isPathExempt('/login-help', settings), false);
  assert.strictEqual(policy.isPathExempt('/loginbypass', settings), false);
});

// --- scoreAttempt ----------------------------------------------------------
const singleQ = (qid, correctId) => ({
  qid, type: 'single', weight: 1,
  options: [{ id: 'a', correct: correctId === 'a' }, { id: 'b', correct: correctId === 'b' }],
});

test('scoreAttempt: all correct passes at 80%', () => {
  const qs = [singleQ(1, 'a'), singleQ(2, 'b')];
  const r = policy.scoreAttempt(qs, { 1: 'a', 2: 'b' }, { quiz: { passMode: 'percent', passPercent: 80 } });
  assert.strictEqual(r.score, 2);
  assert.strictEqual(r.total, 2);
  assert.strictEqual(r.passed, true);
});
test('scoreAttempt: half correct fails at 80%', () => {
  const qs = [singleQ(1, 'a'), singleQ(2, 'b')];
  const r = policy.scoreAttempt(qs, { 1: 'a', 2: 'a' }, { quiz: { passMode: 'percent', passPercent: 80 } });
  assert.strictEqual(r.score, 1);
  assert.strictEqual(r.passed, false);
});
test('scoreAttempt: empty questions does not pass percent mode', () => {
  const r = policy.scoreAttempt([], {}, { quiz: { passMode: 'percent', passPercent: 80 } });
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.passed, false);
});
test('scoreAttempt: weight=0 question not counted toward total', () => {
  const q0 = { qid: 1, type: 'single', weight: 0, options: [{ id: 'a', correct: true }] };
  const q1 = singleQ(2, 'a');
  const r = policy.scoreAttempt([q0, q1], { 1: 'a', 2: 'a' }, { quiz: { passMode: 'percent', passPercent: 80 } });
  assert.strictEqual(r.total, 1, 'weight-0 question excluded from total');
});
test('scoreAttempt: NaN weight treated as 1', () => {
  const q = { qid: 1, type: 'single', weight: 'abc', options: [{ id: 'a', correct: true }] };
  const r = policy.scoreAttempt([q], { 1: 'a' }, { quiz: { passMode: 'percent', passPercent: 80 } });
  assert.ok(Number.isFinite(r.total), 'total is finite');
  assert.strictEqual(r.total, 1);
});
test('scoreAttempt: freetext bad regex does not throw', () => {
  const q = { qid: 1, type: 'freetext', weight: 1, answerRegex: '([' };
  assert.doesNotThrow(() => {
    policy.scoreAttempt([q], { 1: 'x' }, { quiz: { passMode: 'percent', passPercent: 80 } });
  });
});

// --- needsQuiz install cutoff (v0.8.2) ------------------------------------
test('needsQuiz: existing user (joined before cutoff) NOT gated as new', () => {
  const settings = { enabled: true, activatedAt: 1000, appliesTo: { newUsers: true, existingUsers: false } };
  const user = { uid: 5, joindate: 500, groups: [] }; // joined before install
  assert.strictEqual(policy.needsQuiz(user, { status: 'pending' }, settings), false);
});
test('needsQuiz: new user (joined after cutoff) IS gated', () => {
  const settings = { enabled: true, activatedAt: 1000, appliesTo: { newUsers: true, existingUsers: false } };
  const user = { uid: 6, joindate: 2000, groups: [] }; // joined after install
  assert.strictEqual(policy.needsQuiz(user, { status: 'pending' }, settings), true);
});
test('needsQuiz: existingUsers:true gates everyone regardless of cutoff', () => {
  const settings = { enabled: true, activatedAt: 1000, appliesTo: { newUsers: true, existingUsers: true } };
  const user = { uid: 7, joindate: 500, groups: [] };
  assert.strictEqual(policy.needsQuiz(user, { status: 'pending' }, settings), true);
});
test('needsQuiz: passed user never gated', () => {
  const settings = { enabled: true, activatedAt: 1000, appliesTo: { newUsers: true, existingUsers: true } };
  const user = { uid: 8, joindate: 5000, groups: [] };
  assert.strictEqual(policy.needsQuiz(user, { status: 'passed' }, settings), false);
});

test('needsQuiz: a new user who failed under cooldown mode is still gated', () => {
  const settings = { enabled: true, activatedAt: 1000, appliesTo: { newUsers: true } };
  const user = { uid: 9, joindate: 2000, groups: [] };
  assert.strictEqual(policy.needsQuiz(user, { status: 'failed_cooldown' }, settings), true);
  assert.strictEqual(policy.needsQuiz(user, { status: 'locked' }, settings), true);
});

// --- evaluateWrite (v0.8.5): the single gate decision ---------------------
const GATES = {
  enabled: true, activatedAt: 1000, appliesTo: { newUsers: true, existingUsers: false },
  exemptGroups: ['administrators'],
  postGate: { enabled: true, applyForFirstN: 10 }, topicGate: { enabled: true, applyForFirstN: 5 },
};
const NOW = 5000;
const newbie = { uid: 20, joindate: 2000, groups: [], postcount: 3, topiccount: 1 };
const veteran = { uid: 21, joindate: 500, groups: [], postcount: 40, topiccount: 7 };

test('evaluateWrite: member who predates the plugin is not gated at all', () => {
  assert.strictEqual(policy.evaluateWrite('post', veteran, {}, GATES, NOW).reason, 'not-targeted');
  assert.strictEqual(policy.evaluateWrite('topic', veteran, {}, GATES, NOW).allowed, true);
});
test('evaluateWrite: new user who has not passed onboarding', () => {
  const v = policy.evaluateWrite('post', newbie, { status: 'pending' }, GATES, NOW);
  assert.deepStrictEqual(v, { allowed: false, reason: 'needs-onboarding' });
});
test('evaluateWrite: passed onboarding, no token → needs the mini-quiz', () => {
  const v = policy.evaluateWrite('post', newbie, { status: 'passed', postsCreated: 2 }, GATES, NOW);
  assert.deepStrictEqual(v, { allowed: false, reason: 'needs-quiz' });
});
test('evaluateWrite: an unused token allows the write', () => {
  const v = policy.evaluateWrite('post', newbie, { status: 'passed', postTokenExp: NOW + 1 }, GATES, NOW);
  assert.strictEqual(v.reason, 'token');
});
test('evaluateWrite: NodeBB rejected the last attempt (count unchanged) → retry allowed', () => {
  const s = { status: 'passed', postsCreated: 1, pendingKind: 'post', pendingAt: NOW - 1000, pendingCount: 3 };
  assert.strictEqual(policy.evaluateWrite('post', newbie, s, GATES, NOW).reason, 'retry');
});
test('evaluateWrite: last attempt succeeded (count moved) → needs a new quiz', () => {
  const s = { status: 'passed', postsCreated: 1, pendingKind: 'post', pendingAt: NOW - 1000, pendingCount: 2 };
  assert.strictEqual(policy.evaluateWrite('post', newbie, s, GATES, NOW).reason, 'needs-quiz');
});
test('evaluateWrite: retry allowance expires with the token lifetime', () => {
  const s = { status: 'passed', pendingKind: 'post', pendingAt: NOW - policy.TOKEN_TTL_MS - 1, pendingCount: 3 };
  assert.strictEqual(policy.evaluateWrite('post', newbie, s, GATES, NOW).reason, 'needs-quiz');
});
test('evaluateWrite: a pending reply does not unlock a new topic', () => {
  const s = { status: 'passed', pendingKind: 'post', pendingAt: NOW - 1000, pendingCount: 1 };
  assert.strictEqual(policy.evaluateWrite('topic', newbie, s, GATES, NOW).reason, 'needs-quiz');
});
test('evaluateWrite: admin-exempted user (status=exempt) is not gated', () => {
  assert.strictEqual(policy.evaluateWrite('post', newbie, { status: 'exempt' }, GATES, NOW).reason, 'exempt');
});
test('evaluateWrite: past the first-N window', () => {
  assert.strictEqual(policy.evaluateWrite('post', newbie, { status: 'passed', postsCreated: 10 }, GATES, NOW).reason, 'past-window');
});

// --- canAttempt ------------------------------------------------------------
test('canAttempt: locked status blocks', () => {
  const r = policy.canAttempt({ status: 'locked' }, { onFail: {} }, Date.now());
  assert.strictEqual(r.allowed, false);
});
test('canAttempt: fresh user allowed', () => {
  const r = policy.canAttempt({ status: 'pending', attempts: 0 }, { onFail: { mode: 'retry' } }, Date.now());
  assert.strictEqual(r.allowed, true);
});

// --- lib/lock.js: single-use token can't be double-spent (v0.8.4) ---------
const { withUserLock, activeLockCount } = require('../lib/lock');

const asyncTests = [];
function testAsync(name, fn) { asyncTests.push({ name, fn }); }

// A fake "consume the token" step with an await between read and write,
// like the real gate (read state from DB, then write the consumed token).
function makeGate(state) {
  return async function consume() {
    const hasToken = state.token > 0;
    await new Promise((r) => setTimeout(r, 5));
    if (!hasToken) return 'blocked';
    state.token = 0;
    state.posts += 1;
    return 'passed';
  };
}

testAsync('without the lock, two concurrent submits both spend one token (the bug)', async () => {
  const state = { token: 1, posts: 0 };
  const consume = makeGate(state);
  const results = await Promise.all([consume(), consume()]);
  assert.deepStrictEqual(results.sort(), ['passed', 'passed']);
});
testAsync('with withUserLock, only one of two concurrent submits passes', async () => {
  const state = { token: 1, posts: 0 };
  const consume = makeGate(state);
  const results = await Promise.all([withUserLock(7, consume), withUserLock(7, consume)]);
  assert.deepStrictEqual(results.sort(), ['blocked', 'passed']);
  assert.strictEqual(state.posts, 1);
});
testAsync('withUserLock does not serialise different users', async () => {
  const order = [];
  const slow = (tag, ms) => async () => { await new Promise((r) => setTimeout(r, ms)); order.push(tag); };
  await Promise.all([withUserLock(1, slow('a', 30)), withUserLock(2, slow('b', 5))]);
  assert.deepStrictEqual(order, ['b', 'a']);
});
testAsync('withUserLock releases the lock after an error', async () => {
  await assert.rejects(withUserLock(9, async () => { throw new Error('boom'); }));
  const r = await withUserLock(9, async () => 'next');
  assert.strictEqual(r, 'next');
  assert.strictEqual(activeLockCount(), 0);
});

// --- i18n + templates ---------------------------------------------------------
const fs = require('fs');
const path = require('path');
const i18n = require('../lib/i18n');

test('i18n.isRtl: Hebrew and Arabic are RTL, English is not', () => {
  assert.strictEqual(i18n.isRtl('he'), true);
  assert.strictEqual(i18n.isRtl('ar'), true);
  assert.strictEqual(i18n.isRtl('en-GB'), false);
});
test('i18n.sanitizeLang rejects path-like values', () => {
  assert.strictEqual(i18n.sanitizeLang('pt-BR'), 'pt-BR');
  assert.strictEqual(i18n.sanitizeLang('../../etc'), '');
  assert.strictEqual(i18n.sanitizeLang(undefined), '');
});

const TEMPLATES = ['quiz/index.tpl', 'admin/plugins/rules-quiz.tpl'];
const enStrings = require('../languages/en-GB/rulesquiz.json');
const heStrings = require('../languages/he/rulesquiz.json');
TEMPLATES.forEach((name) => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'static', 'templates', name), 'utf8');
  // NodeBB 4.16 no longer translates [[...]] tokens in rendered pages.
  test(name + ': no [[rulesquiz:...]] tokens (use {t.key})', () => {
    assert.deepStrictEqual(src.match(/\[\[rulesquiz:[^\]]+\]\]/g), null);
  });
  test(name + ': every {t.key} exists in both languages', () => {
    const keys = Object.keys(enStrings).map((k) => k.replace(/\./g, '_'));
    const heKeys = Object.keys(heStrings).map((k) => k.replace(/\./g, '_'));
    const missing = (src.match(/\{t\.([a-z0-9_]+)\}/gi) || [])
      .map((ref) => ref.slice(3, -1))
      .filter((k) => keys.indexOf(k) === -1 || heKeys.indexOf(k) === -1);
    assert.deepStrictEqual(missing, []);
  });
  // Benchpress reads `{display:none}` as a variable and drops the rule.
  test(name + ': every inline CSS block ends with ";"', () => {
    const css = (src.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
    const bad = (css.match(/\{[^{}]*\}/g) || []).filter((b) => !/;\s*\}$/.test(b) && !/^\{\s*\}$/.test(b));
    assert.deepStrictEqual(bad, []);
  });
});
test('quiz template outputs JSON and HTML raw ({{var}})', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'static', 'templates', 'quiz', 'index.tpl'), 'utf8');
  ['questionsJson', 'settingsJson', 'gateProgressJson', 'rulesHtml', 'introHtml'].forEach((v) => {
    assert.ok(src.indexOf('{{' + v + '}}') !== -1, v + ' must be output raw');
    assert.ok(!new RegExp('[^{]\\{' + v + '\\}[^}]').test(src), v + ' must not be output escaped');
  });
});
test('language files have the same keys', () => {
  assert.deepStrictEqual(Object.keys(heStrings).sort(), Object.keys(enStrings).sort());
});

(async () => {
  for (const t of asyncTests) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await t.fn();
      passed += 1;
      // eslint-disable-next-line no-console
      console.log('  ok   ' + t.name);
    } catch (e) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error('  FAIL ' + t.name + '\n         ' + (e && e.message));
    }
  }
  // eslint-disable-next-line no-console
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
