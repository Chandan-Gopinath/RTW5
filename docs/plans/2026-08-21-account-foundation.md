# Account Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `localStorage` sign-in with real, server-backed accounts using passwordless email magic-link auth, Neon Postgres, and httpOnly sessions.

**Architecture:** Vercel serverless functions under `api/auth/*` back a magic-link flow: request a link → Brevo emails it → verify creates a user + session → an httpOnly cookie persists the session (~30 days). Pure logic (tokens, cookies, email/admin checks) lives in small `lib/*` modules; the DB is Neon Postgres via the `@neondatabase/serverless` HTTP driver + Drizzle ORM.

**Tech Stack:** Node 24 (ESM), Drizzle ORM + drizzle-kit, `@neondatabase/serverless`, Brevo transactional email API, Vercel serverless functions + local Express (`server.js`). Tests use Node's built-in runner (`node --test`, `node:test`) — no new test dependency.

**Spec:** `docs/specs/2026-08-21-account-foundation.md`

## Global Constraints

- ESM only (`import`/`export`); repo `package.json` has `"type": "module"`.
- Secrets are server-only env vars, never sent to the browser and never hardcoded: `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_SENDER`, `ADMIN_EMAILS`, `APP_URL`, optional `SESSION_DAYS` (default 30), optional `DEV_ECHO_LINK` (dev only).
- Tokens (magic + session) are 32 random bytes, stored **only as sha256 hashes**; magic tokens are single-use with 15-min expiry.
- Session cookie name is `ygi_session`; flags HttpOnly, Secure (prod), SameSite=Lax, Path=/.
- No account enumeration: `/api/auth/request` always responds `{ ok: true }`.
- Follow existing code style (2-space indent, ESM, small focused modules, comments matching the surrounding files).
- Tests live in `test/`; run with `node --test`.

---

### Task 1: Dependencies, Drizzle config, DB schema

**Files:**
- Modify: `package.json` (add deps + scripts)
- Create: `lib/db.js`
- Create: `drizzle.config.js`
- Create: `.env.example` (document new vars) — modify if it exists

**Interfaces:**
- Produces: `db()` → Drizzle client; table objects `users`, `magicTokens`, `sessions` (exported from `lib/db.js`).

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

- [ ] **Step 2: Create `lib/db.js`**

```js
// Neon Postgres client + Drizzle schema. The Neon HTTP driver is used so
// serverless functions don't exhaust Postgres connections on Vercel.
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
});

export const magicTokens = pgTable("magic_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

let _db;
export function db() {
  if (!_db) _db = drizzle(neon(process.env.DATABASE_URL), { schema: { users, magicTokens, sessions } });
  return _db;
}
```

- [ ] **Step 3: Create `drizzle.config.js`**

```js
export default {
  schema: "./lib/db.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
};
```

- [ ] **Step 4: Add scripts to `package.json`**

Add to the `"scripts"` block:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"test": "node --test"
```

- [ ] **Step 5: Document env vars in `.env.example`**

Append (create the file if missing):
```
DATABASE_URL=postgres://...            # Neon pooled connection string
BREVO_API_KEY=...                      # Brevo transactional API key
BREVO_SENDER=noreply@yourdomain.com    # verified Brevo sender address
ADMIN_EMAILS=you@example.com           # comma-separated admin allowlist
APP_URL=https://you-got-it.vercel.app  # absolute base for magic-link URLs
SESSION_DAYS=30                        # optional session length
DEV_ECHO_LINK=1                        # dev only: log the magic link instead of emailing
```

- [ ] **Step 6: Verify the schema module loads**

Run:
```bash
node -e "import('./lib/db.js').then(m=>console.log(Object.keys(m)))"
```
Expected: prints `[ 'users', 'magicTokens', 'sessions', 'db' ]` with no error. (No DB connection is made until `db()` is called.)

- [ ] **Step 7: Generate the migration SQL**

Run:
```bash
DATABASE_URL=postgres://placeholder npm run db:generate
```
Expected: a `drizzle/0000_*.sql` file is created containing `CREATE TABLE "users" ...`, `"magic_tokens"`, `"sessions"`. (Generation reads the schema, not the DB, so a placeholder URL is fine.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/db.js drizzle.config.js drizzle/ .env.example
git commit -m "feat(auth): add Drizzle schema, Neon client, and env docs"
```

