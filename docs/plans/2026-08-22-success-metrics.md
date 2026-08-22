# Success-Metrics view — implementation plan

**Spec:** [../specs/2026-08-22-success-metrics.md](../specs/2026-08-22-success-metrics.md)
**Branch:** `metrics` (off `main`)

1. **`lib/metrics.js`** (pure) — `computeMetrics(users, attempts, now)` returns
   `{ totalUsers, weeklyAppliedActions, gradedTasksLast7, totalGradedTasks, activation:{eligible,
   activated, rate}, passRate, firstTryPassRate, retryPassRate, weeklyTrend:[{week,label,users}] }`.
   Local `isoWeekKey` (metrics is off `main`, which lacks `lib/reminders.js`); reuse `dayKey` from
   `lib/gamification.js`. All rates integer % or null.
2. **`test/metrics.test.js`** — activation window, WAA distinct-in-7d, retry-improvement split,
   pass-rate, weekly-trend bucketing, empty-data safety.
3. **`api/admin/metrics.js`** — admin gate (`isAdmin`), load users + attempts, return metrics.
4. **`server.js`** — mount `GET /api/admin/metrics`.
5. **`admin.html`** — a "Metrics" section (stat-card grid + retry/activation + weekly-trend CSS bars)
   above the grading-model section; fetch on the admin gate; `Metrics Viewed` event. Minimal scoped
   styles in `styles.css`.
6. **`scripts/setup-plausible-goals.mjs`** — register `Metrics Viewed`.

## Verify
`npm test` green; boot server, `/api/admin/metrics` 403 for non-admin; admin section renders.
