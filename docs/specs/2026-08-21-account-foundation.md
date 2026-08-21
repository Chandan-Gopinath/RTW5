# Spec — Account Foundation (DB + magic-link auth)

_Date: 2026-08-21 · Status: draft for review · Repo: RTW5 (“You Got It!”)_

## 1. Goal & scope

Replace the fake per-device `localStorage` sign-in with **real, server-backed accounts**, so that:

- the same person is one record across devices,
- we capture **email** (the re-engagement channel for daily/weekly reminders),
- there is a real **admin** identity we can later gate the admin panel to.

This is the **Foundation** sub-project only. It is the prerequisite for everything else in the DB milestone.

**In scope**
- Neon Postgres + Drizzle (schema + migrations).
- Email **magic-link** auth (passwordless), prompted **up front** before the first task.
- Server sessions (httpOnly cookie), real auth guard replacing the `localStorage` guard.
- Email capture + name.
- An `isAdmin` check via an env allowlist (used later to gate the admin panel).

**Explicitly out of scope (later sub-projects)**
- Recording graded **attempts** / per-user history.
- **Admin** panel gating + users view + server-side global model switch.
- **Gamification** (points/streaks/leaderboard).
- The **reminder engine** (daily “today’s task” / weekly “how you did”) — needs a scheduler; separate sub-project. Foundation just sets up the Brevo integration used to send the login email.
- **Try-first-then-capture** day-one-win flow — deferred; email is up front for now (fast follow-up later).
- Migrating existing fake `localStorage` profiles — we start fresh (prototype test data).

## 2. Stack & new dependencies

- **DB:** Neon Postgres (serverless; free tier; native Vercel integration).
- **Access:** `@neondatabase/serverless` (HTTP driver — avoids connection exhaustion on Vercel serverless) + **Drizzle ORM** (`drizzle-orm`, `drizzle-kit` for migrations).
- **Email:** Brevo transactional API (`POST https://api.brevo.com/v3/smtp/email`, header `api-key`).
- **Sessions:** opaque random token stored (hashed) in a `sessions` table; raw token in an httpOnly cookie.

## 3. Data model (Drizzle schema)

```
users
  id            uuid pk default gen_random_uuid()
  email         text unique not null            -- lowercased
  name          text not null
  created_at    timestamptz not null default now()
  last_active_at timestamptz

magic_tokens
  token_hash    text pk                          -- sha256 of the emailed token
  email         text not null                    -- lowercased
  name          text                             -- carried for first-time signup
  expires_at    timestamptz not null             -- ~15 min
  used_at       timestamptz

sessions
  token_hash    text pk                          -- sha256 of the cookie token
  user_id       uuid not null references users(id) on delete cascade
  created_at    timestamptz not null default now()
  expires_at    timestamptz not null             -- ~30 days, sliding
```

Notes:
- Tokens are random 32-byte values; only their **sha256 hash** is stored, so a DB leak never exposes a live login link or session.
- `email` stored lowercased; uniqueness is case-insensitive in effect.

## 4. Auth flow (magic link, email up front)

1. **Request** — `index.html` collects email (+ name on first visit). `POST /api/auth/request { email, name }`:
   - validate email format; rate-limit per email + per IP (see §8).
   - create a random token; store its hash in `magic_tokens` with `expires_at = now()+15m` and the supplied `name`.
   - send the email via Brevo with a link: `${APP_URL}/api/auth/verify?token=<rawToken>`.
   - respond 200 regardless of whether the email is known (no account enumeration) — “Check your email.”
2. **Verify** — `GET /api/auth/verify?token=…`:
   - hash token, look up `magic_tokens`; reject if missing / expired / already used.
   - mark `used_at`.
   - **find-or-create** the user by email (use the token’s `name` for new users); update `last_active_at`.
   - create a session (random token, store hash, `expires_at = now()+30d`), set httpOnly cookie.
   - redirect to `dashboard.html`.
3. **Session check** — `GET /api/auth/me` returns `{ user: { name, email, isAdmin } }` or 401. The app’s auth guard calls this on load; on 401 redirect to `index.html`.
4. **Sign out** — `POST /api/auth/signout` deletes the session row + clears the cookie.

## 5. Sessions