---

### Task 2: Token utilities (TDD)

**Files:**
- Create: `lib/tokens.js`
- Test: `test/tokens.test.js`

**Interfaces:**
- Produces: `generateToken(): string`, `hashToken(token: string): string` (64-char hex), `isExpired(date: Date|string, now?: Date): boolean`.

- [ ] **Step 1: Write the failing test**

`test/tokens.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/tokens.test.js`
Expected: FAIL (cannot find module `../lib/tokens.js`).

- [ ] **Step 3: Write minimal implementation**

`lib/tokens.js`:
```js
import { randomBytes, createHash } from "node:crypto";

export function generateToken() {
  return randomBytes(32).toString("base64url");
}
export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}
export function isExpired(date, now = new Date()) {
  return new Date(date).getTime() <= now.getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/tokens.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tokens.js test/tokens.test.js
git commit -m "feat(auth): token generation, hashing, expiry helpers"
```

---

### Task 3: Email + admin helpers (TDD)

**Files:**
- Create: `lib/auth-helpers.js`
- Test: `test/auth-helpers.test.js`

**Interfaces:**
- Produces: `normalizeEmail(email): string`, `isValidEmail(email): boolean`, `isAdmin(email, adminEmailsEnv?): boolean`.

- [ ] **Step 1: Write the failing test**

