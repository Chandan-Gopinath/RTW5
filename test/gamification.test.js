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
