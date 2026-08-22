# Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add points, levels (with brand-mark buddy characters), and a forgiving streak to "You Got It!", all computed from the existing `attempts` table, plus a Progress page that serves as the rulebook.

**Architecture:** A pure engine (`lib/gamification.js`) derives points/level/streak/daily-history from a user's `attempts` rows — no new DB columns, no migration. One serverless endpoint (`GET /api/progress`) runs the engine for the signed-in user. Two front-end surfaces consume it: a panel on Your Desk and a new `progress.html` rulebook. A shared `characters.js` returns the buddy SVG per level.

**Tech Stack:** Node ESM, Drizzle + Neon HTTP driver (read-only here), Vercel serverless functions, `node:test` unit tests, vanilla JS + existing CSS design system.

**Spec:** `docs/specs/2026-08-22-gamification-design.md`

## Global Constraints

- **No new DB columns / no migration** — everything derives from existing `attempts` rows (`userId`, `taskId`, `checksPassed`, `total`, `passed`, `createdAt`).
- **Points economy (exact):** welcome `+20` (flat baseline), show-up `+10` (once/day), per green check `+5`, all-checks-clear bonus `+10`. Check + bonus score from the **first** submission of each task each day (once per task per day).
- **Levels (exact):** L1 Getting Going `0`, L2 Finding Your Feet `40`, L3 In the Flow `90`, L4 Sharp Eye `160`, L5 Safe Hands `250`, L6 Quietly Confident `360`. (Scaled to the current two-task catalog; raise as more tasks land.)
- **Streak:** consecutive active days ending today/yesterday, **one grace day absorbed**; unlocks at `activeDays >= 3`. Day-bucketing timezone = `Australia/Sydney`.
- **Characters:** reuse the exact buddy SVGs from the approved mockup — no new art.
- **Test runner:** `node:test`, files at `test/<name>.test.js`, run with `npm test` (or `node --test test/<file>`). No new dependencies.
- **Design tokens:** bone `#FCFCFA`, ink `#18181C`, yellow `#EFE84B`, muted `#5b5b63`; fonts Fraunces / Hanken Grotesk / IBM Plex Mono. No new fonts or colors.
- **Analytics:** add a `window.track(...)` event for every new user-facing behavior (standing project rule) and register it in `scripts/setup-plausible-goals.mjs`.
- **Do not push or deploy** — commit locally only; the user pushes.

---

### Task 1: Engine constants — `LEVELS`, `POINTS`, `dayKey`, `levelFor`

**Files:**
- Create: `lib/gamification.js`
- Test: `test/gamification.test.js`

**Interfaces:**
- Produces:
  - `POINTS = { welcome:20, showUp:10, perCheck:5, allPassBonus:10 }`
  - `LEVELS: Array<{ level:number, name:string, minPoints:number, feature:string }>`
  - `STREAK_UNLOCK_DAYS = 3`, `APP_TZ = "Australia/Sydney"`
  - `dayKey(date, tz?) -> "YYYY-MM-DD"` (date bucketed in `tz`, default `APP_TZ`)
  - `levelFor(points) -> { current: LevelObj, next: LevelObj | null }`

- [ ] **Step 1: Write the failing test**

```js
// test/gamification.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { POINTS, LEVELS, dayKey, levelFor, APP_TZ } from "../lib/gamification.js";

test("economy constants are exact", () => {
  assert.deepEqual(POINTS, { welcome: 20, showUp: 10, perCheck: 5, allPassBonus: 10 });
});

test("levels ladder is exact", () => {
  assert.deepEqual(LEVELS.map((l) => [l.level, l.name, l.minPoints]), [
    [1, "Getting Going", 0], [2, "Finding Your Feet", 40], [3, "In the Flow", 90],
    [4, "Sharp Eye", 160], [5, "Safe Hands", 250], [6, "Quietly Confident", 360],
  ]);
});

test("dayKey buckets in APP_TZ across a UTC midnight", () => {
  // 2026-03-01T13:30Z is 2026-03-02 00:30 in Sydney (AEDT, +11)
  assert.equal(dayKey("2026-03-01T13:30:00Z"), "2026-03-02");
  assert.equal(APP_TZ, "Australia/Sydney");
});

test("levelFor picks highest threshold <= points and the next", () => {
  assert.equal(levelFor(0).current.level, 1);
  assert.equal(levelFor(39).current.level, 1);
  assert.equal(levelFor(40).current.level, 2);   // exactly at threshold
  assert.equal(levelFor(40).next.minPoints, 90);
  assert.equal(levelFor(360).current.level, 6);
  assert.equal(levelFor(360).next, null);         // top level, no next
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/gamification.test.js`
Expected: FAIL — cannot import from `../lib/gamification.js` (module not found).

- [ ] **Step 3: Write minimal implementation**