`test/auth-helpers.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/auth-helpers.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

`lib/auth-helpers.js`:
```js
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}
export function isAdmin(email, adminEmailsEnv = process.env.ADMIN_EMAILS || "") {
  const list = String(adminEmailsEnv).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(normalizeEmail(email));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/auth-helpers.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth-helpers.js test/auth-helpers.test.js
git commit -m "feat(auth): email normalization/validation + admin allowlist check"
```

---

### Task 4: Session cookie helpers (TDD)

**Files:**
- Create: `lib/session.js`
- Test: `test/session-cookie.test.js`

**Interfaces:**
- Produces: `SESSION_COOKIE = "ygi_session"`, `serializeCookie(name, value, { days, secure }): string`, `clearCookie(name, { secure }): string`, `readCookie(cookieHeader, name): string|null`.

- [ ] **Step 1: Write the failing test**

`test/session-cookie.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/session-cookie.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation (cookie helpers only)**

`lib/session.js`:
```js
// Session cookie helpers (pure) + DB-backed session lifecycle (added in Task 5).
export const SESSION_COOKIE = "ygi_session";

export function serializeCookie(name, value, { days = 30, secure = true } = {}) {
  const maxAge = Math.floor(days * 24 * 60 * 60);
  const parts = [`${name}=${value}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name, { secure = true } = {}) {
  const parts = [`${name}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(cookieHeader, name) {
  const m = String(cookieHeader || "").match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/session-cookie.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/session.js test/session-cookie.test.js
git commit -m "feat(auth): session cookie serialize/clear/read helpers"
```

---

### Task 5: Session DB lifecycle

**Files:**
- Modify: `lib/session.js` (append DB helpers)

**Interfaces:**
- Consumes: `db()`, `sessions`, `users` from `lib/db.js`; `generateToken`, `hashToken` from `lib/tokens.js`.
- Produces: `createSession(userId, days?): Promise<{ token, expiresAt }>`, `getUserFromToken(token): Promise<user|null>`, `destroySession(token): Promise<void>`.

- [ ] **Step 1: Append DB helpers to `lib/session.js`**

Add these imports at the top of `lib/session.js` (above the existing exports):
```js
import { db, sessions, users } from "./db.js";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "./tokens.js";
```

Append at the end of `lib/session.js`:
```js
export async function createSession(userId, days = Number(process.env.SESSION_DAYS) || 30) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + days * 864e5);
  await db().insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserFromToken(token) {
  if (!token) return null;
  const s = (await db().select().from(sessions).where(eq(sessions.tokenHash, hashToken(token))))[0];
  if (!s || new Date(s.expiresAt) <= new Date()) return null;
  return (await db().select().from(users).where(eq(users.id, s.userId)))[0] || null;
}

export async function destroySession(token) {
  if (!token) return;
  await db().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
```

- [ ] **Step 2: Verify the module still imports (no DB connection yet)**

Run:
```bash
node -e "import('./lib/session.js').then(m=>console.log(Object.keys(m)))"
```
Expected: prints the exported names including `createSession`, `getUserFromToken`, `destroySession`, `serializeCookie`, `readCookie`, `SESSION_COOKIE` — no error. (These functions connect to the DB only when called; verified end-to-end in Task 13.)

- [ ] **Step 3: Commit**

```bash
git add lib/session.js
git commit -m "feat(auth): DB-backed session create/lookup/destroy"
```

---

### Task 6: Magic-link email sender

**Files:**
- Create: `lib/email.js`
- Test: `test/email.test.js`

**Interfaces:**
- Produces: `sendMagicLink(email, link): Promise<{ echoed: boolean, link? }>`. In dev (`DEV_ECHO_LINK=1`) it logs + returns the link instead of sending.

- [ ] **Step 1: Write the failing test (dev-echo branch)**

`test/email.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("sendMagicLink echoes in dev mode without sending", async () => {
  process.env.DEV_ECHO_LINK = "1";
  const { sendMagicLink } = await import("../lib/email.js");
  const out = await sendMagicLink("a@b.co", "https://x/verify?token=t");
  assert.equal(out.echoed, true);
  assert.equal(out.link, "https://x/verify?token=t");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/email.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

`lib/email.js`:
```js
// Sends the magic-link email via Brevo's transactional API.
// DEV_ECHO_LINK=1 skips sending and returns the link so the flow is testable
// locally without an inbox.
export async function sendMagicLink(email, link) {
  if (process.env.DEV_ECHO_LINK === "1") {
    console.log("[dev] magic link for", email, "->", link);
    return { echoed: true, link };
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER, name: "You Got It!" },
      to: [{ email }],
      subject: "Your You Got It! sign-in link",
      htmlContent:
        `<p>Tap to sign in to You Got It!:</p>` +
        `<p><a href="${link}">Sign in</a></p>` +
        `<p>This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Brevo error ${res.status}: ${await res.text()}`);
  return { echoed: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/email.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/email.js test/email.test.js
git commit -m "feat(auth): Brevo magic-link email sender with dev-echo mode"
```

---

### Task 7: `POST /api/auth/request`

**Files:**
- Create: `api/auth/request.js`

**Interfaces:**
- Consumes: `db()`, `magicTokens` (lib/db.js); `normalizeEmail`, `isValidEmail` (lib/auth-helpers.js); `generateToken`, `hashToken` (lib/tokens.js); `sendMagicLink` (lib/email.js).
- Produces: HTTP `POST /api/auth/request { email, name }` → always `{ ok: true }` (no enumeration). Side effects: inserts a magic token, emails the link.

- [ ] **Step 1: Write the handler**

`api/auth/request.js`:
```js
// POST /api/auth/request { email, name } -> { ok: true } (always; no enumeration)
import { db, magicTokens } from "../../lib/db.js";
import { normalizeEmail, isValidEmail } from "../../lib/auth-helpers.js";
import { generateToken, hashToken } from "../../lib/tokens.js";
import { sendMagicLink } from "../../lib/email.js";
import { and, eq, gt, isNull } from "drizzle-orm";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || "").trim();
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });

  // Rate-limit / anti-bombing: at most 5 outstanding (unused, unexpired) links per email.
  const active = await db().select().from(magicTokens).where(
    and(eq(magicTokens.email, email), gt(magicTokens.expiresAt, new Date()), isNull(magicTokens.usedAt))
  );
  if (active.length >= 5) return res.json({ ok: true });

  const token = generateToken();
  await db().insert(magicTokens).values({
    tokenHash: hashToken(token),
    email,
    name: name || null,
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });

  const base = process.env.APP_URL || `https://${req.headers.host}`;
  const link = `${base}/api/auth/verify?token=${token}`;
  try { await sendMagicLink(email, link); } catch (e) { console.error("magic-link email failed:", e?.message || e); }

  res.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/auth/request.js
