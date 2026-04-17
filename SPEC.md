# nodebb-plugin-rules-quiz — Interface Contract

This file defines the contracts that every module must obey.
**All agents working on this plugin must read this file first.**

---

## 1. Plugin overview

A NodeBB plugin that gates users behind a configurable forum-rules quiz.
Compatible with NodeBB 2.x / 3.x / 4.x.

Pipeline for a gated user:
1. User logs in / registers.
2. On every page request, middleware checks `quizStatus(uid)`.
3. If `needsQuiz` and request path is not exempt → redirect to `/quiz`.
4. Quiz page shows: rules summary + "I've read the rules" gate → intro screen → questions.
5. On submit: server scores → pass/fail → updates user status → optional group add → notification.

---

## 2. DB key namespace (NodeBB DB API)

Use `require.main.require('./src/database')` as `db`. All keys are prefixed `plugin:rulesquiz:`.

| Key | Type | Description |
|---|---|---|
| `plugin:rulesquiz:settings` | hash (object) | global settings (see §3) |
| `plugin:rulesquiz:questions` | sorted set | all question IDs by sort order |
| `plugin:rulesquiz:question:<qid>` | hash | one question (see §4) |
| `plugin:rulesquiz:nextQid` | counter | auto-incrementing question ID |
| `plugin:rulesquiz:user:<uid>` | hash | per-user state: `{ status, attempts, lastAttemptAt, passedAt, gateAck }` |
| `plugin:rulesquiz:user:<uid>:attempts` | sorted set | attempt IDs by timestamp |
| `plugin:rulesquiz:attempt:<aid>` | hash | one attempt: `{ uid, startedAt, finishedAt, score, total, passed, answersJson }` |
| `plugin:rulesquiz:nextAid` | counter | auto-incrementing attempt ID |
| `plugin:rulesquiz:stats:questionFails` | sorted set | qid → fail count (for "hardest questions" report) |
| `plugin:rulesquiz:stats:daily` | hash | `YYYY-MM-DD` → JSON `{ passed, failed }` |

User status values: `"pending"` | `"in_progress"` | `"passed"` | `"failed_cooldown"` | `"locked"` | `"exempt"`.

---

## 3. Settings shape (admin-configurable)

Default settings written by the plugin on first load if absent.

```json
{
  "enabled": true,
  "appliesTo": {
    "newUsers": true,
    "existingUsers": false,
    "groups": [],
    "minReputation": null,
    "joinedAfter": null,
    "joinedBefore": null
  },
  "exemptGroups": ["administrators", "Global Moderators"],
  "exemptPaths": ["/login", "/register", "/quiz", "/api/quiz", "/assets", "/plugins/nodebb-plugin-rules-quiz", "/uploads"],
  "rules": {
    "showRulesGate": true,
    "rulesUrl": "/topic/5489",
    "rulesText": "",
    "ackButtonText": "I have read and understood the rules"
  },
  "intro": {
    "show": true,
    "markdown": "## Welcome\nBefore you can post, please complete this short quiz."
  },
  "quiz": {
    "sampleSize": 0,
    "shuffleQuestions": true,
    "shuffleAnswers": true,
    "passMode": "percent",
    "passPercent": 80,
    "passMinCorrect": 0,
    "timeLimitSec": 0
  },
  "onFail": {
    "mode": "retry",
    "cooldownSec": 300,
    "maxAttemptsPerDay": 0,
    "lockAfterAttempts": 0
  },
  "onSuccess": {
    "addToGroup": "",
    "notify": true,
    "redirectTo": "/"
  },
  "onRefuse": {
    "mode": "block_write"
  },
  "blockMode": "block_write",
  "notifyAdminOnFails": 3,
  "logFullAnswers": true
}
```

`blockMode` values: `"modal_soft"` | `"block_write"` | `"block_all"`.
`onFail.mode`: `"retry"` | `"cooldown"` | `"lock_after_attempts"` | `"daily_limit"`.
`onRefuse.mode`: `"block_write"` | `"banner_only"` | `"block_all"`.
`passMode`: `"all"` | `"percent"` | `"min_correct"`.