```js
// lib/gamification.js
// Pure gamification engine — points, levels, streaks, daily history — all derived
// from a user's `attempts` rows. No DB, no I/O. Single source of truth for the rules.

export const POINTS = { welcome: 20, showUp: 10, perCheck: 5, allPassBonus: 10 };

export const LEVELS = [
  { level: 1, name: "Getting Going",     minPoints: 0,   feature: "buddy" },
  { level: 2, name: "Finding Your Feet", minPoints: 40,  feature: "antenna" },
  { level: 3, name: "In the Flow",       minPoints: 90,  feature: "headband" },
  { level: 4, name: "Sharp Eye",         minPoints: 160, feature: "glasses" },
  { level: 5, name: "Safe Hands",        minPoints: 250, feature: "mittens" },
  { level: 6, name: "Quietly Confident", minPoints: 360, feature: "crown" },
];

export const STREAK_UNLOCK_DAYS = 3;
export const APP_TZ = "Australia/Sydney";

// "YYYY-MM-DD" bucket for a date in APP_TZ (so "today"/streaks respect the beachhead TZ).
export function dayKey(date, tz = APP_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(date));
}

// Highest level whose threshold <= points, plus the next level (or null at the top).
export function levelFor(points) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (points >= l.minPoints) current = l;
  const next = LEVELS.find((l) => l.minPoints > points) || null;
  return { current, next };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/gamification.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/gamification.js test/gamification.test.js
git commit -m "feat(gamification): engine constants, dayKey, levelFor"
```

---

### Task 2: `computeState` — points, level, daily history (streak stubbed)

**Files:**
- Modify: `lib/gamification.js`
- Test: `test/gamification.test.js`

**Interfaces:**
- Consumes: `POINTS`, `LEVELS`, `dayKey`, `levelFor` (Task 1).
- Produces: `computeState(attempts=[], now=new Date()) -> { points, level, levelName, character, nextLevelAt, pointsIntoLevel, pointsToNext, activeDays, streak, streakUnlocked, daysToUnlock, dailyHistory }`
  where `dailyHistory: Array<{ date, points, tasksDone, checksPassed, passedAll }>` newest-first.
  Each attempt row shape: `{ taskId, checksPassed, passed, createdAt }`.
  (In this task `streak` is always `0`; Task 3 fills it in.)

- [ ] **Step 1: Write the failing test**

```js
// append to test/gamification.test.js
import { computeState } from "../lib/gamification.js";

const A = (createdAt, taskId, checksPassed, passed) => ({ createdAt, taskId, checksPassed, passed });

test("empty attempts → welcome-only state", () => {
  const s = computeState([], new Date("2026-08-22T02:00:00Z"));
  assert.equal(s.points, 20);
  assert.equal(s.level, 1);
  assert.equal(s.levelName, "Getting Going");
  assert.equal(s.character, "buddy");
  assert.equal(s.nextLevelAt, 60);
  assert.equal(s.streakUnlocked, false);
  assert.equal(s.daysToUnlock, 3);
  assert.deepEqual(s.dailyHistory, []);
});

test("one all-pass task: welcome + showup + 4 checks + bonus", () => {
  // 4/4 checks, passed → 20 + 10 + 4*5 + 10 = 60
  const s = computeState([A("2026-08-20T03:00:00Z", "recall", 4, true)]);
  assert.equal(s.points, 60);
  assert.equal(s.level, 2); // 60 hits Finding Your Feet
  assert.equal(s.dailyHistory[0].tasksDone, 1);
  assert.equal(s.dailyHistory[0].checksPassed, 4);
  assert.equal(s.dailyHistory[0].passedAll, true);
  assert.equal(s.dailyHistory[0].points, 40); // 10 + 20 + 10 (welcome not in day)
});

test("once-per-task-per-day: same-day retry does not re-pay", () => {
  // first submission 2/4 (fail), retry same day 4/4 (pass) — only the FIRST counts
  const day = [
    A("2026-08-20T03:00:00Z", "recall", 2, false),
    A("2026-08-20T05:00:00Z", "recall", 4, true),
  ];
  const s = computeState(day);
  // day points = showup 10 + first submission 2*5 + no bonus = 20; +welcome 20 = 40
  assert.equal(s.points, 40);
  assert.equal(s.dailyHistory[0].points, 20);
  assert.equal(s.dailyHistory[0].tasksDone, 1);
});

test("show-up counts once per day across two tasks", () => {
  const day = [
    A("2026-08-20T03:00:00Z", "recall", 4, true),
    A("2026-08-20T04:00:00Z", "complaint", 0, false),
  ];
  const s = computeState(day);
  // showup 10 (once) + recall(20+10) + complaint(0) = 40; +welcome = 60
  assert.equal(s.dailyHistory[0].points, 40);
  assert.equal(s.dailyHistory[0].tasksDone, 2);
  assert.equal(s.points, 60);
});

test("dailyHistory is newest-first across days", () => {
  const s = computeState([
    A("2026-08-18T03:00:00Z", "recall", 1, false),
    A("2026-08-20T03:00:00Z", "recall", 1, false),
  ]);
  assert.equal(s.dailyHistory[0].date, "2026-08-20");
  assert.equal(s.dailyHistory[1].date, "2026-08-18");
  assert.equal(s.activeDays, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/gamification.test.js`
