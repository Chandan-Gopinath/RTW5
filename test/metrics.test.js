import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, isoWeekKey } from "../lib/metrics.js";

const now = new Date("2026-08-22T02:00:00Z"); // Sat 2026-08-22, 12:00 Sydney
const U = (id, createdAt) => ({ id, createdAt });
const A = (userId, createdAt, attemptNo = 1, passed = false) => ({ userId, createdAt, attemptNo, passed });

test("empty data is safe (no divide-by-zero)", () => {
  const m = computeMetrics([], [], now);
  assert.equal(m.totalUsers, 0);
  assert.equal(m.weeklyAppliedActions, 0);
  assert.equal(m.passRate, null);
  assert.equal(m.activation.rate, null);
  assert.equal(m.weeklyTrend.length, 6);
  assert.equal(m.dailyTrend.length, 14);
});

test("weekly applied actions counts distinct users in the last 7 days", () => {
  const attempts = [
    A("u1", "2026-08-20T02:00:00Z"), // in window
    A("u1", "2026-08-21T02:00:00Z"), // same user, still one
    A("u2", "2026-08-19T02:00:00Z"), // in window
    A("u3", "2026-08-10T02:00:00Z"), // >7 days ago, excluded
  ];
  const m = computeMetrics([], attempts, now);
  assert.equal(m.weeklyAppliedActions, 2);
  assert.equal(m.gradedTasksLast7, 3);
  assert.equal(m.totalGradedTasks, 4);
});

test("activation: first graded task within 3 days of signup, over eligible users", () => {
  const users = [
    U("a", "2026-08-01T00:00:00Z"), // old enough; activated (attempt +1 day)
    U("b", "2026-08-01T00:00:00Z"), // old enough; NOT activated (first attempt +10 days)
    U("c", "2026-08-01T00:00:00Z"), // old enough; never attempted → not activated
    U("d", "2026-08-21T12:00:00Z"), // signed up <3 days ago → not eligible, excluded
  ];
  const attempts = [
    A("a", "2026-08-02T00:00:00Z"),
    A("b", "2026-08-11T00:00:00Z"),
    A("d", "2026-08-21T13:00:00Z"),
  ];
  const m = computeMetrics(users, attempts, now);
  assert.equal(m.activation.eligible, 3); // a, b, c
  assert.equal(m.activation.activated, 1); // only a
  assert.equal(m.activation.rate, 33);
});

test("retry-improvement splits first-try vs later-try pass rates", () => {
  const attempts = [
    A("u1", "2026-08-20T02:00:00Z", 1, false), // first try, fail
    A("u1", "2026-08-20T03:00:00Z", 2, true),  // retry, pass
    A("u2", "2026-08-20T02:00:00Z", 1, true),  // first try, pass
    A("u2", "2026-08-20T03:00:00Z", 2, true),  // retry, pass
  ];
  const m = computeMetrics([], attempts, now);
  assert.equal(m.firstTryPassRate, 50); // 1 of 2 first tries passed
  assert.equal(m.retryPassRate, 100);   // 2 of 2 retries passed
  assert.equal(m.passRate, 75);         // 3 of 4 overall
});

test("weekly trend has 6 buckets, newest last, counting distinct users", () => {
  const attempts = [
    A("u1", "2026-08-18T02:00:00Z"), // this week (Mon 08-17)
    A("u2", "2026-08-19T02:00:00Z"), // this week
    A("u1", "2026-08-11T02:00:00Z"), // previous week
  ];
  const m = computeMetrics([], attempts, now);
  assert.equal(m.weeklyTrend.length, 6);
  const thisWeek = m.weeklyTrend[5];
  const prevWeek = m.weeklyTrend[4];
  assert.equal(thisWeek.week, isoWeekKey("2026-08-22"));
  assert.equal(thisWeek.users, 2);
  assert.equal(prevWeek.users, 1);
});

test("daily trend has 14 buckets, newest last, distinct users per Sydney day", () => {
  const attempts = [
    A("u1", "2026-08-22T02:00:00Z"), // today (Sydney)
    A("u2", "2026-08-22T05:00:00Z"), // today, different user
    A("u1", "2026-08-22T06:00:00Z"), // today, same user → still distinct = {u1,u2}
    A("u3", "2026-08-20T02:00:00Z"), // 2 days ago
    A("u4", "2026-07-01T02:00:00Z"), // outside the 14-day window
  ];
  const m = computeMetrics([], attempts, now);
  assert.equal(m.dailyTrend.length, 14);
  const today = m.dailyTrend[13];
  assert.equal(today.day, "2026-08-22");
  assert.equal(today.label, "22/08");
  assert.equal(today.users, 2);
  const twoDaysAgo = m.dailyTrend[11];
  assert.equal(twoDaysAgo.day, "2026-08-20");
  assert.equal(twoDaysAgo.users, 1);
});
