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
