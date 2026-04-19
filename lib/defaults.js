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
});

module.exports = { defaultSettings, KEYS };
