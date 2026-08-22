# Tiered tasks + scalable catalog — design spec + plan

**Date:** 2026-08-22
**Status:** approved (brainstorm), building
**Branch:** `tiered-tasks` (off `main`)

## Goal

Ease new users in with a simple **Starter** task that teaches the loop, then ramp difficulty
(Starter → Core → Advanced). Make the catalog **scale by appending registry rows**, and make
"finished everything" a graceful state, not a dead end.

## Two axes (kept distinct)

- **Points levels** (Getting Going … Quietly Confident) — motivation, already live.
- **Task tiers** (Starter / Core / Advanced) — content difficulty, this feature.

## Management model (how it scales)

- **`catalog.js`** — the single source of truth for catalog *metadata* (id, tier, status, category,
  title, blurb, meta, chips, order). Every desk decision derives from it.
- Per-task *content* stays split by concern, keyed by the same `id`: grader in `prompts.js`,
  practice copy in `aiground.html` `TASK_VIEWS`, lesson in `learn.html` `LEARN`.
- **Adding a task later** = one `catalog.js` row + its grader + its view/lesson copy. Future tasks
  sit in the catalog as `status:"soon"` and render as locked teasers; flip to `"live"` when ready.
- **"Completed everything"** → the desk shows an encouraging "all caught up" hero offering a
  spaced-repeat refresh of a past task + "more coming". Never empty.
- **Soft progression** — order Starter→Core→Advanced, badge tiers, nudge new users to the Starter;
  nothing hard-locked.

## Build

1. `catalog.js` — `window.YGI_CATALOG` (ordered) + pure `window.ygiPickDesk(catalog, tasks)` →
   `{ focus, rest, allDone }`. Live tasks first-uncompleted = focus; all done → allDone (focus =
   least-recently-done for a refresh).
2. `api/progress.js` — also return `tasks`: per-task `{ attempts, passed, lastAt }`.
3. `progress-cache.js` — cache the `{progress, tasks}` payload; `ygiOnProgress(fn)` now calls
   `fn(progress, isStale, tasks)` (back-compatible; legacy cache shape tolerated).
4. `dashboard.html` — replace the hardcoded Today's-focus + catalog with catalog-driven rendering
   (keeps `.today-hero` / `.taskcard` / `.catalog` classes so styles + the tour selector still work);
   tier badges, "start here" nudge for new users, and the all-caught-up hero.
5. New Starter task **`reminder-sms`** end-to-end: `prompts.js` grader (3 gentle checks), `TASK_VIEWS`
   (aiground), `LEARN` (learn). Simpler rubric + shorter lesson than Core.
6. `styles.css` — tier badge, all-caught-up hero, start-here nudge.

## Starter task — Appointment reminder (SMS)

Scenario: Riverstone Family Practice; patient has an appointment Thursday 2:00pm with Dr Okafor.
Draft a short, friendly SMS reminder. Gentle rubric (3 checks): **context** (names the clinic, warm
and clear), **brevity** (short — an SMS, not a letter), **safety** (no clinical reason / sensitive
detail in a text — a reminder only needs when + where + how to reschedule).

## Out of scope

Building the Advanced tasks themselves (they sit as `soon`); hard locks; per-task analytics beyond
existing `Learn Started`.
