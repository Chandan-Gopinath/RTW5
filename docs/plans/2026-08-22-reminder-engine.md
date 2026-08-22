# Reminder Engine — implementation plan

**Spec:** [../specs/2026-08-22-reminder-engine.md](../specs/2026-08-22-reminder-engine.md)
**Date:** 2026-08-22
**Branch:** `reminder-engine`

Build order is bottom-up: pure logic (test-first) → data → email → cron handlers → wiring →
analytics → config. Each task is independently verifiable.

## Task 1 — Pure logic (`lib/reminders.js`) + tests
No DB, no I/O — mirrors `lib/gamification.js`.
- `TASK_META` — `{ id, title, path }` for each catalog task (recall, complaint). The email's
  human-facing title + deep-link target live here (server `TASKS` only has grader ids).
- `pickDailyTask(taskIds, userAttempts, now)` — un-started task first; else least-recently-practised
  (spaced-repeat). Returns `{ taskId, mode: "new" | "refresh" }` or `null` if catalog empty.
- `practisedToday(userAttempts, now)` — true if any attempt in today's `Australia/Sydney` day
  (reuse `dayKey` from gamification). Drives the daily skip rule.
- `weeklyStats(userAttempts, now)` — `{ points, tasks, streak, level, levelName, pointsToNext,
  nextLevelName, activeThisWeek }` for the recap, built on `computeState`.
- `alreadySent(reminderRows, type, now)` — idempotency: daily = same Sydney day; weekly = same ISO week.
- `test/reminders.test.js` covering all of the above (node --test).

## Task 2 — Data model (`reminder_log`)
- Add `reminderLog` table to `lib/db.js`: `id uuid pk`, `userId uuid → users (cascade)`,
  `type text`, `sentAt timestamptz default now`, `meta jsonb`.
- Generate the migration: `npm run db:generate` → `drizzle/0002_*.sql` (+ journal/snapshot).
- Migration is applied to Neon directly via the HTTP driver at deploy time (drizzle-kit migrate
  hangs — per the project runbook).

## Task 3 — Email library (`lib/email.js`)
- Extract a generic `sendEmail({ to, subject, html })` (the Brevo `fetch` call + error handling,
  honouring `DEV_ECHO_LINK`). `sendMagicLink` refactored to call it — no behaviour change.
- Add `dailyNudgeHtml({ name, task })` and `weeklyRecapHtml({ name, stats })` — reuse the branded,
  table-layout markup + logo. Each has a footer legitimacy line and a deep-link button
  (`?src=daily` / `?src=weekly`).
- Add `sendDailyNudge(...)` / `sendWeeklyRecap(...)` thin wrappers.

## Task 4 — Cron handlers (`api/cron/daily.js`, `api/cron/weekly.js`)
Each: verify `CRON_SECRET` (bearer header) → load all users + their attempts + `reminder_log` →
per user apply skip/idempotency rules → build content → `sendEmail` → insert `reminder_log` row.
Best-effort per user (one failure never aborts the batch); return a `{ sent, skipped, failed }`
summary. Serverless-function shaped like the existing `api/*` handlers.

## Task 5 — Local dev wiring (`server.js`)
Mount `GET /api/cron/daily` and `GET /api/cron/weekly` so the batch is runnable locally against Neon.

## Task 6 — Vercel cron (`vercel.json`)
Add two `crons` entries at the UTC time matching 11:30 `Australia/Sydney` (document the AEST/AEDT
offset choice + ±1h DST drift). Daily = every day; weekly = Mondays.

## Task 7 — Analytics (`analytics.js` + `scripts/setup-plausible-goals.mjs`)
- On load, parse `?src`; if `daily`/`weekly`, fire `track("Reminder Clicked", { type })`.
- Register the `Reminder Clicked` goal in the setup script.

## Task 8 — Config (`.env.example`)
Document `CRON_SECRET` (user sets it in Vercel + local `.env`; never handled by Claude).

## Verification
- `npm test` green (existing 22 + new reminders tests).
- Local dry-run of both cron endpoints with `DEV_ECHO_LINK=1` (logs, no real sends) against Neon.
- After deploy: set `CRON_SECRET` in Vercel; confirm the cron jobs appear + a manual trigger logs a
  `reminder_log` row; verify a deep-link fires `Reminder Clicked`.

## Out of scope (per spec §11)
Per-user cadence/timezone, email-preferences page, open-tracking, bounce dashboards, tapering.
