# Gamification — design spec

**Date:** 2026-08-22
**Status:** approved (brainstorm), ready for implementation plan
**Feature area:** points / levels / streaks + a Progress page, for the "You Got It!" app

---

## 1. Goal & guardrails

Motivate the **daily habit** the product depends on, **without adding fear or pressure** to an
already-intimidated user. Every mechanic is chosen to reinforce confidence, not punish.

Design principles carried from the case study:

- **Reward showing up first, mastery second.** Turning up daily is the core win; doing it well accelerates.
- **Forgiving.** A failed task is never punished; earned points are never lost.
- **Deferred pressure.** Streaks (the most pressure-y mechanic) stay hidden until the user has
  self-selected as engaged — they unlock only after 3 active days.
- **Transparent, not manipulative.** The rules are shown plainly (the Progress page is the rulebook).
  Honest gamification fits the anti-fear brand.

---

## 2. The core decision — everything is computed from `attempts`

**No new database columns and no migration.** The existing `attempts` table already records, per
graded run: `userId`, `taskId`, `checksPassed`, `total`, `passed`, `createdAt`. Points, level,
streak, and daily history are **derived from that data on read**. The signup welcome bonus is a flat
constant every user starts with.

Rationale: denormalized `points`/`level`/`streak` columns can drift out of sync with the source
attempts and require write-path bookkeeping on every grade. Computing on read is always correct,
needs zero schema change, and the pure computation is trivially unit-testable. Attempt volume per
user is small (a learning app, one task/day), so read-time computation is cheap.

---

## 3. The points economy

| Reward | Points | Rule |
|--------|-------:|------|
| 🎉 Welcome aboard | **+20** | Flat baseline every user starts with (instant day-one win). |
| ☀️ Show up | **+10** | Once per day, on the first graded task of that day. |
| ✅ Each green check | **+5** | Per check passed, on the **first** submission of a task that day. |
| ⭐ All checks clear | **+10** | Bonus when that first submission passes every check. |

