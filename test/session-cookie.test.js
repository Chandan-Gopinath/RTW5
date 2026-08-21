import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeCookie, clearCookie, readCookie, SESSION_COOKIE } from "../lib/session.js";

test("SESSION_COOKIE name", () => assert.equal(SESSION_COOKIE, "ygi_session"));

test("serializeCookie sets flags + max-age", () => {
  const c = serializeCookie("ygi_session", "abc", { days: 30, secure: true });
  assert.match(c, /^ygi_session=abc/);
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Secure/);
  assert.match(c, /Max-Age=2592000/); // 30 days
});

test("serializeCookie omits Secure when secure:false", () => {
  assert.doesNotMatch(serializeCookie("x", "y", { days: 1, secure: false }), /Secure/);
});

test("clearCookie sets Max-Age=0", () => {
  assert.match(clearCookie("ygi_session", { secure: true }), /Max-Age=0/);
});

test("readCookie extracts a value", () => {
  assert.equal(readCookie("a=1; ygi_session=tok; b=2", "ygi_session"), "tok");
  assert.equal(readCookie("", "ygi_session"), null);
  assert.equal(readCookie(undefined, "ygi_session"), null);
});
