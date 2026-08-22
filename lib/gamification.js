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
