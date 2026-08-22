// Pure success-metrics engine — no DB, no I/O — computed from users + attempts.
// Measures "doing, not watching": completed graded tasks and cohort behaviour only.
// Day/week bucketing follows Australia/Sydney via dayKey (lib/gamification.js).

import { dayKey } from "./gamification.js";

const DAY = 86400000;

// ISO-week label ("YYYY-Www") for a "YYYY-MM-DD" day string. (metrics is off main,
// which doesn't carry lib/reminders.js, so this lives here too — same algorithm.)
export function isoWeekKey(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// integer percent, or null when there's nothing to divide
function pct(num, den) {
  return den > 0 ? Math.round((num / den) * 100) : null;
}

// The last `n` ISO weeks ending with the one containing `now` (oldest → newest),
// with a short "D Mon" label for the Monday-ish anchor date of each bucket.
function recentWeeks(now, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(now.getTime() - i * 7 * DAY);
    const key = isoWeekKey(dayKey(dt));
    const label = new Date(dt).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    out.push({ week: key, label });
  }
  return out;
}

export function computeMetrics(users = [], attempts = [], now = new Date()) {
  const nowMs = now.getTime();
  const last7 = nowMs - 7 * DAY;

  // North Star — Weekly Applied Actions: distinct users with a graded task in the last 7 days.
  const recent = attempts.filter((a) => new Date(a.createdAt).getTime() >= last7);
  const weeklyAppliedActions = new Set(recent.map((a) => a.userId)).size;

  // Activation: of users who signed up ≥3 days ago (had the full window), what % did a
  // first graded task within 3 days of signing up.
  const firstAttemptByUser = new Map();
  for (const a of attempts) {
    const t = new Date(a.createdAt).getTime();
    if (!firstAttemptByUser.has(a.userId) || t < firstAttemptByUser.get(a.userId)) {
      firstAttemptByUser.set(a.userId, t);
    }
  }
  let eligible = 0;
  let activated = 0;
  for (const u of users) {
    const created = new Date(u.createdAt).getTime();
    if (created > nowMs - 3 * DAY) continue; // hasn't had the full 3-day window yet
    eligible += 1;
    const first = firstAttemptByUser.get(u.id);
    if (first != null && first - created <= 3 * DAY) activated += 1;
  }

  // Pass-rates + retry-improvement.
  const total = attempts.length;
  const passedTotal = attempts.filter((a) => a.passed).length;
  const firstTry = attempts.filter((a) => a.attemptNo === 1);
  const retry = attempts.filter((a) => a.attemptNo > 1);

  // Weekly trend — distinct active users per ISO week (last 6 weeks).
  const usersByWeek = new Map();
  for (const a of attempts) {
    const wk = isoWeekKey(dayKey(a.createdAt));
    if (!usersByWeek.has(wk)) usersByWeek.set(wk, new Set());
    usersByWeek.get(wk).add(a.userId);
  }
  const weeklyTrend = recentWeeks(now, 6).map((w) => ({
    ...w,
    users: usersByWeek.has(w.week) ? usersByWeek.get(w.week).size : 0,
  }));

  return {
    totalUsers: users.length,
    weeklyAppliedActions,
    gradedTasksLast7: recent.length,
    totalGradedTasks: total,
    activation: { eligible, activated, rate: pct(activated, eligible) },
    passRate: pct(passedTotal, total),
    firstTryPassRate: pct(firstTry.filter((a) => a.passed).length, firstTry.length),
    retryPassRate: pct(retry.filter((a) => a.passed).length, retry.length),
    weeklyTrend,
  };
}
