# In-app User Feedback — design spec

**Date:** 2026-08-22
**Status:** approved (brainstorm), ready for implementation plan
**Feature area:** let signed-in users send quick feedback; store in the DB; show on the admin board

---

## 1. Goal & guardrails

Give users a low-friction way to tell us what's working and what isn't, and route it somewhere the
team actually sees it (the admin board). Must fit the anti-fear brand: one tap, never a wall of
required fields, never intimidating.

Principles:
- **Lowest friction wins.** A rating alone is valid feedback; the note is always optional.
- **Contextual + always-available.** Catch high-intent moments (just after grading) *and* offer a
  persistent path (account menu).
- **Attributed but never blocking.** Tie feedback to the signed-in user so we can follow up, but a
  missing user never stops a submit.

---

## 2. Scope (v1)

- **Two entry points:**
  1. **After grading** — on the AIGround Reveal step (highest-intent, contextual moment).
  2. **Persistent "Send feedback"** item in the account menu (always available).
- **Deferred:** reminder-email embed (add once the reminder engine is live), level-up and Progress
  page placements.

---

## 3. Feedback shape

- **Thumbs up / down** (`rating` = `up` | `down`) + an **optional one-line note**.
- A rating on its own submits fine; the note is optional.
- On submit: a small "Thanks — got it" confirmation; the widget collapses. No modal gauntlet.

---

## 4. Data model

New table **`feedback`**:

| column | type | note |
|--------|------|------|
| `id` | uuid pk | |
| `userId` | uuid → users.id (cascade), **nullable** | set when signed in; nullable for safety |
| `context` | text | where it came from — e.g. `grade:recall`, `menu` |
| `rating` | text | `up` \| `down` (nullable if a note-only path is ever added) |
| `message` | text | optional free-text note |
| `createdAt` | timestamptz default now | |

New Drizzle migration. (See plan for the numbering note vs the reminder-engine branch.)

---

## 5. API

- **`POST /api/feedback`** — auth-gated to the signed-in user (reads the session cookie, same as
  `/api/progress`). Body `{ context, rating, message }`. Validates: `rating` in `up`/`down` (or
  empty if message present), `message` length-capped (e.g. ≤ 1000 chars), `context` a short string.
  Inserts a row with `userId` from the session. Returns `{ ok: true }`.
- **`GET /api/admin/feedback`** — admin-only (`isAdmin`, same gate as `/api/admin/users`). Returns
  `{ feedback: [{ name, email, context, rating, message, createdAt }] }`, newest first (joined to
  users for display).

---

## 6. UI

- **AIGround Reveal step:** a compact "Was this helpful?" row with 👍/👎 + an optional one-line
  input that appears after a rating is chosen, and a Send button. Collapses to "Thanks — got it."
- **Account menu:** a "Send feedback" item that opens a small inline panel (same widget, `context =
  menu`). Reuse one shared widget so both places behave identically.
- Styling from the existing design system (`styles.css`); non-intimidating, on-brand.

---

## 7. Analytics

- **`Feedback Submitted`** Plausible event with props `{ context, rating }`, fired on a successful
  POST. Registered in `scripts/setup-plausible-goals.mjs` (standing rule).

---

## 8. Out of scope for v1

Reminder-email feedback embed, level-up/Progress placements, categories/tags, threaded replies,
per-user feedback history UI, email notifications to admins.
