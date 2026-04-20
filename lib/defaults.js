'use strict';

/**
 * Default settings and DB key builders for nodebb-plugin-rules-quiz.
 *
 * Mirrors SPEC §2 (key namespace) and SPEC §3 (settings shape).
 */

const NS = 'plugin:rulesquiz';

/**
 * Default plugin settings written on first load if missing.
 * Exact shape per SPEC §3.
 * @type {object}
 */
const defaultSettings = {
  enabled: true,
  appliesTo: {
    newUsers: true,
    existingUsers: false,
    groups: [],
    minReputation: null,
    joinedAfter: null,
    joinedBefore: null,
  },
  exemptGroups: ['administrators', 'Global Moderators'],
  exemptPaths: [
    '/login',
    '/register',
    '/quiz',
    '/api/quiz',
    '/assets',
    '/plugins/nodebb-plugin-rules-quiz',
    '/uploads',
  ],
  rules: {
    showRulesGate: true,
    rulesUrl: '/topic/5489',
    rulesText: '',
    ackButtonText: 'I have read and understood the rules',
  },
  intro: {
    show: true,
    markdown: '## Welcome\nBefore you can post, please complete this short quiz.',
  },
  quiz: {
    sampleSize: 8,
    shuffleQuestions: true,
    shuffleAnswers: true,
    passMode: 'percent',
    passPercent: 80,
    passMinCorrect: 0,
    timeLimitSec: 0,
  },
  onFail: {
    mode: 'retry',
    cooldownSec: 300,
    maxAttemptsPerDay: 0,
    lockAfterAttempts: 0,
  },
  onSuccess: {
    addToGroup: '',
    notify: true,
    redirectTo: '/',
  },
  onRefuse: {
    mode: 'block_write',
  },
  blockMode: 'block_write',
  notifyAdminOnFails: 3,
  logFullAnswers: true,

  // Per-post gate: require a mini-quiz before each of the first N replies.
  // Set `applyForFirstN` = 0 to disable.
  // `cooldownSec`, `onFailMode`, `lockAfterAttempts` override the top-level
  // `onFail.*` fields when a post-gate attempt is evaluated.
  postGate: {
    enabled: true,
    applyForFirstN: 10,
    sampleSize: 4,
    passPercent: 80,
    cooldownSec: 300,
    onFailMode: 'retry',
    lockAfterAttempts: 0,
  },

  // Per-topic gate: require a longer quiz before each of the first N new
  // topics. Set `applyForFirstN` = 0 to disable.
  // `cooldownSec`, `onFailMode`, `lockAfterAttempts` override the top-level
  // `onFail.*` fields when a topic-gate attempt is evaluated.
  topicGate: {
    enabled: true,
    applyForFirstN: 5,
    sampleSize: 10,
    passPercent: 80,
    cooldownSec: 600,
    onFailMode: 'retry',
    lockAfterAttempts: 0,
  },

  // Question pool selection strategy.
  //   - 'single_tagged': a single shared pool filtered by tag at runtime.
  //     Each gate picks only questions tagged with the matching `*Tag` field.
  //     If a gate's tag matches zero questions, falls back to the full pool
  //     so a fresh install (with untagged seed questions) still works.
  //   - 'separate':    (future) a strictly separate pool per gate, no fallback.
  pool: {
    mode: 'single_tagged',
    onboardingTag: 'onboarding',
    postTag: 'post',
    topicTag: 'topic',
  },
};

/**
 * Frozen map of DB key builders. Covers every key from SPEC §2.
 * Static keys are strings; per-id keys are functions.
 * @type {Readonly<{
 *   settings: string,
 *   questions: string,
 *   question: (qid: number|string) => string,
 *   nextQid: string,
 *   user: (uid: number|string) => string,
 *   userAttempts: (uid: number|string) => string,
 *   attempt: (aid: number|string) => string,
 *   nextAid: string,
 *   statsQuestionFails: string,
 *   statsDaily: string,
 * }>}
 */
const KEYS = Object.freeze({
  settings: NS + ':settings',
  questions: NS + ':questions',
  question: (qid) => NS + ':question:' + qid,
  nextQid: NS + ':nextQid',
  user: (uid) => NS + ':user:' + uid,
  userAttempts: (uid) => NS + ':user:' + uid + ':attempts',
  attempt: (aid) => NS + ':attempt:' + aid,
  nextAid: NS + ':nextAid',
  statsQuestionFails: NS + ':stats:questionFails',
  statsDaily: NS + ':stats:daily',
  statsGate: (gate) => NS + ':stats:' + gate, // gate: 'onboarding' | 'post' | 'topic'
});

module.exports = { defaultSettings, KEYS };
