// Pure reminder-engine logic — task picking, "practised today?", weekly stats,
// and send idempotency. No DB, no I/O (mirrors lib/gamification.js), so it's
// trivially unit-testable. The cron handlers wire this to the DB + email.

import { dayKey, computeState, LEVELS } from "./gamification.js";

// Human-facing metadata for each catalog task. The server-side TASKS map
// (prompts.js) only holds grader ids; the email needs a title, a deep-link path,
// and a spaced-repeat hook line for the "refresh" framing.
export const TASK_META = {
  recall: {
    id: "recall",
    title: "the patient recall letter",
    path: "/aiground.html?task=recall",
    refreshLine: "Can you still spot the detail that should never go into the tool?",
  },
  complaint: {
    id: "complaint",
    title: "the patient complaint response",
    path: "/aiground.html?task=complaint",
    refreshLine: "Can you still keep it caring without admitting fault?",
  },
};

// Ordered list of task ids the daily nudge draws from (catalog order).
export const CATALOG = ["recall", "complaint"];

// ISO-week label ("YYYY-Www") for a "YYYY-MM-DD" day string. Used to bucket the
// weekly recap and to dedupe weekly sends. Parsed as a plain date (the string is
// already an Australia/Sydney local day from dayKey).
export function isoWeekKey(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // shift to the week's Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Did the user log any graded attempt in today's Sydney day? (daily skip rule)
export function practisedToday(userAttempts = [], now = new Date()) {
  const today = dayKey(now);
  return userAttempts.some((a) => dayKey(a.createdAt) === today);
}

// Pick the task for today's nudge:
//   1. first un-started task in the catalog  -> { mode: "new" }
//   2. else the least-recently-practised one -> { mode: "refresh" } (spaced repetition)
// Returns null only if the catalog is empty.
export function pickDailyTask(taskIds = CATALOG, userAttempts = [], now = new Date()) {
  if (!taskIds.length) return null;

  const lastPractised = new Map(); // taskId -> most recent attempt time (ms)
  for (const a of userAttempts) {
    const t = new Date(a.createdAt).getTime();
    if (!lastPractised.has(a.taskId) || t > lastPractised.get(a.taskId)) {
      lastPractised.set(a.taskId, t);
    }
  }

  const unstarted = taskIds.find((id) => !lastPractised.has(id));
  if (unstarted) return { taskId: unstarted, mode: "new" };

  // all started — refresh the one practised longest ago (ties: catalog order)
  let pick = taskIds[0];
  let oldest = Infinity;
  for (const id of taskIds) {
    const t = lastPractised.get(id) ?? Infinity;
    if (t < oldest) { oldest = t; pick = id; }
  }
  return { taskId: pick, mode: "refresh" };
}

// Weekly recap figures, built on the gamification engine. "This week" = the
// current ISO week in Sydney; points/tasks are summed from that week's daily
// history (the one-time welcome bonus is all-time, so it's correctly excluded).
export function weeklyStats(userAttempts = [], now = new Date()) {
  const state = computeState(userAttempts, now);
  const thisWeek = isoWeekKey(dayKey(now));
  const weekDays = state.dailyHistory.filter((d) => isoWeekKey(d.date) === thisWeek);

  const pointsThisWeek = weekDays.reduce((s, d) => s + d.points, 0);
  const tasksThisWeek = weekDays.reduce((s, d) => s + d.tasksDone, 0);
  const nextLevel = LEVELS.find((l) => l.level === state.nextLevel) || null;

  return {
    activeThisWeek: weekDays.length > 0,
    pointsThisWeek,
    tasksThisWeek,
    totalPoints: state.points,
    level: state.level,
    levelName: state.levelName,
    streak: state.streak,
    streakUnlocked: state.streakUnlocked,
    pointsToNext: state.pointsToNext,
    nextLevelName: nextLevel ? nextLevel.name : null,
  };
}

// Idempotency guard — has a reminder of this type already been sent this period?
// daily = same Sydney day; weekly = same ISO week. Makes the cron safe to retry.
export function alreadySent(reminderRows = [], type, now = new Date()) {
  if (type === "daily") {
    const today = dayKey(now);
    return reminderRows.some((r) => r.type === "daily" && dayKey(r.sentAt) === today);
  }
  if (type === "weekly") {
    const wk = isoWeekKey(dayKey(now));
    return reminderRows.some((r) => r.type === "weekly" && isoWeekKey(dayKey(r.sentAt)) === wk);
  }
  return false;
}
