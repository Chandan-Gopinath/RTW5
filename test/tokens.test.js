import { test } from "node:test";
import assert from "node:assert/strict";
import { generateToken, hashToken, isExpired } from "../lib/tokens.js";

test("generateToken: url-safe, >=43 chars, unique", () => {
  const a = generateToken(), b = generateToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(a.length >= 43);
});

test("hashToken: deterministic sha256 hex, not the input", () => {
  assert.equal(hashToken("abc"), hashToken("abc"));
  assert.notEqual(hashToken("abc"), "abc");
  assert.match(hashToken("abc"), /^[0-9a-f]{64}$/);
});

test("isExpired: true past, false future", () => {
  assert.equal(isExpired(new Date(Date.now() - 1000)), true);
  assert.equal(isExpired(new Date(Date.now() + 10000)), false);
});