**Anti-farming, never anti-user:** check + bonus points bank **once per task per day** — they are
scored from the *first* submission of each task on each day. Re-submitting the same task that day to
improve is still encouraged (it's how learning happens) but does not re-pay. Show-up points are
once/day regardless. A failed attempt is never negative; the user keeps every point earned, forever.

### Levels (points → identity)

Six levels to start. Each level = a name + the brand-mark **buddy** character gaining one yellow
feature to showcase.

| Level | Name | Threshold (cumulative pts) | Character |
|------:|------|---------------------------:|-----------|
| 1 | Getting Going | 0 | buddy |
| 2 | Finding Your Feet | 40 | + antenna |
| 3 | In the Flow | 90 | + headband |
| 4 | Sharp Eye | 160 | + glasses |
| 5 | Safe Hands | 250 | + mittens |
| 6 | Quietly Confident | 360 | + crown |

Thresholds are scaled to the current two-task catalog (an engaged user earns ~40–70 pts/day), so
Level 2 is a first-day win and Level 6 is ~1–2 weeks of showing up. Raise them as more graded tasks
land.

Level = the highest threshold ≤ current points. The last three names lean into the actual judgment
skills (verify / safe use / knowing when a human decides), tying identity to capability.

### Streak (habit spine, separate from levels)

- **Definition:** consecutive **active days** (a day with ≥1 graded attempt) ending today, with **one
  grace day absorbed** — a single missed day never breaks the streak; a second consecutive missed day
  resets it.
- **Unlock:** streaks are hidden until the user has been active on **3 distinct days**
  (`activeDays ≥ 3`). Before that, the panel shows a friendly locked state with a countdown
  ("unlocks in N more days").
- Day-bucketing uses a fixed app timezone, **`Australia/Sydney`** (the beachhead market), so "today"
  and streaks feel correct regardless of server UTC.

Levels and streaks are deliberately **two separate spines**: points → levels → characters answers
"how far have I come?"; the streak answers "am I showing up?". They never tangle.

---

## 4. Components

### 4.1 `lib/gamification.js` — pure engine (no DB, no I/O)

Single source of truth for all rules. Exports tuning constants + pure functions:

- `LEVELS` — `[{ level, name, minPoints, feature }]`
- `POINTS` — `{ welcome: 20, showUp: 10, perCheck: 5, allPassBonus: 10 }`
- `STREAK_UNLOCK_DAYS = 3`, `APP_TZ = "Australia/Sydney"`
- `dayKey(date)` — the `YYYY-MM-DD` bucket in `APP_TZ`.
- `computeState(attempts)` → returns:
  ```
  {
    points, level, levelName, character, nextLevelAt, pointsIntoLevel, pointsToNext,
    activeDays, streak, streakUnlocked, daysToUnlock,
    dailyHistory: [{ date, points, tasksDone, checksPassed, passedAll }]  // newest first
  }
  ```
  `attempts` is the raw rows for one user (may be empty → welcome-only state: 20 pts, Level 1).

The per-day scoring, first-submission-per-task selection, level lookup, and streak-with-grace walk
all live here as pure logic.

### 4.2 `GET /api/progress` — serverless function

- Resolves the signed-in user via the existing session helper (`getRequestUser` / `getUserFromToken`).
- `401` if unauthenticated.
- Loads that user's `attempts` (ordered), runs `computeState`, returns the JSON.
- Mirrors the existing `api/*.js` handler shape; also wired into `server.js` for local dev.
- `/api/auth/me` is left untouched.

### 4.3 `characters.js` — shared buddy SVG (client)

One function `buddySvg(level)` returning the inline SVG for that level's character. **Reuses the exact
SVGs already designed in the mockup** — no new art. Loaded by both `dashboard.html` and
`progress.html` so there is a single source for the character.

### 4.4 `dashboard.html` — Your Desk panel

- A gamification panel: level + character + points + progress bar to next level, and a streak card
  (locked-with-countdown until unlocked, then live streak with the free-skip note).
- Populated by a single `fetch('/api/progress')` on load (after `ygiRequireProfile()`).
- A **dismissible first-time strip** ("✨ New — You Got It now has levels. See how →" → `progress.html`),
  shown once, dismissal stored in `localStorage`. No modal, no forced tour.

### 4.5 `progress.html` — the rulebook (new page)

The single home for: the full **level ladder** (unlocked vs locked, with character + threshold), the
**per-day points history**, current **streak** state, and **"how points work."** Reuses the shared
topbar/nav/footer chrome and `auth.js` guard. Add a **"Progress"** link to the nav on all four app
pages (`dashboard`, `learn`, `aiground`, `progress`) + the mobile nav.

### 4.6 `styles.css`

New styles for the panel, ladder, history rows, and streak card — extending the existing design
tokens (bone/ink/yellow, Fraunces/Hanken/Plex Mono). No new fonts or colors.

---

## 5. Analytics (standing rule: events for every new feature)

New custom events, added via `window.track(...)` and to `scripts/setup-plausible-goals.mjs`:

- `Progress Viewed` — Progress page load.
- `Level Up` — client detects level increased since last seen (localStorage compare) `{ level }`.
- `Streak Unlocked` — client detects `streakUnlocked` newly true `{ }`.

Aggregate/anonymous, consistent with the existing Plausible setup.

---

## 6. Testing

Unit tests for `lib/gamification.js` with Node's built-in `node --test` (no new dependency), covering:

- Empty attempts → welcome-only (20 pts, Level 1, streak locked, `daysToUnlock = 3`).
- Show-up counted once per day even with multiple attempts.
- Check + bonus scored from the **first** submission of a task that day; a same-day retry does not
  re-pay; a later-day retry does.
- All-pass bonus applied only when the scoring submission passed.
- Level boundaries (exactly at a threshold, just below, top level with no next).
- Streak: unlock at 3 active days; consecutive-day counting; single grace day absorbed; second
  consecutive miss resets.
- `dayKey` bucketing respects `APP_TZ` across a UTC midnight boundary.

`GET /api/progress` is exercised via `server.js` locally against Neon (auth gate + shape), consistent
with how prior features were verified.

---

## 7. Build order

1. `lib/gamification.js` + unit tests (pure — verify before anything touches the DB or UI).
2. `GET /api/progress` (+ `server.js` wiring).
3. `characters.js` + Your Desk panel + first-time strip.
4. `progress.html` + nav link (all pages).
5. Analytics events + goal script + docs/Obsidian progress sync.

**Deferred (end, optional):** richer illustrated characters — the buddy SVGs carry the feature
indefinitely and the user asked to reuse them, so this is now optional polish rather than a planned step.

---

## 8. Out of scope (YAGNI)

- Denormalized points/level/streak DB columns (computed on read instead).
- Leaderboards / social comparison (cuts against the fear-reduction thesis).
- Streak *freeze as an earned/bankable item* — the automatic single grace day covers forgiveness
  without a mechanic to build or explain.
- Onboarding modal / forced tour (the dismissible strip + Progress rulebook replace it).
- Configurable per-user timezone (fixed `Australia/Sydney` for now).
