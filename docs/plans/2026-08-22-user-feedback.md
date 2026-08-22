# In-app User Feedback — implementation plan

**Spec:** [../specs/2026-08-22-user-feedback.md](../specs/2026-08-22-user-feedback.md)
**Date:** 2026-08-22
**Branch:** `feedback` (off `main`)

## Task 1 — Data model (`feedback` table)
- Add `feedback` table to `lib/db.js` (+ register in the `db()` schema object).
- `npm run db:generate` → migration SQL (+ journal/snapshot).
- **Migration numbering:** `main` currently has migrations up to `0001`, so generate produces
  `0002` — the **same index the `reminder-engine` branch used**. Both `.sql` files are independent
  `CREATE TABLE`s applied manually via the Neon HTTP driver (drizzle-kit migrate isn't used for
  deploy), so the DB is fine either order. At the **second merge**, renumber the later migration to
  the next free index and reconcile `drizzle/meta/_journal.json` (documented in the handoff).

## Task 2 — Validation logic (`lib/feedback.js`) + tests
Pure, no I/O (mirrors the other `lib/*` engines) so it's unit-testable:
- `normalizeFeedback({ context, rating, message })` → `{ ok, value|error }`. Rules: `rating` ∈
  {`up`,`down`} or empty; must have a rating OR a non-empty message; `message` trimmed and capped at
  1000 chars; `context` coerced to a short safe string (default `unknown`).
- `test/feedback.test.js` covering valid up/down, note-only, both-empty rejection, over-length cap,
  bad rating rejection.

## Task 3 — Submit endpoint (`api/feedback.js`)
`POST` only; resolve the user via `getRequestUser` (401 if none); `normalizeFeedback` the body
(400 on invalid); insert into `feedback` with `userId`; return `{ ok: true }`.

## Task 4 — Admin endpoint (`api/admin/feedback.js`)
`GET`, admin-only (`isAdmin(me.email)`, else 403); select feedback joined to users; map to
`{ name, email, context, rating, message, createdAt }`, newest first.

## Task 5 — Dev wiring (`server.js`)
Mount `POST /api/feedback` and `GET /api/admin/feedback`.

## Task 6 — Shared widget (`feedback-widget.js` + `styles.css`)
One reusable widget: 👍/👎 → optional one-line note → Send → "Thanks — got it." `window.ygiFeedback`
mounts it into a container with a given `context`; POSTs to `/api/feedback`; fires the analytics
event on success. Styles added to `styles.css` (design-system tokens).

## Task 7 — Placements
- **AIGround Reveal** (`aiground.html`): mount the widget in the Feedback/Reveal step with
  `context = grade:<taskId>`.
- **Account menu** (shared topbar chrome — `auth.js`): add a "Send feedback" item that toggles an
  inline panel hosting the widget with `context = menu`.

## Task 8 — Admin board (`admin.html` + `admin.js`)
Add a "Feedback" section/table that fetches `/api/admin/feedback` and renders newest-first (rating
as 👍/👎, message, who, when).

## Task 9 — Analytics (`scripts/setup-plausible-goals.mjs`)
Register `Feedback Submitted`. (The event itself fires from the widget in Task 6.)

## Verification
- `npm test` green (existing suite + new feedback tests).
- Local: boot server, POST a valid/invalid body (401 without session, 400 on invalid), confirm the
  admin endpoint 403s for non-admins.
- Manual UI pass: widget on Reveal + account menu submits and collapses; admin table renders.
