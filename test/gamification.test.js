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

test("brand-new user (no attempts) sits at 0 — welcome bonus not yet earned", () => {
  const s = computeState([], new Date("2026-08-22T02:00:00Z"));
  assert.equal(s.points, 0); // welcome +20 lands only after the first graded task
  assert.equal(s.level, 1);
  assert.equal(s.levelName, "Getting Going");
  assert.equal(s.character, "buddy");
  assert.equal(s.nextLevelAt, 40);
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

test("best-of-day: improving a same-day retry counts", () => {
  // first 2/4 (fail), retry same day 4/4 (pass) — the BEST submission is scored
  const day = [
    A("2026-08-20T03:00:00Z", "recall", 2, false),
    A("2026-08-20T05:00:00Z", "recall", 4, true),
  ];
  const s = computeState(day);
  // day = showup 10 + best(4*5 + bonus 10) = 40; + welcome 20 = 60
  assert.equal(s.points, 60);
  assert.equal(s.dailyHistory[0].points, 40);
  assert.equal(s.dailyHistory[0].checksPassed, 4);
  assert.equal(s.dailyHistory[0].tasksDone, 1);
});

test("best-of-day: a worse retry doesn't reduce the day's points", () => {
  const day = [
    A("2026-08-20T03:00:00Z", "recall", 4, true),  // best
    A("2026-08-20T05:00:00Z", "recall", 1, false), // worse retry
  ];
  const s = computeState(day);
  assert.equal(s.dailyHistory[0].points, 40); // keeps the best: 10 + 30
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
import { currentStreak, deltaForAttempt } from "../lib/gamification.js";

test("deltaForAttempt: very first task bundles the welcome bonus → +60, levels up", () => {
  const now = new Date("2026-08-22T04:00:00Z");
  const d = deltaForAttempt([], { taskId: "recall", checksPassed: 4, passed: true }, now);
  // welcome 20 (lands now) + showup 10 + 4*5 + bonus 10 = 60
  assert.equal(d.pointsEarned, 60);
  assert.equal(d.totalPoints, 60);
  assert.equal(d.level, 2);
  assert.equal(d.leveledUp, true);
});

test("deltaForAttempt: improving a same-day retry pays the delta", () => {
  const now = new Date("2026-08-22T06:00:00Z");
  const prior = [{ taskId: "recall", checksPassed: 2, passed: false, createdAt: "2026-08-22T04:00:00Z" }];
  const d = deltaForAttempt(prior, { taskId: "recall", checksPassed: 4, passed: true }, now);
  // before: welcome20 + showup10 + 2*5 = 40; after: welcome20 + showup10 + (20+10) = 60 → +20
  assert.equal(d.pointsEarned, 20);
});

test("deltaForAttempt: same task again same day → +0 (once per task per day)", () => {
  const now = new Date("2026-08-22T06:00:00Z");
  const prior = [{ taskId: "recall", checksPassed: 4, passed: true, createdAt: "2026-08-22T04:00:00Z" }];
  const d = deltaForAttempt(prior, { taskId: "recall", checksPassed: 4, passed: true }, now);
  assert.equal(d.pointsEarned, 0);
  assert.equal(d.leveledUp, false);
});

test("deltaForAttempt: first partial task → welcome + showup + per-check, no bonus", () => {
  const now = new Date("2026-08-22T04:00:00Z");
  const d = deltaForAttempt([], { taskId: "complaint", checksPassed: 2, passed: false }, now);
  assert.equal(d.pointsEarned, 40); // welcome 20 + showup 10 + 2*5
});

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
