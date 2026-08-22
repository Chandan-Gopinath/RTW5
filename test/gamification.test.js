import { test } from "node:test";
import assert from "node:assert/strict";
import { POINTS, LEVELS, dayKey, levelFor, APP_TZ } from "../lib/gamification.js";

test("economy constants are exact", () => {
  assert.deepEqual(POINTS, { welcome: 20, showUp: 10, perCheck: 5, allPassBonus: 10 });
});

test("levels ladder is exact", () => {
  assert.deepEqual(LEVELS.map((l) => [l.level, l.name, l.minPoints]), [
    [1, "Getting Going", 0], [2, "Finding Your Feet", 40], [3, "In the Flow", 90],
    [4, "Sharp Eye", 160], [5, "Safe Hands", 250], [6, "Quietly Confident", 360],
  ]);
});

test("dayKey buckets in APP_TZ across a UTC midnight", () => {
  // 2026-03-01T13:30Z is 2026-03-02 00:30 in Sydney (AEDT, +11)
  assert.equal(dayKey("2026-03-01T13:30:00Z"), "2026-03-02");
  assert.equal(APP_TZ, "Australia/Sydney");
});

test("levelFor picks highest threshold <= points and the next", () => {
  assert.equal(levelFor(0).current.level, 1);
  assert.equal(levelFor(39).current.level, 1);
  assert.equal(levelFor(40).current.level, 2);   // exactly at threshold
  assert.equal(levelFor(40).next.minPoints, 90);
  assert.equal(levelFor(360).current.level, 6);
  assert.equal(levelFor(360).next, null);         // top level, no next
});

// append to test/gamification.test.js
import { computeState } from "../lib/gamification.js";

const A = (createdAt, taskId, checksPassed, passed) => ({ createdAt, taskId, checksPassed, passed });

test("empty attempts → welcome-only state", () => {
  const s = computeState([], new Date("2026-08-22T02:00:00Z"));
  assert.equal(s.points, 20);
  assert.equal(s.level, 1);
  assert.equal(s.levelName, "Getting Going");
  assert.equal(s.character, "buddy");
  assert.equal(s.nextLevelAt, 40); // brief said 60 (typo); LEVELS L2 minPoints=40 per Task 1, matches reference impl (next.minPoints)
  assert.equal(s.streakUnlocked, false);
  assert.equal(s.daysToUnlock, 3);
  assert.deepEqual(s.dailyHistory, []);
});

test("one all-pass task: welcome + showup + 4 checks + bonus", () => {
  // 4/4 checks, passed → 20 + 10 + 4*5 + 10 = 60
  const s = computeState([A("2026-08-20T03:00:00Z", "recall", 4, true)]);
  assert.equal(s.points, 60);
  assert.equal(s.level, 2); // 60 hits Finding Your Feet
  assert.equal(s.dailyHistory[0].tasksDone, 1);
  assert.equal(s.dailyHistory[0].checksPassed, 4);
  assert.equal(s.dailyHistory[0].passedAll, true);
  assert.equal(s.dailyHistory[0].points, 40); // 10 + 20 + 10 (welcome not in day)
});

test("once-per-task-per-day: same-day retry does not re-pay", () => {
  // first submission 2/4 (fail), retry same day 4/4 (pass) — only the FIRST counts
  const day = [
    A("2026-08-20T03:00:00Z", "recall", 2, false),
    A("2026-08-20T05:00:00Z", "recall", 4, true),
  ];
  const s = computeState(day);
  // day points = showup 10 + first submission 2*5 + no bonus = 20; +welcome 20 = 40
  assert.equal(s.points, 40);
  assert.equal(s.dailyHistory[0].points, 20);
  assert.equal(s.dailyHistory[0].tasksDone, 1);
});

test("show-up counts once per day across two tasks", () => {
  const day = [
    A("2026-08-20T03:00:00Z", "recall", 4, true),
    A("2026-08-20T04:00:00Z", "complaint", 0, false),
  ];
  const s = computeState(day);
  // showup 10 (once) + recall(20+10) + complaint(0) = 40; +welcome = 60
  assert.equal(s.dailyHistory[0].points, 40);
  assert.equal(s.dailyHistory[0].tasksDone, 2);
  assert.equal(s.points, 60);
});

test("dailyHistory is newest-first across days", () => {
  const s = computeState([
    A("2026-08-18T03:00:00Z", "recall", 1, false),
    A("2026-08-20T03:00:00Z", "recall", 1, false),
  ]);
  assert.equal(s.dailyHistory[0].date, "2026-08-20");
  assert.equal(s.dailyHistory[1].date, "2026-08-18");
  assert.equal(s.activeDays, 2);
});

// append to test/gamification.test.js
import { currentStreak } from "../lib/gamification.js";

// helper: N consecutive AEST day attempts ending on `endKey`
test("currentStreak counts consecutive days ending today", () => {
  const keys = ["2026-08-18", "2026-08-19", "2026-08-20"];
  const now = new Date("2026-08-20T04:00:00Z"); // 2026-08-20 in Sydney
  assert.equal(currentStreak(keys, now), 3);
});

test("currentStreak stays alive if active yesterday but not yet today", () => {
  const keys = ["2026-08-18", "2026-08-19"];
  const now = new Date("2026-08-20T04:00:00Z"); // today has no attempt yet
  assert.equal(currentStreak(keys, now), 2);
});

test("currentStreak absorbs a single grace day", () => {
  // missed 2026-08-19, active 18 and 20 → streak of 3 (gap bridged once)
  const keys = ["2026-08-17", "2026-08-18", "2026-08-20"];
  const now = new Date("2026-08-20T04:00:00Z");
  assert.equal(currentStreak(keys, now), 3);
});

test("currentStreak resets after two consecutive missed days", () => {
  // active up to 2026-08-16, then 17 & 18 missed, active again 19 & 20
  const keys = ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-19", "2026-08-20"];
  const now = new Date("2026-08-20T04:00:00Z");
  assert.equal(currentStreak(keys, now), 2); // only 19 + 20 survive the double gap
});

test("currentStreak is 0 when neither today nor yesterday active", () => {
  const keys = ["2026-08-10", "2026-08-11"];
  const now = new Date("2026-08-20T04:00:00Z");
  assert.equal(currentStreak(keys, now), 0);
});

test("computeState surfaces the streak once unlocked", () => {
  const A = (createdAt, taskId, c, p) => ({ createdAt, taskId, checksPassed: c, passed: p });
  const s = computeState([
    A("2026-08-18T04:00:00Z", "recall", 1, false),
    A("2026-08-19T04:00:00Z", "recall", 1, false),
    A("2026-08-20T04:00:00Z", "recall", 1, false),
  ], new Date("2026-08-20T05:00:00Z"));
  assert.equal(s.streakUnlocked, true);
  assert.equal(s.streak, 3);
});
