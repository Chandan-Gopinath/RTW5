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

// Score one day: show-up once + the BEST submission per task (by check+bonus points),
// so improving on a retry the same day is rewarded — but can't exceed a perfect run,
// which caps a task's daily points and prevents farming.
function scoreDay(dayRows) {
  const bestByTask = new Map(); // taskId -> { points, checksPassed, passed }
  for (const r of dayRows) {
    const cp = r.checksPassed || 0;
    const pts = POINTS.perCheck * cp + (r.passed ? POINTS.allPassBonus : 0);
    const cur = bestByTask.get(r.taskId);
    if (!cur || pts > cur.points) bestByTask.set(r.taskId, { points: pts, checksPassed: cp, passed: !!r.passed });
  }
  let points = POINTS.showUp;
  let checksPassed = 0;
  let passedAll = false;
  for (const b of bestByTask.values()) {
    points += b.points;
    checksPassed += b.checksPassed;
    if (b.passed) passedAll = true;
  }
  return { points, tasksDone: bestByTask.size, checksPassed, passedAll };
}

// Points/level change from adding ONE new attempt — powers the post-grade reveal.
// newAttempt: { taskId, checksPassed, passed, createdAt? }. Returns the delta + new totals.
// Best submission (by points) for a task on a given day → { checks, passed, points }.
function bestTaskToday(rows, taskId, today) {
  let best = { checks: 0, passed: false, points: 0 };
  for (const a of rows) {
    if (a.taskId !== taskId || dayKey(a.createdAt) !== today) continue;
    const cp = a.checksPassed || 0;
    const pts = POINTS.perCheck * cp + (a.passed ? POINTS.allPassBonus : 0);
    if (pts > best.points) best = { checks: cp, passed: !!a.passed, points: pts };
  }
  return best;
}

export function deltaForAttempt(priorAttempts = [], newAttempt, now = new Date()) {
  const before = computeState(priorAttempts, now);
  const row = { createdAt: now, ...newAttempt };
  const after = computeState([...priorAttempts, row], now);
  const pointsEarned = after.points - before.points;

  // Break the delta into its parts so the reveal can show *why* (transparent, not a slot machine).
  const today = dayKey(now);
  const breakdown = [];
  if (priorAttempts.length === 0) breakdown.push({ label: "Welcome aboard", points: POINTS.welcome });
  if (priorAttempts.filter((a) => dayKey(a.createdAt) === today).length === 0) {
    breakdown.push({ label: "Showed up today", points: POINTS.showUp });
  }
  const oldBest = bestTaskToday(priorAttempts, newAttempt.taskId, today);
  const newBest = bestTaskToday([...priorAttempts, row], newAttempt.taskId, today);
  const checkGain = POINTS.perCheck * (newBest.checks - oldBest.checks);
  if (checkGain > 0) {
    const n = newBest.checks - oldBest.checks;
    const label = n === newBest.checks ? `${n} check${n === 1 ? "" : "s"} passed` : `${n} more check${n === 1 ? "" : "s"} passed`;
    breakdown.push({ label, points: checkGain });
  }
  if (newBest.passed && !oldBest.passed) breakdown.push({ label: "All checks clear bonus", points: POINTS.allPassBonus });

  return {
    pointsEarned,
    totalPoints: after.points,
    level: after.level,
    levelName: after.levelName,
    leveledUp: after.level > before.level,
    breakdown,
  };
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

  // Welcome bonus lands once they've started (first graded task) — a brand-new user
  // sits at 0 until then, so the +20 feels earned at the start of their journey.
  const points = (attempts.length > 0 ? POINTS.welcome : 0) + earned;
  const { current, next } = levelFor(points);

  const activeDayKeys = [...byDay.keys()].sort();
  const activeDays = activeDayKeys.length;
  const streakUnlocked = activeDays >= STREAK_UNLOCK_DAYS;

  const todayEntry = dailyHistory.find((d) => d.date === dayKey(now));
  return {
    points,
    level: current.level,
    levelName: current.name,
    character: current.feature,
    nextLevelAt: next ? next.minPoints : null,
    nextLevel: next ? next.level : null,
    nextLevelName: next ? next.name : null,
    nextCharacter: next ? next.feature : null,
    pointsIntoLevel: points - current.minPoints,
    pointsToNext: next ? next.minPoints - points : 0,
    todayPoints: todayEntry ? todayEntry.points : 0,
    activeDays,
    streak: streakUnlocked ? currentStreak(activeDayKeys, now) : 0,
    streakUnlocked,
    daysToUnlock: Math.max(0, STREAK_UNLOCK_DAYS - activeDays),
    dailyHistory,
  };
}
