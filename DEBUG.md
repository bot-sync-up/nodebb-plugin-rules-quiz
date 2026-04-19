# Diagnosis — why the plugin doesn't work on the real forum

**Status: v0.1.2 installed on production (NodeBB 4.10.3, Redis, /opt/nodebb).**

The user reports: "הכל לא עובד שם". Their `/quiz` page renders only an empty quiz screen with `prev`/`next` buttons — no rules, no intro, no questions. And nothing is clickable.

## What we verified against the live server (Redis, key `plugin:rulesquiz:*`)

1. `redis-cli exists plugin:rulesquiz:settings` → **0** (the key doesn't exist)
2. `redis-cli type plugin:rulesquiz:settings` → **none**
3. `redis-cli zcard plugin:rulesquiz:questions` → **0**
4. `redis-cli get plugin:rulesquiz:nextQid` → empty
5. No `plugin:rulesquiz:user:*` keys exist.
6. `nodebb-plugin-rules-quiz@0.1.2` is installed and enabled.
7. NodeBB logs show `[rules-quiz] routes mounted` — plugin init ran. No runtime errors from us.

## Conclusion: nothing we've tried to persist has actually hit the database.

Earlier screenshots showed the user's `rulesUrl` was `/topic/4` (they'd changed it from the default `/topic/5489` via the ACP). That implies the admin UI at least did **something** — but the setting never made it to Redis.

## Primary hypotheses

### H1: The ACP save round-trip is broken.
`static/lib/admin.js` wires a `PUT /api/v3/plugins/rules-quiz/admin/settings` request. The Agent B controller `adminSaveSettings` is supposed to hand the body to `db.setSettings(partial)` which calls `db.setObjectField('plugin:rulesquiz:settings', 'value', JSON.stringify(merged))`. Any break anywhere in that chain = Redis stays empty.

Check list:
- Is the PUT body actually the settings object (vs wrapped in `{ settings: {...} }`)?
- Does `adminSaveSettings` accept what admin.js sends? (JSON shape mismatch is the most likely bug.)
- Does NodeBB's router strip PUT bodies without a matching body parser?
- Is CSRF rejecting the request silently (302 to login)?
- Is the admin gate (`util.requireAdmin`) matching — `req.uid` + `user.isAdministrator` on NodeBB 4?

### H2: The admin UI saves to the wrong store.
admin.js imports NodeBB's `Settings` helper. If any code path actually called `Settings.save('rules-quiz', ...)` instead of our `PUT`, the data would live under NodeBB's `settings:rules-quiz` hash, not our `plugin:rulesquiz:settings`. Agent C said it deliberately used the manual fetch+PUT approach, but double-check.

### H3: Question IDs are never minted, because `createQuestion` fails before `zadd`.
If the POST fails at validation or some missing field, questions silently don't get created. The admin UI probably swallows the error.

### H4: Rules-screen never shows because `gateAck` leaks across sessions or `showRulesGate` defaults are wrong.
SPEC defaults: `rules.showRulesGate: true`, `intro.show: true`. If the client receives these, `decideInitialScreen()` should route to the rules screen first. The user's screenshot shows the quiz screen directly — meaning either the defaults aren't making it to the client, or `gateAck` is somehow true.

### H5: Benchpress `{settings:json}` filter output is broken.
The user-facing template embeds bootstrap state as `{settings:json}`. If this filter doesn't exist in this NodeBB version, the bootstrap JSON is malformed and `JSON.parse` in `quiz.js` falls back to `{}`, meaning settings object is empty on the client — so `decideInitialScreen()` goes straight to the quiz screen.

**This is the most likely root cause for the "wrong screen shows" symptom.** Need to either:
- Pre-stringify in the controller and emit as `{bootstrapJson|safe}`.
- OR use the `@value` Benchpress convention.
- OR stop relying on bootstrap JSON and fetch state from the API instead.

## Files to review
- `library.js` — hook registrations, gating
- `lib/controllers.js` — `buildQuizPayload`, `adminSaveSettings`, `adminCreateQuestion`
- `lib/routes.js` — verify PUT/POST mount correctly
- `lib/db.js` — `getSettings`/`setSettings`/`createQuestion` implementations
- `lib/policy.js` — `needsQuiz`, `pickQuestionsForAttempt`
- `static/templates/quiz/index.tpl` — especially the bootstrap `<script type="application/json">`
- `static/lib/quiz.js` — `readBootstrap`, `decideInitialScreen`
- `static/lib/admin.js` — the PUT /admin/settings and POST /admin/questions flows
- `plugin.json` — hooks, modules, less, scripts registration

## Server info for live testing
- SSH: `root@64.176.170.219` pw `2Ho{X7Ze8=$V7t+v`
- NodeBB: `/opt/nodebb` (v4.10.3, Redis backend, port 4567)
- Restart: `cd /opt/nodebb && ./nodebb restart` (not managed by PM2)
- Build: `./nodebb build`
- Install: `npm install --no-audit --no-fund nodebb-plugin-rules-quiz@latest`
- Plugin lists: `./nodebb plugins`
- Redis CLI: `redis-cli` (default localhost, no auth)

## Target deliverable
A `v0.2.0` that:
1. Actually saves settings when admin clicks Save (verifiable: `redis-cli exists plugin:rulesquiz:settings` → 1).
2. Actually saves a question when admin adds one (`redis-cli zcard plugin:rulesquiz:questions` → 1+).
3. Ships with 5 default/seed questions so the quiz isn't empty on first activation.
4. Shows the rules screen first (unless user already acked) — not the quiz screen.
5. All clickable — the ack button sends the POST and advances.