Expected: FAIL — `computeState` is not exported.

- [ ] **Step 3: Write minimal implementation**

```js
// append to lib/gamification.js

// Group attempts into per-day buckets keyed by dayKey, rows ascending by time.
function bucketByDay(attempts) {
  const rows = [...attempts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const byDay = new Map();
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(r);
  }
  return byDay;
}

// Score one day: show-up once + first-submission-per-task check/bonus points.
function scoreDay(dayRows) {
  const firstByTask = new Map();
  for (const r of dayRows) if (!firstByTask.has(r.taskId)) firstByTask.set(r.taskId, r);
  let points = POINTS.showUp;
  let checksPassed = 0;
  let passedAll = false;
  for (const r of firstByTask.values()) {
    points += POINTS.perCheck * (r.checksPassed || 0);
    checksPassed += r.checksPassed || 0;
    if (r.passed) { points += POINTS.allPassBonus; passedAll = true; }
  }
  return { points, tasksDone: firstByTask.size, checksPassed, passedAll };
}

export function computeState(attempts = [], now = new Date()) {
  const byDay = bucketByDay(attempts);

  const dailyHistory = [];
  let earned = 0;
  for (const [date, dayRows] of byDay) {
    const d = scoreDay(dayRows);
    earned += d.points;
    dailyHistory.push({ date, ...d });
  }
  dailyHistory.reverse(); // newest first

  const points = POINTS.welcome + earned;
  const { current, next } = levelFor(points);

  const activeDayKeys = [...byDay.keys()].sort();
  const activeDays = activeDayKeys.length;
  const streakUnlocked = activeDays >= STREAK_UNLOCK_DAYS;

  return {
    points,
    level: current.level,
    levelName: current.name,
    character: current.feature,
    nextLevelAt: next ? next.minPoints : null,
    pointsIntoLevel: points - current.minPoints,
    pointsToNext: next ? next.minPoints - points : 0,
    activeDays,
    streak: 0, // filled in Task 3
    streakUnlocked,
    daysToUnlock: Math.max(0, STREAK_UNLOCK_DAYS - activeDays),
    dailyHistory,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/gamification.test.js`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/gamification.js test/gamification.test.js
git commit -m "feat(gamification): computeState points, levels, daily history"
```

---

### Task 3: Streak with grace day

**Files:**
- Modify: `lib/gamification.js`
- Test: `test/gamification.test.js`

**Interfaces:**
- Consumes: `dayKey`, `STREAK_UNLOCK_DAYS` (Task 1), `computeState` (Task 2).
- Produces: `currentStreak(activeDayKeys, now) -> number`; `computeState().streak` now reflects it (only when `streakUnlocked`).

- [ ] **Step 1: Write the failing test**

```js
// append to test/gamification.test.js
import { currentStreak } from "../lib/gamification.js";

// helper: N consecutive AEST day attempts ending on `endKey`
test("currentStreak counts consecutive days ending today", () => {
  const keys = ["2026-08-18", "2026-08-19", "2026-08-20"];
  const now = new Date("2026-08-20T04:00:00Z"); // 2026-08-20 in Sydney
  assert.equal(currentStreak(keys, now), 3);
});

test("currentStreak stays alive if active yesterday but not yet today", () => {
  const keys = ["2026-08-18", "2026-08-19"];
  const now = new Date("2026-08-20T04:00:00Z"); // today has no attempt yet
  assert.equal(currentStreak(keys, now), 2);
});

test("currentStreak absorbs a single grace day", () => {
  // missed 2026-08-19, active 18 and 20 → streak of 3 (gap bridged once)
  const keys = ["2026-08-17", "2026-08-18", "2026-08-20"];
  const now = new Date("2026-08-20T04:00:00Z");
  assert.equal(currentStreak(keys, now), 3);
});

test("currentStreak resets after two consecutive missed days", () => {
  // active up to 2026-08-16, then 17 & 18 missed, active again 19 & 20
  const keys = ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-19", "2026-08-20"];
  const now = new Date("2026-08-20T04:00:00Z");
  assert.equal(currentStreak(keys, now), 2); // only 19 + 20 survive the double gap
});

test("currentStreak is 0 when neither today nor yesterday active", () => {
  const keys = ["2026-08-10", "2026-08-11"];
  const now = new Date("2026-08-20T04:00:00Z");
  assert.equal(currentStreak(keys, now), 0);
});