---

## 4. Question shape

```json
{
  "qid": 1,
  "type": "single",
  "title": "What is allowed in the off-topic forum?",
  "bodyMarkdown": "Optional **markdown** body with rule reference.",
  "imageUrl": "",
  "ruleLinkUrl": "/topic/5489#rule-3",
  "options": [
    { "id": "a", "text": "Anything",       "correct": false },
    { "id": "b", "text": "On-topic only",   "correct": false },
    { "id": "c", "text": "Per category rules", "correct": true }
  ],
  "answerText": "",
  "answerRegex": "",
  "explanationMarkdown": "Per the rules thread, each category has its own scope.",
  "weight": 1,
  "tags": ["off-topic"],
  "sort": 100,
  "createdAt": 1713312000000,
  "updatedAt": 1713312000000
}
```

`type` values: `"single"` | `"multi"` | `"truefalse"` | `"freetext"`.
For `truefalse`: options are exactly `[{id:"true",text:"True",correct:bool},{id:"false",text:"False",correct:bool}]`.
For `freetext`: `answerText` is the canonical answer; `answerRegex` (optional) overrides.

---

## 5. Module API contracts

### `lib/db.js` exports
```
async getSettings()                          → object
async setSettings(partial)                   → object (full merged)
async resetSettings()                        → object (defaults)

async listQuestions({limit, offset})         → Question[]
async getQuestion(qid)                       → Question | null
async createQuestion(data)                   → Question
async updateQuestion(qid, data)              → Question
async deleteQuestion(qid)                    → void
async importQuestions(format, payload)       → { added, skipped, errors[] }   // format: "json"|"csv"

async getUserState(uid)                      → { status, attempts, lastAttemptAt, passedAt, gateAck }
async setUserState(uid, partial)             → object (full)
async resetUserState(uid)                    → void

async startAttempt(uid)                      → { aid, startedAt }
async finishAttempt(aid, { answers, score, total, passed }) → Attempt
async listUserAttempts(uid, {limit})         → Attempt[]

async incFailStat(qid)                       → void
async getStats({from, to})                   → { totals:{passed,failed}, hardestQuestions:[{qid,fails}], daily:[{date,passed,failed}] }
```

### `lib/policy.js` exports (pure logic, no DB writes)
```
needsQuiz(user, userState, settings)         → boolean
isExempt(user, settings)                     → boolean
isPathExempt(path, settings)                 → boolean
pickQuestionsForAttempt(allQuestions, settings) → Question[]
scoreAttempt(questions, answers, settings)   → { score, total, passed, perQuestion: [{qid, correct, given}] }
canAttempt(userState, settings, now=Date.now()) → { allowed: boolean, reasonCode?: string, retryAfterMs?: number }
applyOutcome(userState, scored, settings)    → newUserState           // computes status/cooldown
```

### `lib/controllers.js` exports
```
async renderQuizPage(req, res)               // GET /quiz — renders rules→intro→quiz
async getQuizData(req, res)                  // GET /api/v3/plugins/rules-quiz/quiz — JSON
async ackRules(req, res)                     // POST /api/v3/plugins/rules-quiz/ack
async submitQuiz(req, res)                   // POST /api/v3/plugins/rules-quiz/submit
async getAdminPage(req, res)                 // GET /admin/plugins/rules-quiz
async adminListQuestions(req, res)           // GET /api/v3/plugins/rules-quiz/admin/questions
async adminCreateQuestion(req, res)          // POST .../questions
async adminUpdateQuestion(req, res)          // PUT  .../questions/:qid
async adminDeleteQuestion(req, res)          // DELETE .../questions/:qid
async adminImportQuestions(req, res)         // POST .../questions/import
async adminGetSettings(req, res)             // GET .../settings
async adminSaveSettings(req, res)            // PUT .../settings
async adminGetStats(req, res)                // GET .../stats
async adminGetUserAttempts(req, res)         // GET .../users/:uid/attempts
```