- Cookie: `ygi_session`, value = raw session token; flags **HttpOnly, Secure, SameSite=Lax, Path=/**, ~30-day max-age.
- Server looks up `sha256(cookie)` in `sessions`; expired/absent ⇒ unauthenticated.
- **Sliding expiry / persistence:** on activity, extend `expires_at` (bounded). This is the returning-user experience — a signed-in user skips the email/magic-link step on every return visit within the window and lands straight on the dashboard. Duration is a single tunable (`SESSION_DAYS`, default 30; can raise to 60–90 so re-auth is rare).
- Revocable (delete row = instant logout).

## 6. Admin

- Env `ADMIN_EMAILS` = comma-separated allowlist. `isAdmin = ADMIN_EMAILS.includes(user.email)`.
- No in-app promotion path (can’t be abused). Foundation only **exposes** `isAdmin` via `/api/auth/me`; gating UI comes with the Admin sub-project.

## 7. API & frontend changes

**New:**
- `lib/db.js` — Neon client + Drizzle schema + helpers.
- `lib/email.js` — `sendMagicLink(email, link)` via Brevo.
- `lib/session.js` — create/read/destroy session; `getUser(req)`.
- `api/auth/request.js`, `api/auth/verify.js`, `api/auth/me.js`, `api/auth/signout.js`.
- `drizzle.config.js` + `drizzle/` migrations.

**Changed:**
- `index.html` — email-entry sign-in (name + email) replacing name + 4-digit code. **Pre-fills the email field** with the last-used email (saved in `localStorage` on submit) plus `autocomplete="email"` for native browser autofill, so returning users who *do* need a fresh link don't retype it.
- `auth.js` — replace `localStorage` profile with a `/api/auth/me` session check; populate the topbar name/avatar from the response; wire real sign-out. Sign-out clears the session; the pre-fill email is **kept** (personal-device convenience) — flip to clear-on-sign-out if shared-device use becomes a concern.
- `server.js` — mount the new auth routes for local dev.
- The existing `data-event="Signup"/"Signin"/"Sign Out"` analytics stay meaningful (fired on the real flow now).

## 8. Security

- Magic tokens: 32 random bytes, **single-use**, 15-min expiry, stored **hashed**.
- Sessions: opaque, stored **hashed**, HttpOnly/Secure/SameSite=Lax, revocable.
- **Rate-limiting** `/api/auth/request`: throttle per email and per IP (e.g. ≤5/hour/email) to prevent email bombing. Simple DB-counter or timestamp check (no Redis needed at this scale).
- **No account enumeration**: identical response whether or not the email exists.
- No passwords stored anywhere. Email is the only PII; collect nothing else.
- Brevo API key + `DATABASE_URL` are server-only env vars (never sent to the browser). I never handle these — the user sets them in Vercel + locally.

## 9. Environment & external setup (user actions)

The user creates these accounts and sets env vars (locally + in Vercel); I never see the values:
- **Neon** → `DATABASE_URL` (pooled connection string).
- **Brevo** → `BREVO_API_KEY`, and **verify a sender** → `BREVO_SENDER` (verified from-address).
- `ADMIN_EMAILS` = the user’s email.
- `APP_URL` = `https://you-got-it.vercel.app` (to build absolute magic-link URLs; falls back to request origin locally).
- `SESSION_DAYS` (optional, default 30) — session persistence window for returning users.

Migrations: `drizzle-kit generate` to produce SQL, then apply to Neon (`drizzle-kit migrate`/`push`). Documented in the build steps.

## 10. Testing plan

- **Local (with test Neon branch + Brevo key):** request link → (capture the link from the Brevo log / a dev “echo link” mode when a `DEV_ECHO_LINK` flag is set) → verify → session set → protected page loads → sign out → guard redirects. Wrong/expired/reused token rejected. Rate-limit trips after N.
- **Admin:** a user in `ADMIN_EMAILS` gets `isAdmin:true` from `/api/auth/me`; others `false`.
- **No-enumeration:** unknown vs known email give identical responses.
- **Live:** repeat the happy path on Vercel with the real domain once env vars are set.
- Existing multi-model grading + task flows unaffected (regression check).

## 11. Risks / open questions

- **Serverless + Postgres connections** — mitigated by the Neon HTTP driver; confirm at build.
- **Deliverability of magic links on Brevo free tier** — acceptable for a prototype; verify a sender to improve it; watch the 300/day cap.
- **Dev testing without inboxes** — add a `DEV_ECHO_LINK` mode that returns/logs the link locally so the flow is testable without sending real mail.
- **Cookie on `*.vercel.app`** — SameSite=Lax + Secure works on the deployed HTTPS domain; local dev over http needs Secure relaxed in dev.
- **Email pre-fill on shared devices** — the last-used email is shown to the next person on that browser. Low-stakes (an email is not a password; no session is exposed). Default keeps the pre-fill; switchable to clear-on-sign-out if shared-device use matters.

## 12. After this sub-project

Next, in order: **Attempts** (record graded runs) → **Admin** (gate the switcher panel + users view + server-side global model switch) → **Reminder engine** (Brevo campaigns + Vercel Cron) → **Gamification** → **Success-Metrics view**.