git commit -m "feat(auth): POST /api/auth/request issues + emails a magic link"
```

_(End-to-end verification of this endpoint happens in Task 13 with a live DB + DEV_ECHO.)_

---

### Task 8: `GET /api/auth/verify`

**Files:**
- Create: `api/auth/verify.js`

**Interfaces:**
- Consumes: `db()`, `magicTokens`, `users` (lib/db.js); `hashToken` (lib/tokens.js); `createSession`, `serializeCookie`, `SESSION_COOKIE` (lib/session.js).
- Produces: HTTP `GET /api/auth/verify?token=…` → 302 redirect to `/dashboard.html` with a session cookie, or a 400 message.

- [ ] **Step 1: Write the handler**

`api/auth/verify.js`:
```js
// GET /api/auth/verify?token=... -> validates the magic token, upserts the user,
// creates a session, sets the cookie, redirects to the dashboard.
import { db, magicTokens, users } from "../../lib/db.js";
import { hashToken } from "../../lib/tokens.js";
import { createSession, serializeCookie, SESSION_COOKIE } from "../../lib/session.js";
import { eq } from "drizzle-orm";

export default async function handler(req, res) {
  const token = req.query?.token;
  if (!token) return res.status(400).send("Missing token.");
  const th = hashToken(token);

  const mt = (await db().select().from(magicTokens).where(eq(magicTokens.tokenHash, th)))[0];
  if (!mt || mt.usedAt || new Date(mt.expiresAt) <= new Date()) {
    return res.status(400).send("This sign-in link is invalid or has expired. Please request a new one.");
  }
  await db().update(magicTokens).set({ usedAt: new Date() }).where(eq(magicTokens.tokenHash, th));

  let user = (await db().select().from(users).where(eq(users.email, mt.email)))[0];
  if (!user) {
    user = (await db().insert(users).values({
      email: mt.email,
      name: mt.name || mt.email.split("@")[0],
    }).returning())[0];
  }
  await db().update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));

  const { token: sessionToken } = await createSession(user.id);
  const secure = process.env.NODE_ENV !== "development";
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, sessionToken, {
    days: Number(process.env.SESSION_DAYS) || 30,
    secure,
  }));
  res.writeHead(302, { Location: "/dashboard.html" });
  res.end();
}
```

- [ ] **Step 2: Commit**

```bash
git add api/auth/verify.js
git commit -m "feat(auth): GET /api/auth/verify creates user + session, sets cookie"
```

---

### Task 9: `GET /api/auth/me` and `POST /api/auth/signout`

**Files:**
- Create: `api/auth/me.js`
- Create: `api/auth/signout.js`

**Interfaces:**
- Consumes: `getUserFromToken`, `destroySession`, `readCookie`, `clearCookie`, `SESSION_COOKIE` (lib/session.js); `isAdmin` (lib/auth-helpers.js).
- Produces: `GET /api/auth/me` → `{ user: { name, email, isAdmin } }` or 401. `POST /api/auth/signout` → `{ ok: true }`, clears the cookie.

- [ ] **Step 1: Write `api/auth/me.js`**

```js
// GET /api/auth/me -> { user: { name, email, isAdmin } } | 401
import { getUserFromToken, readCookie, SESSION_COOKIE } from "../../lib/session.js";
import { isAdmin } from "../../lib/auth-helpers.js";