All admin endpoints require `req.user.uid` and `isAdmin` check (use `require.main.require('./src/user').isAdministrator`).

### `lib/routes.js` exports
```
function setup(params)   // params = { router, middleware, helpers } from static:api.routes
                         //          OR { app, router, middleware } from static:app.load
```

Mounts page routes via `helpers.setupPageRoute` and API routes via `helpers.setupApiRoute`.
Admin page via `helpers.setupAdminPageRoute`.

### `lib/notify.js` exports
```
async notifyUserPassed(uid)
async notifyAdminsRepeatedFails(uid, attemptCount)
async addUserToSuccessGroup(uid, groupName)
```

---

## 6. Template names (Benchpress `.tpl` in `static/templates/`)

- `quiz/index.tpl` — main quiz page (rules + intro + questions)
- `quiz/result.tpl` — result page after submit
- `admin/plugins/rules-quiz.tpl` — ACP page

Template data passed by controllers always includes `{ rtl, lang, settings }` plus page-specific fields.

---

## 7. Client-side modules

- `static/lib/quiz.js` — RequireJS module exporting `init(data)`. Mounts the quiz UI on `#rulesquiz-app`. Handles rules-ack → intro → question rendering → submit → result. Reads `data.template` (the controller picks layout). Does NOT do scoring (server only).
- `static/lib/admin.js` — RequireJS module exporting `init()`. Mounts ACP tabs: settings / questions / reports.

Both modules `require(['benchpress', 'translator', 'alerts'])` from NodeBB core.

---

## 8. i18n

Two locales mandatory: `en-GB` and `he`.
Namespace: `rulesquiz` → file `languages/<lang>/rulesquiz.json`.
Reference keys in templates and server strings as `[[rulesquiz:somekey]]`.

Hebrew is RTL — the `quiz/index.tpl` must add `dir="rtl"` when `rtl: true`.

Required keys (same set in both locales):
`title`, `subtitle`, `start`, `next`, `prev`, `submit`, `pass`, `fail`,
`rules.heading`, `rules.ack_btn`, `intro.heading`, `result.passed`, `result.failed`,
`error.cooldown`, `error.locked`, `error.daily_limit`,
`admin.settings`, `admin.questions`, `admin.reports`, `admin.save`,
`admin.add_question`, `admin.import`, `admin.export`,
`admin.stat.passed`, `admin.stat.failed`, `admin.stat.hardest`.

---

## 9. NodeBB version compat notes

- All required hooks (`response:router.page`, `action:user.create`, `action:user.loggedIn`, `filter:post.create`, `filter:topic.create`, `static:app.load`, `static:api.routes`, `filter:admin.header.build`) are stable from 2.x → 4.x.
- Use `require.main.require(...)` for all NodeBB internals.
- Avoid `app.use(...)` (not exposed); always use the helpers from `./src/routes/helpers`.
- For Postgres, never reuse a key for two types (e.g. don't `setObject` and `sortedSetAdd` on the same key).

---

## 10. File ownership matrix (for parallel work)

| Owner | Files |
|---|---|
| **Core** (manual) | `library.js`, `package.json`, `plugin.json`, `SPEC.md`, `lib/policy.js`, `lib/notify.js` |
| **Agent A: DB** | `lib/db.js`, `lib/defaults.js` |
| **Agent B: Routes/controllers** | `lib/controllers.js`, `lib/routes.js`, `lib/util.js` |
| **Agent C: ACP** | `static/templates/admin/plugins/rules-quiz.tpl`, `static/lib/admin.js`, `static/style/admin.less` |
| **Agent D: User UI** | `static/templates/quiz/index.tpl`, `static/templates/quiz/result.tpl`, `static/lib/quiz.js`, `static/style/quiz.less` |
| **Agent E: i18n + docs** | `languages/en-GB/rulesquiz.json`, `languages/he/rulesquiz.json`, `README.md`, `LICENSE` |

No agent may touch files outside its row.
