import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TASK_META, CATALOG, isoWeekKey, practisedToday, pickDailyTask, weeklyStats, alreadySent,
} from "../lib/reminders.js";

const A = (createdAt, taskId, checksPassed = 0, passed = false) => ({ createdAt, taskId, checksPassed, passed });

test("catalog + task metadata are complete", () => {
  assert.deepEqual(CATALOG, ["recall", "complaint"]);
  for (const id of CATALOG) {
    assert.ok(TASK_META[id], `meta for ${id}`);
    assert.match(TASK_META[id].path, /\?task=/);
    assert.ok(TASK_META[id].title.length > 0);
    assert.ok(TASK_META[id].refreshLine.length > 0);
  }
});

test("isoWeekKey groups by ISO week; Sunday belongs to the week that started Monday", () => {
  // 2026-08-17 is a Monday; 2026-08-23 the following Sunday — same ISO week.
  assert.equal(isoWeekKey("2026-08-17"), isoWeekKey("2026-08-23"));
  // 2026-08-24 (next Monday) is a new week.
  assert.notEqual(isoWeekKey("2026-08-23"), isoWeekKey("2026-08-24"));
});

test("practisedToday is true only for an attempt in today's Sydney day", () => {
  const now = new Date("2026-08-22T02:00:00Z"); // 12:00 Sydney (AEST +10)
  assert.equal(practisedToday([A("2026-08-22T01:00:00Z", "recall")], now), true);
  assert.equal(practisedToday([A("2026-08-21T01:00:00Z", "recall")], now), false);
  assert.equal(practisedToday([], now), false);
});

test("practisedToday respects the Sydney midnight boundary", () => {
  // 2026-08-21T15:00Z == 2026-08-22 01:00 Sydney -> counts as the 22nd
  const now = new Date("2026-08-22T02:00:00Z");
  assert.equal(practisedToday([A("2026-08-21T15:00:00Z", "recall")], now), true);
});

test("pickDailyTask returns the first un-started task as 'new'", () => {
  const now = new Date("2026-08-22T02:00:00Z");
  assert.deepEqual(pickDailyTask(CATALOG, [], now), { taskId: "recall", mode: "new" });
  // recall done -> complaint is the next un-started
  const done = [A("2026-08-20T02:00:00Z", "recall", 4, true)];
  assert.deepEqual(pickDailyTask(CATALOG, done, now), { taskId: "complaint", mode: "new" });
});

test("pickDailyTask refreshes the least-recently-practised once all are started", () => {
  const now = new Date("2026-08-22T02:00:00Z");
  const attempts = [
    A("2026-08-18T02:00:00Z", "recall", 4, true),   // older
    A("2026-08-21T02:00:00Z", "complaint", 3, false), // newer
  ];
  assert.deepEqual(pickDailyTask(CATALOG, attempts, now), { taskId: "recall", mode: "refresh" });
});

test("pickDailyTask returns null for an empty catalog", () => {
  assert.equal(pickDailyTask([], [], new Date("2026-08-22T02:00:00Z")), null);
});

test("weeklyStats sums only the current ISO week and excludes the welcome bonus", () => {
  const now = new Date("2026-08-22T02:00:00Z"); // Sat 2026-08-22, ISO week of Mon 08-17
  const attempts = [
    A("2026-08-10T02:00:00Z", "recall", 4, true),   // previous week — excluded
    A("2026-08-18T02:00:00Z", "recall", 4, true),   // this week: +10 showUp +20 checks +10 bonus = 40
    A("2026-08-20T02:00:00Z", "complaint", 2, false), // this week: +10 showUp +10 checks = 20
  ];
  const s = weeklyStats(attempts, now);
  assert.equal(s.activeThisWeek, true);
  assert.equal(s.pointsThisWeek, 60); // 40 + 20, welcome +20 not counted in a weekly bucket
  assert.equal(s.tasksThisWeek, 2);
  assert.equal(typeof s.totalPoints, "number");
  assert.ok("nextLevelName" in s);
});

test("weeklyStats reports a quiet week without failure framing", () => {
  const now = new Date("2026-08-22T02:00:00Z");
  const attempts = [A("2026-08-10T02:00:00Z", "recall", 4, true)]; // only last week
  const s = weeklyStats(attempts, now);
  assert.equal(s.activeThisWeek, false);
  assert.equal(s.pointsThisWeek, 0);
  assert.equal(s.tasksThisWeek, 0);
});

test("alreadySent (daily) dedupes within the same Sydney day", () => {
  const now = new Date("2026-08-22T02:00:00Z");
  assert.equal(alreadySent([{ type: "daily", sentAt: "2026-08-22T00:30:00Z" }], "daily", now), true);
  assert.equal(alreadySent([{ type: "daily", sentAt: "2026-08-21T00:30:00Z" }], "daily", now), false);
  assert.equal(alreadySent([{ type: "weekly", sentAt: "2026-08-22T00:30:00Z" }], "daily", now), false);
  assert.equal(alreadySent([], "daily", now), false);
});

test("alreadySent (weekly) dedupes within the same ISO week", () => {
  const now = new Date("2026-08-22T02:00:00Z");
  assert.equal(alreadySent([{ type: "weekly", sentAt: "2026-08-17T02:00:00Z" }], "weekly", now), true);
  assert.equal(alreadySent([{ type: "weekly", sentAt: "2026-08-10T02:00:00Z" }], "weekly", now), false);
});