export default async function handler(req, res) {
  const user = await getUserFromToken(readCookie(req.headers.cookie, SESSION_COOKIE));
  if (!user) return res.status(401).json({ error: "unauthenticated" });
  res.json({ user: { name: user.name, email: user.email, isAdmin: isAdmin(user.email) } });
}
```

- [ ] **Step 2: Write `api/auth/signout.js`**

```js
// POST /api/auth/signout -> clears the session
import { destroySession, readCookie, clearCookie, SESSION_COOKIE } from "../../lib/session.js";

export default async function handler(req, res) {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  await destroySession(token);
  const secure = process.env.NODE_ENV !== "development";
  res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE, { secure }));
  res.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add api/auth/me.js api/auth/signout.js
git commit -m "feat(auth): /api/auth/me session check + /api/auth/signout"
```

---

### Task 10: Mount auth routes in the local dev server

**Files:**
- Modify: `server.js`

**Interfaces:**
- Consumes: the four `api/auth/*` default-export handlers (Express-compatible signatures).

- [ ] **Step 1: Import the handlers**

Add near the top of `server.js` (after the existing imports):
```js
import authRequest from "./api/auth/request.js";
import authVerify from "./api/auth/verify.js";
import authMe from "./api/auth/me.js";
import authSignout from "./api/auth/signout.js";
```

- [ ] **Step 2: Register the routes**

Add after the existing `app.use(express.static(...))` line:
```js
app.post("/api/auth/request", (req, res) => authRequest(req, res));
app.get("/api/auth/verify", (req, res) => authVerify(req, res));
app.get("/api/auth/me", (req, res) => authMe(req, res));
app.post("/api/auth/signout", (req, res) => authSignout(req, res));
```

- [ ] **Step 3: Verify the server boots**

Run:
```bash
DEV_ECHO_LINK=1 node -e "import('./server.js').then(()=>setTimeout(()=>process.exit(0),500))" 2>&1 | head -5
```
Expected: prints the "You Got It! running…" banner with no import/route errors. (Full flow tested in Task 13.)

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(auth): mount auth routes in local dev server"
```

---

### Task 11: Email sign-in page

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `POST /api/auth/request`.

- [ ] **Step 1: Replace the name+code form with an email form**

In `index.html`, replace the existing sign-in form markup with an email + name form. Keep the page's existing layout/classes; the functional core is:
```html
<form id="signinForm" novalidate>
  <label class="field">
    <span class="field__label">Your name</span>
    <input class="input" id="nameInput" name="name" type="text" autocomplete="name" placeholder="Alex" required>
  </label>
  <label class="field">
    <span class="field__label">Email</span>
    <input class="input" id="emailInput" name="email" type="email" autocomplete="email" placeholder="you@clinic.com" required>
  </label>
  <button type="submit" class="btn btn--primary btn--block" data-event="Signin">Email me a sign-in link →</button>
  <p class="field__hint" id="signinStatus" hidden></p>
</form>
```

- [ ] **Step 2: Wire the form + email pre-fill**

Add this inline script before `</body>` (adjust the existing script if one is present):
```html
<script>
  const form = document.getElementById('signinForm');
  const emailInput = document.getElementById('emailInput');
  const nameInput = document.getElementById('nameInput');
  const status = document.getElementById('signinStatus');
  // pre-fill last-used email/name for returning users
  emailInput.value = localStorage.getItem('ygiLastEmail') || '';
  nameInput.value = localStorage.getItem('ygiLastName') || '';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const name = nameInput.value.trim();
    if (!email || !name) return;
    localStorage.setItem('ygiLastEmail', email);
    localStorage.setItem('ygiLastName', name);
    status.hidden = false;
    status.textContent = 'Sending…';
    try {
      await fetch('/api/auth/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
    } catch (_) {}
    status.textContent = 'Check your email for a sign-in link. It expires in 15 minutes.';
    if (window.track) window.track('Signin');
  });
</script>
```

- [ ] **Step 3: Verify the page renders (visual)**

Start the server (`DEV_ECHO_LINK=1 GEMINI_API_KEY= node server.js`), open `http://localhost:8123/`, confirm the email + name fields render and the email field pre-fills after one submit + reload. (No real email sent — link is echoed to the server console.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(auth): email magic-link sign-in page with last-email pre-fill"
```

---

### Task 12: Session-based auth guard in `auth.js`

**Files:**
- Modify: `auth.js`

**Interfaces:**
- Consumes: `GET /api/auth/me`, `POST /api/auth/signout`.
- Produces: `ygiRequireProfile(): Promise<user|null>` (async) — populates topbar chrome, wires sign-out, redirects to `index.html` when unauthenticated. Replaces the localStorage profile functions.

- [ ] **Step 1: Replace `auth.js` contents**

```js
// Real server-session auth for the You Got It! app pages. Replaces the old
// localStorage "fake profile". Pages call ygiRequireProfile() on load.
async function ygiRequireProfile() {
  let user;
  try {
    const r = await fetch("/api/auth/me");
    if (!r.ok) throw new Error("unauthenticated");
    ({ user } = await r.json());
  } catch (_) {
    window.location.href = "index.html";
    return null;
  }
  const initial = (user.name || "?").charAt(0).toUpperCase();
  document.querySelectorAll(".name").forEach((el) => { el.textContent = `Welcome, ${user.name}`; });
  document.querySelectorAll(".avatar").forEach((el) => { el.textContent = initial; });
  document.querySelectorAll(".user-menu__head strong").forEach((el) => { el.textContent = user.name; });
  document.querySelectorAll("[data-profile-name]").forEach((el) => { el.textContent = user.name; });

  const signOut = document.getElementById("signOutBtn");
  if (signOut) signOut.addEventListener("click", async (e) => {
    e.preventDefault();
    if (window.track) window.track("Sign Out");
    try { await fetch("/api/auth/signout", { method: "POST" }); } catch (_) {}
    window.location.href = "index.html";
  });

  return user;
}
```

- [ ] **Step 2: Verify no page still relies on the removed sync API**

Run:
```bash
grep -rn "ygiSaveProfile\|ygiGetProfile\|ygiClearProfile" --include=*.html --include=*.js .
```
Expected: no matches (the old helpers are gone and nothing references them). If any appear, remove/adjust those call sites.

- [ ] **Step 3: Commit**

```bash
git add auth.js
git commit -m "feat(auth): session-based auth guard replacing localStorage profile"
```

---

### Task 13: Migrate, wire env, and verify end-to-end

**Files:** none (setup + verification)

**Interfaces:** exercises the whole flow.

- [ ] **Step 1: User creates external resources (out-of-band)**

The user (not the agent) creates a **Neon** project and a **Brevo** account, verifies a Brevo sender, and sets these locally (a `.env`/exports) and in **Vercel → Settings → Environment Variables**: `DATABASE_URL`, `BREVO_API_KEY`, `BREVO_SENDER`, `ADMIN_EMAILS`, `APP_URL`. The agent never handles these values.

- [ ] **Step 2: Apply the migration to Neon**

Run:
```bash
DATABASE_URL="<neon-url>" npm run db:migrate
```
Expected: the three tables are created on Neon (no errors). Verify with:
```bash
DATABASE_URL="<neon-url>" node -e "import('./lib/db.js').then(async ({db,users})=>{console.log(await db().select().from(users)); process.exit(0)})"
```
Expected: prints `[]` (empty users table) — confirms connectivity + schema.

- [ ] **Step 3: Run the full unit-test suite**

Run: `node --test`
Expected: all tests pass (tokens, auth-helpers, session-cookie, email).

- [ ] **Step 4: Local end-to-end via DEV_ECHO**

Start: `DEV_ECHO_LINK=1 DATABASE_URL="<neon-url>" ADMIN_EMAILS="you@example.com" node server.js`
Then:
```bash
# request a link
curl -s -X POST http://localhost:8123/api/auth/request -H 'Content-Type: application/json' -d '{"email":"you@example.com","name":"You"}'
# -> {"ok":true}; the server console logs: [dev] magic link for you@example.com -> http://localhost:8123/api/auth/verify?token=XYZ
# verify (use the echoed token), following redirects and saving the cookie:
curl -s -i "http://localhost:8123/api/auth/verify?token=XYZ" -c cookies.txt | head -20
# -> 302 to /dashboard.html, Set-Cookie: ygi_session=...
# session check:
curl -s http://localhost:8123/api/auth/me -b cookies.txt
# -> {"user":{"name":"You","email":"you@example.com","isAdmin":true}}
# sign out:
curl -s -X POST http://localhost:8123/api/auth/signout -b cookies.txt -c cookies.txt
curl -s http://localhost:8123/api/auth/me -b cookies.txt
# -> 401 {"error":"unauthenticated"}
```
Expected: each step matches the commented result. Confirm `isAdmin:true` for the allowlisted email and `false` for a different email. Confirm a reused or expired token returns the 400 message.

- [ ] **Step 5: Browser smoke (local)**

With the server running, open `http://localhost:8123/`, submit name+email, copy the echoed link from the console into the browser → lands on the dashboard showing "Welcome, <name>". Reload the dashboard → still signed in (session persists). Sign out → redirected to sign-in; the email field is pre-filled.

- [ ] **Step 6: Live smoke (after Vercel env vars set + deploy)**

Push to `main`; once deployed, at `https://you-got-it.vercel.app/` enter your real email, receive the Brevo email, click the link → dashboard. Confirm the admin email shows `isAdmin:true` via `/api/auth/me`.

- [ ] **Step 7: Commit any final docs/tweaks**

```bash
git add -A
git commit -m "chore(auth): finalize account foundation (migration + env verified)"
```

---

## Self-Review

**Spec coverage:**
- Neon + Drizzle schema (users/magic_tokens/sessions) → Task 1. ✓
- Magic-link request/verify/me/signout → Tasks 7–9. ✓
- Sessions (httpOnly cookie, hashed, revocable, sliding/persistent) → Tasks 4–5, 8. ✓
- Admin allowlist (`isAdmin`) → Task 3, surfaced in Task 9. ✓
- Email via Brevo + `DEV_ECHO_LINK` → Task 6. ✓
- Rate-limit + no-enumeration → Task 7. ✓
- Email up front + last-email pre-fill + `autocomplete=email` → Task 11. ✓
- Session-guard replacing localStorage → Task 12. ✓
- Env vars + migration + external setup → Tasks 1, 13. ✓
- Security (hashed tokens, single-use, expiry, cookie flags) → Tasks 2, 4, 6, 7, 8. ✓

**Placeholder scan:** none — every step has concrete code or exact commands.

**Type consistency:** `hashToken`, `generateToken`, `serializeCookie`/`clearCookie`/`readCookie`, `SESSION_COOKIE`, `createSession`/`getUserFromToken`/`destroySession`, `normalizeEmail`/`isValidEmail`/`isAdmin`, `db`/`users`/`magicTokens`/`sessions`, `sendMagicLink` — names/signatures match across producing and consuming tasks. ✓

**Note:** attempts recording, admin-panel gating + users view, the reminder engine, gamification, and success-metrics are intentionally **out of scope** (separate sub-projects, per the spec).
