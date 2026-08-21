import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, isValidEmail, isAdmin } from "../lib/auth-helpers.js";

test("normalizeEmail lowercases + trims", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
  assert.equal(normalizeEmail(null), "");
});

test("isValidEmail", () => {
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("nope"), false);
  assert.equal(isValidEmail("a@b"), false);
});

test("isAdmin matches the allowlist case-insensitively", () => {
  const env = "Admin@Clinic.com, other@x.io";
  assert.equal(isAdmin("admin@clinic.com", env), true);
  assert.equal(isAdmin("someone@clinic.com", env), false);
  assert.equal(isAdmin("admin@clinic.com", ""), false);
});
