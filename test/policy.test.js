'use strict';

/**
 * Unit tests for lib/policy.js — pure logic, no NodeBB internals required.
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

// --- canAttempt ------------------------------------------------------------
test('canAttempt: locked status blocks', () => {
  const r = policy.canAttempt({ status: 'locked' }, { onFail: {} }, Date.now());
  assert.strictEqual(r.allowed, false);
});
test('canAttempt: fresh user allowed', () => {
  const r = policy.canAttempt({ status: 'pending', attempts: 0 }, { onFail: { mode: 'retry' } }, Date.now());
  assert.strictEqual(r.allowed, true);
});

// eslint-disable-next-line no-console
console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
