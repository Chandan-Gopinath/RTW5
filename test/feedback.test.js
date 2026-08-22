import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFeedback, MAX_MESSAGE } from "../lib/feedback.js";

test("accepts a thumbs-up with no note", () => {
  const r = normalizeFeedback({ context: "grade:recall", rating: "up" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { context: "grade:recall", rating: "up", message: null });
});

test("accepts a thumbs-down with a note", () => {
  const r = normalizeFeedback({ context: "menu", rating: "DOWN", message: "  too slow  " });
  assert.equal(r.ok, true);
  assert.equal(r.value.rating, "down"); // lower-cased
  assert.equal(r.value.message, "too slow"); // trimmed
});

test("accepts a note-only submission (no rating)", () => {
  const r = normalizeFeedback({ context: "menu", message: "love it" });
  assert.equal(r.ok, true);
  assert.equal(r.value.rating, null);
  assert.equal(r.value.message, "love it");
});

test("rejects an empty submission (no rating, no note)", () => {
  assert.deepEqual(normalizeFeedback({ context: "menu", message: "   " }), { ok: false, error: "empty" });
  assert.deepEqual(normalizeFeedback({}), { ok: false, error: "empty" });
});

test("rejects a bad rating value", () => {
  assert.deepEqual(normalizeFeedback({ rating: "meh", message: "x" }), { ok: false, error: "bad_rating" });
});

test("caps an over-length message", () => {
  const long = "a".repeat(MAX_MESSAGE + 500);
  const r = normalizeFeedback({ rating: "up", message: long });
  assert.equal(r.ok, true);
  assert.equal(r.value.message.length, MAX_MESSAGE);
});

test("defaults a missing context to 'unknown' and caps a long one", () => {
  assert.equal(normalizeFeedback({ rating: "up" }).value.context, "unknown");
  const longCtx = "c".repeat(200);
  assert.equal(normalizeFeedback({ rating: "up", context: longCtx }).value.context.length, 100);
});
