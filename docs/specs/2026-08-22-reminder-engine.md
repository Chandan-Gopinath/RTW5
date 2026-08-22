# Reminder Engine — design spec

**Date:** 2026-08-22
**Status:** approved (brainstorm), ready for implementation plan
**Feature area:** daily nudge + weekly recap emails for the "You Got It!" app, via Brevo + Vercel Cron over the existing `attempts`/`users` data

---

## 1. Goal & guardrails

Give the product its first **push** loop. Today the app is entirely pull — the user must remember
to return. The reminder engine is the mechanism that turns "daily habit" from an aspiration into
something we can actually test. It is the biggest single lever on the daily-habit thesis.

Design principles carried from the case study (same anti-fear brand as gamification):

- **Encouraging, never nagging.** No guilt, no "don't lose your streak," no dead-end emails.
- **Respect the already-engaged.** Don't poke someone who has already shown up today.
- **On-thesis content.** Spaced repetition is a documented learning-science win — the daily email
  uses it rather than always demanding a brand-new task.
- **Compliant by default.** Every send carries a working unsubscribe and honours suppression.

---

## 2. Scope & audience

- **Both emails ship in v1:** a **daily nudge** (habit trigger) and a **weekly recap**
  (progress + re-engagement). Shared plumbing is built once; the two crons/templates ride it.
- **Everyone who has signed up receives them.** Activity-based tapering is deliberately *not*
  built in v1 — adaptive content (§3) is the hedge against staleness. (Tradeoff noted: daily mail
  to long-dormant users is a deliverability risk; revisit tapering if delivery suffers.)

---

## 3. The daily nudge

**Adaptive content**, computed from `attempts`:

1. If the user has an **un-started task** in the catalog → nudge that task.
2. Else → **spaced-repeat** the **least-recently-practised** task, framed as a quick refresh
   ("you nailed the recall letter on Tuesday — can you still spot the unsafe field?").

This never produces a dead-end "you've done everything" email, and reads as varied even to a lapsed
user with only 2 tasks in the catalog.

- **Send time:** 11:30 AM `Australia/Sydney` (same timezone as streak day-bucketing).
- **Skip rule:** if the user already logged a **graded attempt in today's Sydney window**, skip the
  daily entirely — they've shown up, don't nag. (They still receive the weekly recap.)
- **Layout:** one-line personalised greeting + the picked task + a single deep-link button carrying
  `?src=daily`. Reuses the branded, email-client-safe markup from the magic-link template.

---

## 4. The weekly recap

**Encouraging retrospective, no guilt.** Computed via the existing `lib/gamification.js`
`computeState`:

- Active week → "This week: +N points · X tasks · streak Y 🔥 · Z pts from *In the Flow*" + one CTA
  button back to a task.
- Zero-activity week → **no failure tone**; a soft "still here when you're ready" + the day-one
  framing.

- **Send time:** **Monday** 11:30 AM `Australia/Sydney` (matches the daily send-hour — one mental
  model; frames a fresh week; strongest re-engagement slot for the "everyone" audience).
- Deep-link carries `?src=weekly`.

---

## 5. Compliance / unsubscribe

Verified by research against Brevo's docs (2026-08-22):

- Brevo **auto-injects a `List-Unsubscribe` header on every send**, including transactional via
  `POST /v3/smtp/email` — so mail clients show a native one-click Unsubscribe button on our
  reminders whether or not we add one.
- Brevo maintains a **transactional blocklist and automatically suppresses** sends to anyone who
  unsubscribed / complained / hard-bounced, enforced on the same endpoint we already use.

**Design consequence:** we lean on Brevo for compliance + suppression. **No local suppression
table.** We add a plain footer legitimacy line ("You're getting this because you signed up for
You Got It!"). A custom in-app email-preferences page is **deferred**.

_Refinements noted:_ there is no managed in-body `{{unsubscribe}}` merge tag for transactional
(a *visible* in-body link would have to be self-hosted — deferred); Brevo's block is
sender-specific by default.

---

## 6. Data model & idempotency

New append-only table **`reminder_log`**:

| column | type | note |
|--------|------|------|
| `id` | uuid pk | |
| `userId` | uuid → users.id (cascade) | |
| `type` | text | `daily` \| `weekly` |
| `sentAt` | timestamptz default now | |
| `meta` | jsonb | e.g. picked `taskId`, computed points — for later Success-Metrics |

- **Idempotency:** before sending, skip if a `reminder_log` row of the same `type` already exists
  for **today's Sydney day** (daily) / **this ISO week** (weekly). Makes the cron safe to retry.
- Rationale matches the gamification pattern: record events in a table, derive on read. The log is
  also the natural home for click/open data and the future Success-Metrics view.

---

## 7. Cron security

The crons trigger public API routes. Each handler **verifies `CRON_SECRET`** (Vercel sends it as a
bearer header; the env var is set by the user, never handled by Claude) and rejects anything
without it. Non-negotiable for a public serverless route.

---

## 8. Analytics

Standing rule: add Plausible events for new user-facing features.

- Email opens/clicks can't reach Plausible directly, so reminder deep-links carry `?src=daily` /
  `?src=weekly`; the landing page fires a **`Reminder Clicked`** goal (prop: `type`).
- Registered in `scripts/setup-plausible-goals.mjs`.
- **Sends** are counted in `reminder_log` (server cron is invisible to Plausible).

---

## 9. Implementation surface

- `lib/email.js` → extract a generic `sendEmail({ to, subject, html })`; add `dailyNudgeHtml` +
  `weeklyRecapHtml` templates (reuse the branded magic-link markup).
- `lib/reminders.js` (**new**) → pure logic: the daily task-picker and the weekly-stats builder.
  No I/O — unit-tested.
- `lib/db.js` → add the `reminder_log` table; new Drizzle migration in `drizzle/`.
- `api/cron/daily.js` + `api/cron/weekly.js` (**new**) → secret check → query users/attempts → pick
  content → send via Brevo → write `reminder_log`.
- `vercel.json` → add two `crons` entries (UTC times mapping to 11:30 Sydney).
- Landing page(s) → fire `Reminder Clicked` from `?src`.
- `test/reminders.test.js` (**new**) → task-picker, idempotency window, weekly stats.
- `scripts/setup-plausible-goals.mjs` → register the `Reminder Clicked` goal.

---

## 10. Flagged assumptions / limits (not blockers)

- **Vercel Hobby plan:** ~2 cron jobs, once-daily each, ~10s function timeout → fine for a small
  user base. A large list would need batching / Pro. v1 loops sends and documents the scale ceiling.
- **DST:** cron is UTC; 11:30 Sydney drifts ±1h across daylight saving. v1 picks one UTC offset and
  accepts the drift half the year (documented). Per-user send-time = future / Pro.

---

## 11. Out of scope for v1

Per-user cadence/timezone settings, custom email-preferences page, open-tracking, bounce
dashboards, activity-based tapering.

---

## 12. New environment variable

- **`CRON_SECRET`** — set by the user in Vercel + local `.env`; verified by both cron handlers.
