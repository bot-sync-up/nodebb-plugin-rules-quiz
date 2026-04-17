# nodebb-plugin-rules-quiz

[![npm](https://img.shields.io/npm/v/nodebb-plugin-rules-quiz.svg)](https://www.npmjs.com/package/nodebb-plugin-rules-quiz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![NodeBB](https://img.shields.io/badge/NodeBB-2.x%20%7C%203.x%20%7C%204.x-blue.svg)](https://github.com/NodeBB/NodeBB)

A NodeBB plugin that gates new (and optionally existing) users behind a
configurable forum-rules quiz before they can post.

The goal: stop the constant flood of "I didn't know that was against the rules"
posts by *making* every account read the rules and answer a few short questions
before unlocking write access.

---

## Features

- **Multiple-choice rules quiz** with single-choice, multi-choice, true/false, and free-text questions.
- **Markdown + image support** in question bodies; optional explanation shown after each answer.
- **Per-question deep link** back to the relevant section of your rules thread.
- **Configurable gate scope:** new users by default, or also existing users filtered by group / reputation / join date.
- **Three block modes:** soft modal, block writing only, or block all access.
- **Pass criteria:** all-or-nothing, percentage threshold, or "X correct out of Y".
- **Failure handling:** retry, cooldown, daily limit, or lock after N attempts. Admin chooses.
- **On success:** auto-add the user to a group (e.g. `verified-rules`) + welcome notification.
- **Admin reports:** pass/fail counters, hardest questions, full attempt log per user, alerts when a user fails 3+ times.
- **i18n:** Hebrew (RTL) and English out of the box.
- **Bulk import** of questions via JSON or CSV.

## Compatibility

| | Status |
|---|---|
| NodeBB 2.x | ✅ tested |
| NodeBB 3.x | ✅ tested |
| NodeBB 4.x | ✅ tested |
| MongoDB | ✅ |
| Redis | ✅ |
| PostgreSQL | ✅ |

The plugin only uses NodeBB's database abstraction layer, so all three storage
backends are supported automatically.

## Installation

From your NodeBB root directory:

```bash
./nodebb install nodebb-plugin-rules-quiz
```

Then activate it via **ACP → Extend → Plugins** and restart NodeBB.

## Configuration

Open **ACP → Plugins → Rules Quiz**. Three tabs:

### Settings

| Section | What it controls |
|---|---|
| **General** | Master enable toggle, block mode, "notify admin after N failures", whether to log full answers |
| **Applies To** | Whether new users are gated, whether existing users are gated, target groups, min reputation, join-date window |
| **Exempt Groups / Paths** | Groups that always skip the quiz; URL prefixes that aren't gated |
| **Rules** | Whether to show a "read the rules first" gate, the URL of your rules thread, optional inline rules text, ack button label |
| **Intro** | Optional intro screen shown before the first question |
| **Quiz** | Sample size (0 = ask everything), shuffle questions/answers, pass mode, time limit |
| **On Fail** | Mode (`retry` / `cooldown` / `lock_after_attempts` / `daily_limit`), cooldown seconds, max attempts/day, lock threshold |
| **On Success** | Auto-add to group, send notification, post-pass redirect path |
| **On Refuse** | What happens if a user keeps refusing to take the quiz |

### Questions

Add, edit, delete, and bulk-import questions. The editor adapts to the question type (radio, checkbox, true/false, freetext).

### Reports

- Live counters: how many users passed/failed in the last 30 days.
- "Hardest questions": the top 10 questions by failure count.
- Per-user attempt history: enter a UID, see every attempt with timestamps, scores, and (if enabled) full answer logs.
- Daily chart of pass/fail trend.

## Importing questions

### JSON shape

```json
[
  {
    "type": "single",
    "title": "What is allowed in the off-topic forum?",
    "bodyMarkdown": "Optional **markdown** body.",
    "imageUrl": "",
    "ruleLinkUrl": "/topic/5489#rule-3",
    "options": [
      { "id": "a", "text": "Anything",          "correct": false },
      { "id": "b", "text": "On-topic only",     "correct": false },
      { "id": "c", "text": "Per category rules","correct": true }
    ],
    "explanationMarkdown": "Per the rules thread, each category has its own scope.",
    "weight": 1,
    "tags": ["off-topic"],
    "sort": 100
  }
]
```

`type` ∈ `single | multi | truefalse | freetext`.
For `freetext` add `answerText` (or `answerRegex`) and omit `options`.

### CSV shape

Columns:

```
type,title,bodyMarkdown,imageUrl,ruleLinkUrl,options,answerText,answerRegex,explanationMarkdown,weight,tags,sort
```

`options` encoded as semicolon-separated triples `id|text|correctBool`:

```
single,"What is allowed?",,,,"a|Anything|0;b|On-topic|1;c|Per category|0",,,"See rules.",1,off-topic,100
```

Tags accept JSON-array form (`["a","b"]`) or pipe-delimited (`a|b`).

## API

All endpoints under `/api/v3/plugins/rules-quiz`.

### User-facing

| Method | Path | Purpose |
|---|---|---|
| GET  | `/quiz` | JSON copy of the quiz page payload |
| POST | `/ack`  | User acknowledges they've read the rules |
| POST | `/submit` | Submit `{ answers: { qid: value } }` for scoring |

### Admin-facing (all require admin)

| Method | Path | Purpose |
|---|---|---|
| GET    | `/admin/questions` | List all questions |
| POST   | `/admin/questions` | Create a question |
| PUT    | `/admin/questions/:qid` | Update a question |
| DELETE | `/admin/questions/:qid` | Delete a question |
| POST   | `/admin/questions/import?format=json\|csv` | Bulk import |
| GET    | `/admin/settings` | Read settings |
| PUT    | `/admin/settings` | Save settings |
| GET    | `/admin/stats?from=…&to=…` | Aggregated stats |
| GET    | `/admin/users/:uid/attempts` | All attempts of a user |

## Architecture

```
                       ┌─────────────────────────────┐
  HTTP request   ──►   │ response:router.page hook   │
                       │      lib/library.js#gate    │
                       └──────────────┬──────────────┘
                                      │ needsQuiz?
                       ┌──────────────▼──────────────┐
                       │   lib/policy.js (pure)      │
                       └──────────────┬──────────────┘
                                      │ yes → redirect
                       ┌──────────────▼──────────────┐
                       │ /quiz   (controllers.js)    │
                       │   ▸ rules ack screen        │
                       │   ▸ intro screen            │
                       │   ▸ quiz screen             │
                       └──────────────┬──────────────┘
                                      │ POST /submit
                       ┌──────────────▼──────────────┐
                       │ score → applyOutcome →      │
                       │ db.finishAttempt → notify   │
                       └─────────────────────────────┘
```

## i18n

Two locales bundled: `en-GB` and `he` (with full RTL support). To add a language, drop a new file at `languages/<lang>/rulesquiz.json` with the same key set as `languages/en-GB/rulesquiz.json`.

## Development

```
nodebb-plugin-rules-quiz/
├─ library.js                 ← entry, hook handlers
├─ plugin.json                ← NodeBB manifest
├─ package.json
├─ SPEC.md                    ← interface contract for contributors
├─ lib/
│  ├─ db.js                   ← all DB CRUD
│  ├─ defaults.js             ← default settings + key namespace
│  ├─ policy.js               ← pure scoring/gating logic
│  ├─ controllers.js          ← HTTP controllers
│  ├─ routes.js               ← route registration
│  ├─ notify.js               ← notifications + group membership
│  └─ util.js                 ← admin gate, JSON helpers
├─ static/
│  ├─ templates/
│  │  ├─ quiz/index.tpl
│  │  ├─ quiz/result.tpl
│  │  └─ admin/plugins/rules-quiz.tpl
│  ├─ lib/
│  │  ├─ quiz.js              ← user UI client
│  │  └─ admin.js             ← ACP client
│  └─ style/
│     ├─ quiz.less
│     └─ admin.less
└─ languages/
   ├─ en-GB/rulesquiz.json
   └─ he/rulesquiz.json
```

To test locally:

```bash
cd /path/to/NodeBB
ln -s /path/to/nodebb-plugin-rules-quiz node_modules/nodebb-plugin-rules-quiz
./nodebb activate nodebb-plugin-rules-quiz
./nodebb dev
```

## License

[MIT](LICENSE) © 2026 bot-sync-up

---

## תיעוד בעברית

תוסף NodeBB שמכריח משתמשים חדשים (ובאופן אופציונלי גם משתמשים קיימים) לעבור שאלון אמריקאי קצר על חוקי הפורום לפני שהם יכולים לפרסם.

המטרה: למנוע את הזרם הקבוע של "לא ידעתי שזה נגד החוקים" — כל משתמש *חייב* לקרוא את החוקים ולענות נכון על כמה שאלות לפני שנפתחת לו ההרשאה לכתוב.

### יכולות עיקריות

- שאלון רב-ברירה: רדיו, צ'קבוקס, נכון/לא נכון, טקסט חופשי.
- תמיכה ב-Markdown ובתמונות בשאלות; הסבר אופציונלי אחרי כל תשובה.
- לינק ישיר לכל שאלה אל המקטע הרלוונטי באשכול החוקים.
- היקף הגיטינג גמיש: ברירת מחדל למשתמשים חדשים, אופציה גם למשתמשים קיימים לפי קבוצה / מוניטין / תאריך הצטרפות.
- שלושה מצבי חסימה: מודל רך, חסימת כתיבה בלבד, או חסימה מוחלטת.
- תנאי מעבר: הכל-או-לא-כלום, אחוז סף, או "X נכונות מתוך Y".
- טיפול בכישלון: ניסיון מיידי, cooldown, מגבלה יומית, או נעילה אחרי N ניסיונות.
- בהצלחה: הוספה אוטומטית לקבוצה (למשל `verified-rules`) + הודעת ברוכים הבאים.
- דו"ח מנהל: מי עבר/נכשל, השאלות הקשות ביותר, היסטוריית ניסיונות מלאה לכל משתמש, התראות על 3+ כישלונות.
- תמיכה מלאה בעברית RTL.

### התקנה

מתיקיית הראשית של NodeBB:

```bash
./nodebb install nodebb-plugin-rules-quiz
```

ולאחר מכן הפעלה דרך **ACP → תוספים** ואתחול.

### הגדרה

הכל בעמוד `ACP → תוספים → Rules Quiz` — שלוש לשוניות: הגדרות, שאלות, דו"חות.

### תאימות

NodeBB 2.x / 3.x / 4.x. עובד אוטומטית עם MongoDB, Redis, או PostgreSQL.

### רישוי

[MIT](LICENSE) — ראו קובץ הרישוי.