test("computeState surfaces the streak once unlocked", () => {
  const A = (createdAt, taskId, c, p) => ({ createdAt, taskId, checksPassed: c, passed: p });
  const s = computeState([
    A("2026-08-18T04:00:00Z", "recall", 1, false),
    A("2026-08-19T04:00:00Z", "recall", 1, false),
    A("2026-08-20T04:00:00Z", "recall", 1, false),
  ], new Date("2026-08-20T05:00:00Z"));
  assert.equal(s.streakUnlocked, true);
  assert.equal(s.streak, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/gamification.test.js`
Expected: FAIL — `currentStreak` not exported; `computeState().streak` still `0`.

- [ ] **Step 3: Write minimal implementation**

```js
// append to lib/gamification.js (above computeState, or anywhere top-level)

// Previous calendar-date label ("YYYY-MM-DD" - 1 day), pure string/label arithmetic.
function prevKey(key) {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Consecutive active days ending today (or yesterday, so "not done yet today" is fine),
// absorbing ONE missing day. A second consecutive miss ends the streak.
export function currentStreak(activeDayKeys, now = new Date()) {
  const set = new Set(activeDayKeys);
  if (set.size === 0) return 0;
  const today = dayKey(now);
  const yest = prevKey(today);
  let cursor;
  if (set.has(today)) cursor = today;
  else if (set.has(yest)) cursor = yest;
  else return 0;

  let count = 0;
  let graceUsed = false;
  while (true) {
    if (set.has(cursor)) {
      count += 1;
      cursor = prevKey(cursor);
    } else if (!graceUsed) {
      graceUsed = true;
      const before = prevKey(cursor);
      if (set.has(before)) cursor = before; // bridge the single-day gap
      else break;
    } else {
      break;
    }
  }
  return count;
}
```

Then wire it into `computeState` — replace the `streak: 0` line:

```js
    streak: streakUnlocked ? currentStreak(activeDayKeys, now) : 0,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/gamification.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/gamification.js test/gamification.test.js
git commit -m "feat(gamification): forgiving streak with single grace day"
```

---

### Task 4: `GET /api/progress` endpoint

**Files:**
- Create: `api/progress.js`
- Modify: `server.js` (add the route for local dev)
- Test: manual (auth gate + JSON shape) — consistent with how other `api/*` were verified.

**Interfaces:**
- Consumes: `getRequestUser` / `getUserFromToken` + `readCookie` + `SESSION_COOKIE` (`lib/session.js`), `db()` + `attempts` (`lib/db.js`), `computeState` (`lib/gamification.js`), `eq` (`drizzle-orm`).
- Produces: `GET /api/progress -> 200 { progress: <computeState result> }` | `401 { error:"unauthenticated" }`.

- [ ] **Step 1: Write the handler**

```js
// api/progress.js
// GET /api/progress -> { progress } for the signed-in user (computed from attempts).
import { getRequestUser } from "../lib/session.js";
import { db, attempts } from "../lib/db.js";
import { eq } from "drizzle-orm";
import { computeState } from "../lib/gamification.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "unauthenticated" });
  const rows = await db().select().from(attempts).where(eq(attempts.userId, user.id));
  res.json({ progress: computeState(rows) });
}
```

- [ ] **Step 2: Wire into `server.js` for local dev**

Find where other API routes are registered in `server.js` and add, following the exact same pattern used for `/api/grade` (import the handler, delegate to it). Example shape (match the file's actual style):

```js
import progressHandler from "./api/progress.js";
// ...
app.get("/api/progress", (req, res) => progressHandler(req, res));
```

- [ ] **Step 3: Verify the auth gate locally**

Run: `npm start` then in another shell:
```bash
curl -s -i http://localhost:8123/api/progress | head -1
```
Expected: `HTTP/1.1 401 Unauthorized` (no session cookie).

- [ ] **Step 4: Verify the shape with a session (if a local `.env` + Neon session exists)**

Sign in locally (DEV echo link), then load `http://localhost:8123/api/progress` in the browser while signed in. Expected: `{ "progress": { "points": 20, "level": 1, ... } }`. If no local DB is set up, note that and defer to live verification — the pure engine is already unit-tested.

- [ ] **Step 5: Commit**

```bash
git add api/progress.js server.js
git commit -m "feat(gamification): GET /api/progress endpoint"
```

---

### Task 5: `characters.js` — shared buddy SVG

**Files:**
- Create: `characters.js`
- Test: manual (open a scratch page or console) — pure string output.

**Interfaces:**
- Produces (browser global, loaded via `<script src="characters.js">`): `window.buddySvg(feature, size=64) -> string` where `feature` is one of `"buddy" | "antenna" | "headband" | "glasses" | "mittens" | "crown"` (the `character` field from `computeState`). Returns an inline `<svg>` string. Also `window.BUDDY_FEATURES` = the ordered feature list for the ladder.

- [ ] **Step 1: Implement using the exact mockup SVGs**

```js
// characters.js — the brand-mark "buddy" character per level. Reuses the approved
// mockup art (no new illustration). Loaded by dashboard.html and progress.html.
(function () {
  var BODY = '<rect x="22" y="26" width="56" height="54" rx="16" fill="#18181C"/>';
  var EYES = '<circle cx="40" cy="48" r="5" fill="#FCFCFA"/><circle cx="60" cy="48" r="5" fill="#FCFCFA"/>';
  var SMILE = '<path d="M40 62 Q50 70 60 62" fill="none" stroke="#EFE84B" stroke-width="4" stroke-linecap="round"/>';

  // Each entry returns the inner SVG markup (viewBox 0 0 100 100).
  var PARTS = {
    buddy:    function () { return BODY + EYES + SMILE; },
    antenna:  function () {
      return '<line x1="50" y1="22" x2="50" y2="10" stroke="#18181C" stroke-width="4" stroke-linecap="round"/>' +
             '<circle cx="50" cy="9" r="6" fill="#EFE84B" stroke="#18181C" stroke-width="3"/>' + BODY + EYES + SMILE;
    },
    headband: function () {
      return BODY + EYES + SMILE + '<path d="M26 30 L74 30" stroke="#EFE84B" stroke-width="6" stroke-linecap="round"/>';
    },
    glasses:  function () {
      return BODY +
             '<circle cx="40" cy="48" r="9" fill="none" stroke="#EFE84B" stroke-width="3"/>' +
             '<circle cx="60" cy="48" r="9" fill="none" stroke="#EFE84B" stroke-width="3"/>' +
             '<line x1="49" y1="48" x2="51" y2="48" stroke="#EFE84B" stroke-width="3"/>' +
             '<path d="M40 64 Q50 70 60 64" fill="none" stroke="#EFE84B" stroke-width="4" stroke-linecap="round"/>';
    },
    mittens:  function () {
      return BODY + EYES + SMILE +
             '<circle cx="18" cy="66" r="7" fill="#EFE84B" stroke="#18181C" stroke-width="2"/>' +
             '<circle cx="82" cy="66" r="7" fill="#EFE84B" stroke="#18181C" stroke-width="2"/>';
    },
    crown:    function () {
      return '<path d="M30 22 L38 12 L50 20 L62 12 L70 22 Z" fill="#EFE84B" stroke="#18181C" stroke-width="2.5" stroke-linejoin="round"/>' +
             '<rect x="22" y="26" width="56" height="54" rx="16" fill="#18181C"/>' +
             '<circle cx="40" cy="50" r="5" fill="#FCFCFA"/><circle cx="60" cy="50" r="5" fill="#FCFCFA"/>' +
             '<path d="M40 64 Q50 72 60 64" fill="none" stroke="#EFE84B" stroke-width="4" stroke-linecap="round"/>';
    },
  };

  window.BUDDY_FEATURES = ["buddy", "antenna", "headband", "glasses", "mittens", "crown"];
  window.buddySvg = function (feature, size) {
    size = size || 64;
    var inner = (PARTS[feature] || PARTS.buddy)();
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">' + inner + '</svg>';
  };
})();
```

- [ ] **Step 2: Verify output**

Open `dashboard.html` in the browser (or a scratch page) with `characters.js` loaded and run in the console:
```js
buddySvg("antenna", 66).startsWith("<svg")  // true, contains the antenna circle
```
Expected: `true`.

- [ ] **Step 3: Commit**

```bash
git add characters.js
git commit -m "feat(gamification): shared buddy character SVG module"
```

---

### Task 6: Your Desk gamification panel + first-time strip

**Files:**
- Modify: `dashboard.html` (add panel markup, first-time strip, fetch/render JS, load `characters.js`)
- Modify: `styles.css` (panel + streak + strip styles)
- Test: manual in-browser.

**Interfaces:**
- Consumes: `GET /api/progress` (Task 4), `window.buddySvg` (Task 5).
- Produces: rendered panel; `Level Up` / `Streak Unlocked` analytics fired on change.

- [ ] **Step 1: Add `characters.js` to the page head/scripts**

In `dashboard.html`, alongside the existing `<script src="auth.js"></script>` block, add:
```html
<script src="characters.js"></script>
```

- [ ] **Step 2: Insert the panel markup** — directly under the `.page-head` block, before `Today's focus`:

```html
<!-- GAMIFICATION PANEL -->
<section class="gamify" id="gamify" hidden aria-label="Your progress">
  <a class="gamify__level" href="progress.html">
    <span class="gamify__char" id="gxChar"></span>
    <span class="gamify__meta">
      <span class="k">Level <b id="gxLevel">1</b></span>
      <span class="gamify__name" id="gxName">Getting Going</span>
      <span class="gamify__pts"><b id="gxPoints">20</b> pts <i id="gxNext"></i></span>
      <span class="gamify__bar"><i id="gxBar" style="width:0%"></i></span>
    </span>
  </a>
  <div class="gamify__streak" id="gxStreak"></div>
</section>
```

- [ ] **Step 3: Add the dismissible first-time strip** — immediately above the panel:

```html
<a class="gamify-new" id="gamifyNew" href="progress.html" hidden data-event="Progress Viewed">
  ✨ New — You Got It now has levels &amp; points. See how it works →
  <button class="gamify-new__x" id="gamifyNewX" aria-label="Dismiss" title="Dismiss">×</button>
</a>
```

- [ ] **Step 4: Add the render script** — inside the page's existing `<script>` block, after `ygiRequireProfile();`:

```js
// gamification panel
(async function () {
  let p;
  try {
    const r = await fetch("/api/progress");
    if (!r.ok) return; // not signed in / error — leave panel hidden
    ({ progress: p } = await r.json());
  } catch (_) { return; }

  const $ = (id) => document.getElementById(id);
  $("gxChar").innerHTML = window.buddySvg(p.character, 72);
  $("gxLevel").textContent = p.level;
  $("gxName").textContent = p.levelName;
  $("gxPoints").textContent = p.points;
  $("gxNext").textContent = p.nextLevelAt ? `· ${p.pointsToNext} to Level ${p.level + 1}` : "· top level 🎉";
  const pct = p.nextLevelAt ? Math.round((p.pointsIntoLevel / (p.pointsIntoLevel + p.pointsToNext)) * 100) : 100;
  $("gxBar").style.width = pct + "%";

  // streak card
  if (p.streakUnlocked) {
    $("gxStreak").innerHTML =
      `<div class="streakcard"><div class="streakcard__n">🔥 ${p.streak}-day streak</div>` +
      `<div class="streakcard__sub">One missed day is always forgiven.</div></div>`;
  } else {
    const left = p.daysToUnlock;
    $("gxStreak").innerHTML =
      `<div class="streakcard streakcard--locked"><div class="streakcard__n">Streaks unlock soon</div>` +
      `<div class="streakcard__sub">Show up ${left} more day${left === 1 ? "" : "s"} to light your streak — with a free skip so a missed day never breaks it.</div></div>`;
  }

  $("gamify").hidden = false;

  // analytics: Level Up / Streak Unlocked vs last seen (localStorage)
  try {
    const prevLvl = Number(localStorage.getItem("ygiLevel") || "0");
    if (p.level > prevLvl && prevLvl > 0 && window.track) window.track("Level Up", { level: p.level });
    localStorage.setItem("ygiLevel", String(p.level));
    const prevUnlocked = localStorage.getItem("ygiStreakUnlocked") === "1";
    if (p.streakUnlocked && !prevUnlocked && window.track) window.track("Streak Unlocked");
    localStorage.setItem("ygiStreakUnlocked", p.streakUnlocked ? "1" : "0");
  } catch (_) {}

  // first-time strip (once)
  if (!localStorage.getItem("ygiGamifySeen")) {
    const strip = document.getElementById("gamifyNew");
    strip.hidden = false;
    document.getElementById("gamifyNewX").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      strip.hidden = true;
      try { localStorage.setItem("ygiGamifySeen", "1"); } catch (_) {}
    });
  }
})();
```

- [ ] **Step 5: Add styles** to `styles.css`:

```css
/* ---- gamification panel (Your Desk) ---- */
.gamify{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin:8px 0 26px}
@media(max-width:680px){.gamify{grid-template-columns:1fr}}
.gamify__level{display:flex;gap:16px;align-items:center;background:#fff;border:1px solid var(--line,#e5e5df);border-radius:14px;padding:18px;text-decoration:none;color:inherit}
.gamify__char{flex:0 0 auto;width:80px;height:80px;border-radius:16px;background:var(--bone,#FCFCFA);border:1px solid var(--line,#e5e5df);display:flex;align-items:center;justify-content:center}
.gamify__meta{display:flex;flex-direction:column;gap:2px}
.gamify__meta .k{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#5b5b63);font-weight:700}
.gamify__name{font-family:'Fraunces',serif;font-weight:600;font-size:20px}
.gamify__pts{font-size:14px}.gamify__pts i{color:var(--muted,#5b5b63);font-style:normal}
.gamify__bar{height:8px;background:#EDEDE9;border-radius:99px;overflow:hidden;margin-top:6px;max-width:260px}
.gamify__bar>i{display:block;height:100%;background:var(--ink,#18181C);border-radius:99px}
.gamify__streak{display:flex;align-items:center}
.streakcard{background:#fff;border:1px solid var(--line,#e5e5df);border-radius:14px;padding:18px;width:100%}
.streakcard--locked{opacity:.9}
.streakcard__n{font-weight:700;margin-bottom:4px}
.streakcard__sub{font-size:13px;color:var(--muted,#5b5b63)}
/* first-time strip */
.gamify-new{display:flex;align-items:center;gap:10px;justify-content:center;background:var(--yellow,#EFE84B);color:var(--ink,#18181C);border-radius:11px;padding:10px 14px;margin:0 0 14px;text-decoration:none;font-weight:600;font-size:14px}
.gamify-new__x{margin-left:6px;background:transparent;border:none;font-size:18px;line-height:1;cursor:pointer;color:inherit}
```

- [ ] **Step 6: Verify in-browser**

Run `npm start`, sign in, load Your Desk. Expected: panel shows Level 1 / Getting Going / 20 pts, buddy character, locked streak card ("Show up 3 more days…"), and the yellow first-time strip (dismiss persists on reload). Confirm no console errors.

- [ ] **Step 7: Commit**

```bash
git add dashboard.html styles.css
git commit -m "feat(gamification): Your Desk progress panel + first-time strip"
```

---

### Task 7: `progress.html` — the rulebook page + nav link

**Files:**
- Create: `progress.html`
- Modify: `dashboard.html`, `learn.html`, `aiground.html` (add "Progress" nav link to desktop + mobile nav)
- Test: manual in-browser.

**Interfaces:**
- Consumes: `GET /api/progress` (Task 4), `window.buddySvg` + `window.BUDDY_FEATURES` (Task 5), `LEVELS` values (mirror the ladder client-side), `auth.js` guard.
- Produces: the Progress page; `Progress Viewed` analytics on load.

- [ ] **Step 1: Create `progress.html`** — copy the full topbar `<header>`, mobile-nav, account-menu markup and the closing `<script src="auth.js">`/`admin.js` + menu-wiring `<script>` block **verbatim from `dashboard.html`** (so chrome stays identical), then set the `<title>` to `You Got It! — Your progress`, mark the Progress nav link `active`, and use this `<main>`:

```html
<main class="page">
  <div class="page-head">
    <p class="eyebrow">Your progress</p>
    <h1>How far you've come.</h1>
    <p class="lead">Points for showing up and doing it well. Levels you grow into. A streak that forgives a missed day.</p>
  </div>

  <!-- summary -->
  <section class="gamify" id="gamify" aria-label="Your level">
    <div class="gamify__level" style="cursor:default">
      <span class="gamify__char" id="gxChar"></span>
      <span class="gamify__meta">
        <span class="k">Level <b id="gxLevel">1</b></span>
        <span class="gamify__name" id="gxName">Getting Going</span>
        <span class="gamify__pts"><b id="gxPoints">20</b> pts <i id="gxNext"></i></span>
        <span class="gamify__bar"><i id="gxBar" style="width:0%"></i></span>
      </span>
    </div>
    <div class="gamify__streak" id="gxStreak"></div>
  </section>

  <!-- level ladder -->
  <p class="section-label">The level ladder</p>
  <section class="ladder" id="ladder" aria-label="Levels"></section>

  <!-- how points work -->
  <p class="section-label">How points work</p>
  <div class="rules">
    <div class="rule"><span>🎉 Welcome aboard</span><b>+20</b></div>
    <div class="rule"><span>☀️ Show up (first task each day)</span><b>+10</b></div>
    <div class="rule"><span>✅ Each green check</span><b>+5</b></div>
    <div class="rule"><span>⭐ All checks clear (bonus)</span><b>+10</b></div>
    <p class="rules__note">Check &amp; bonus points count once per task per day — from your first go. Retrying to improve is always encouraged; a miss is never punished, and you keep every point forever.</p>
  </div>

  <!-- daily history -->
  <p class="section-label">Your days</p>
  <section class="history" id="history" aria-label="Points by day"></section>
</main>
```

- [ ] **Step 2: Add the ladder + history render script** (in a `<script>` before `</body>`, after the copied menu-wiring). Reuse the same summary-render logic as Task 6 for `#gamify`, then:

```js
// ladder — mirror the server LEVELS (kept in sync with lib/gamification.js)
const LADDER = [
  { level: 1, name: "Getting Going", min: 0, feature: "buddy" },
  { level: 2, name: "Finding Your Feet", min: 40, feature: "antenna" },
  { level: 3, name: "In the Flow", min: 90, feature: "headband" },
  { level: 4, name: "Sharp Eye", min: 160, feature: "glasses" },
  { level: 5, name: "Safe Hands", min: 250, feature: "mittens" },
  { level: 6, name: "Quietly Confident", min: 360, feature: "crown" },
];
function renderLadder(current) {
  document.getElementById("ladder").innerHTML = LADDER.map((l) => {
    const on = current >= l.level;
    return `<div class="rung ${on ? "on" : "lock"}">
      <div class="rung__ch">${window.buddySvg(l.feature, 60)}</div>
      <div class="rung__name">${l.name}</div>
      <div class="rung__req">${l.min} pts</div>
      <span class="rung__badge">${on ? "Unlocked" : "Locked"}</span>
    </div>`;
  }).join("");
}
function renderHistory(days) {
  const el = document.getElementById("history");
  if (!days.length) { el.innerHTML = `<p class="history__empty">No graded tasks yet — your first one lands here.</p>`; return; }
  el.innerHTML = days.map((d) =>
    `<div class="histrow"><span class="histrow__date">${d.date}</span>
      <span class="histrow__meta">${d.tasksDone} task${d.tasksDone === 1 ? "" : "s"} · ${d.checksPassed} check${d.checksPassed === 1 ? "" : "s"}${d.passedAll ? " · all clear ⭐" : ""}</span>
      <span class="histrow__pts">+${d.points}</span></div>`
  ).join("");
}
```

Call `renderLadder(p.level)` and `renderHistory(p.dailyHistory)` inside the fetch handler after the summary renders, and fire analytics on load: `if (window.track) window.track("Progress Viewed");`.

- [ ] **Step 3: Add ladder/rules/history styles** to `styles.css`:

```css
/* ---- progress page ---- */
.ladder{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:26px}
@media(max-width:680px){.ladder{grid-template-columns:repeat(2,1fr)}}
.rung{position:relative;background:#fff;border:1px solid var(--line,#e5e5df);border-radius:14px;padding:16px;text-align:center}
.rung.on{border-color:var(--ink,#18181C);box-shadow:0 0 0 1px var(--ink,#18181C)}
.rung.lock{opacity:.55}
.rung__ch{width:64px;height:64px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center}
.rung__name{font-family:'Fraunces',serif;font-weight:600;font-size:16px}
.rung__req{font-size:12px;color:var(--muted,#5b5b63);margin-top:2px}
.rung__badge{position:absolute;top:10px;right:10px;font-size:11px;font-weight:700;background:var(--yellow,#EFE84B);border-radius:99px;padding:2px 8px}
.rung.lock .rung__badge{background:#EDEDE9;color:var(--muted,#5b5b63)}
.rules{background:#fff;border:1px solid var(--line,#e5e5df);border-radius:14px;padding:8px 18px 16px;margin-bottom:26px}
.rule{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px dashed var(--line,#e5e5df)}
.rule:last-of-type{border-bottom:none}
.rule b{font-family:'IBM Plex Mono',monospace}
.rules__note{font-size:13px;color:var(--muted,#5b5b63);margin:10px 0 0}
.history{display:flex;flex-direction:column;gap:8px;margin-bottom:40px}
.histrow{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--line,#e5e5df);border-radius:11px;padding:12px 16px}
.histrow__date{font-family:'IBM Plex Mono',monospace;font-weight:600}
.histrow__meta{color:var(--muted,#5b5b63);font-size:14px;flex:1}
.histrow__pts{font-weight:700}
.history__empty{color:var(--muted,#5b5b63)}
```

- [ ] **Step 4: Add the "Progress" nav link** to `dashboard.html`, `learn.html`, `aiground.html` (and `progress.html` itself). In **both** the desktop `.topbar__nav` and the `.mobile-nav`, add after the AIGround link:
```html
<a href="progress.html">Progress</a>
```
(On `progress.html`, give this link `class="active"` instead.)

- [ ] **Step 5: Verify in-browser**

Run `npm start`, sign in, click "Progress". Expected: summary card, six-rung ladder (Level 1 unlocked, rest locked), the four rules, and a "Your days" history (empty state if no attempts). Nav link appears on all pages and highlights correctly. No console errors.

- [ ] **Step 6: Commit**

```bash
git add progress.html dashboard.html learn.html aiground.html styles.css
git commit -m "feat(gamification): Progress rulebook page + nav link"
```

---

### Task 8: Analytics goals + docs / Obsidian sync

**Files:**
- Modify: `scripts/setup-plausible-goals.mjs` (register new events)
- Modify: `README.md` (brief gamification note)
- Modify: `/Volumes/Backup/Obsidian/AI Literacy Case Study.md` (build-progress sync)

**Interfaces:**
- Consumes: the events emitted in Tasks 6–7 (`Progress Viewed`, `Level Up`, `Streak Unlocked`).

- [ ] **Step 1: Register the new goals** — add `"Progress Viewed"`, `"Level Up"`, `"Streak Unlocked"` to the events array in `scripts/setup-plausible-goals.mjs` (match the existing entry format exactly).

- [ ] **Step 2: Note it in `README.md`** — one short paragraph under the features list: gamification (points/levels/streak) computed from attempts, Progress page at `progress.html`, `GET /api/progress`.

- [ ] **Step 3: Sync the Obsidian build-progress section** — append a dated entry summarizing: gamification live (compute-from-attempts, the economy, six levels + buddy characters, 3-day streak unlock with grace, Progress page + first-time strip), files added (`lib/gamification.js`, `api/progress.js`, `characters.js`, `progress.html`), and that character illustration remains the deferred polish.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all gamification tests pass alongside the existing suite.

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-plausible-goals.mjs README.md
git commit -m "chore(gamification): register analytics goals + docs"
```

(The Obsidian file lives outside the repo and is not committed.)

---

## Notes for the executor

- **Keep the client ladder (`progress.html`) and `LEVELS` (`lib/gamification.js`) in sync** — both list the six levels/thresholds. If levels change, edit both.
- **The engine is the source of truth** — front-end never recomputes points; it only renders `computeState` output. The one duplication is the ladder's static thresholds (for the "locked/unlocked" display), which is display metadata, not scoring.
- **No push/deploy** — the user pushes when ready; do not run `git push` or trigger Vercel.
