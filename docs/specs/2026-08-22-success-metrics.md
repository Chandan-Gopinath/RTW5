# Success-Metrics view — design spec

**Date:** 2026-08-22
**Status:** approved (brainstorm), ready to build
**Feature area:** an admin-only metrics view measuring "doing, not watching", computed from `attempts` + `users`

---

## 1. Goal & guardrails

A founder/team view of whether the product is building real capability — not vanity engagement.
Measures **doing, not watching** (the doc's principle): every metric counts completed graded
tasks and cohort behaviour, never time-in-app or lessons-viewed.

- **Admin-only.** Lives on `admin.html`, gated by `ADMIN_EMAILS` (same as the users/feedback views).
- **DB-computed.** From `attempts` + `users`. Plausible stays for the anonymous funnel/engagement
  (linked out) — this view is the per-user cohort numbers Plausible can't produce.
- **No migration.** Reads existing tables.
- Day/week bucketing in `Australia/Sydney` (reusing `dayKey` from `lib/gamification.js`).

## 2. Metrics (v1)

- **North Star — Weekly Applied Actions:** distinct users with ≥1 graded task in the last 7 days.
- **Activation:** % of *eligible* users (signed up ≥3 days ago) who completed a first graded task
  within 3 days of signup.
- **Totals:** total users, total graded tasks, graded tasks in the last 7 days.
- **Retry-improvement:** first-attempt pass-rate vs. later-attempt (retry) pass-rate — the "learning
  is happening" signal.
- **Overall pass-rate.**
- **Weekly trend:** distinct active users per ISO week for the last 6 weeks (CSS bars, no chart lib).

**Deferred:** "Transfer" (used-it-at-work) — needs a dedicated capture prompt; will ride the
feedback feature later. Noted, not built.

## 3. Surfaces

- **`lib/metrics.js`** — pure `computeMetrics(users, attempts, now?)` (no I/O), unit-tested.
- **`GET /api/admin/metrics`** — admin-gated; loads users + attempts; returns `computeMetrics(...)`.
- **`admin.html`** — a "Metrics" section (stat cards + retry/activation + weekly-trend bars) at the
  top of the Control Room. `Metrics Viewed` analytics event.

## 4. Out of scope

Transfer/used-at-work, per-task drilldowns, date-range pickers, CSV export, charts beyond the simple
weekly bars.
