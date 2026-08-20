# You Got It!

**You Got It!** teaches non-technical **practice managers** to use AI on their real work, and grades whether they did it well. The graded practice arena is **AIGround**.

The recall-letter task is wired for **live AI grading**: the learner writes a prompt, Claude drafts the letter, and a second Claude call grades the submission against a rubric of planted traps (give context · keep unsafe data out · verify) and returns structured, cited feedback. Without an API key the app runs in **demo mode** on pre-scripted results, so the whole flow is still clickable.

## Run it

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # optional — omit for demo mode
npm start
```

Then open http://localhost:8123 . (Node 24+ can also load a `.env` file: `node --env-file=.env server.js` — see `.env.example`.)

- **With `ANTHROPIC_API_KEY` set** → live drafting + grading via the Claude API.
- **Without it** → demo mode: a banner appears in AIGround and the loop uses pre-scripted content.

The API key is read **only** from the environment on the server; it is never sent to or exposed in the browser.

## The flow

`index.html` (sign in) → `dashboard.html` (Your desk) → `learn.html` (3 judgment lessons) → `aiground.html` (skill-path hub → 5-step graded loop: Brief → Prompt → Draft → Feedback → Reveal) → back to Your desk.

## Architecture

- **`server.js`** — Express server. Serves the static pages and exposes two endpoints:
  - `POST /api/draft { prompt }` → `{ draft }` — generates the letter from the learner's prompt.
  - `POST /api/grade { prompt, draft }` → `{ summary, checks[] }` — grades against the rubric, structured JSON with per-check verdict + cited evidence + why.
- **`prompts.js`** — the scenario, the planted-trap rubric, the grader system prompt, and the JSON schema. Kept server-side so the "answer key" never reaches the browser. Model: **`claude-sonnet-5`**.
- **`styles.css`** — the whole design system (tokens, components, responsive).
- The frontend (`aiground.html`) calls the two endpoints and renders the draft and feedback; on any error it falls back to demo data and shows the banner.

## Analytics (Plausible)

Privacy-friendly, cookieless (no consent banner needed). Proxied **first-party through Vercel** (`vercel.json` rewrites `/js/script.js` and `/plausible/event` to Plausible) so ad-blockers don't drop it. `analytics.js` exposes `window.track(name, props)` and auto-fires any element with a `data-event` attribute.

**Setup:** create the site in Plausible, then replace `data-domain="yourdomain.com"` in each page's `<head>` with your registered domain. Locally the script doesn't load (no proxy), so events cleanly no-op.

**Custom goal events** (the "doing, not watching" funnel — per-user metrics come from the DB later, not Plausible):

| Event | Fires when |
|---|---|
| `Signup` / `Signin` | sign-in CTA clicked |
| `Learn Started` | Today's-focus hero opened |
| `Enter AIGround` | Learn → AIGround CTA |
| `Task Started` | AIGround task begins |
| `Draft Generated` (`mode`) | draft returned |
| `Graded` (`mode`, `checks_passed`, `total`) | grading returned |
| `Try Again` | retry from feedback/reveal |
| `Reveal Viewed` | strong-version step |

## Design system

- **Ground** bright bone `#FCFCFA`, ink `#18181C`
- **Accent** highlighter-yellow `#EFE84B` (highlight + active marker; ink carries buttons)
- **Semantic** pass `#2E8B52` · warn `#C6871F` · fix `#C0503C` (separate from the accent)
- **Type** Fraunces (display) · Hanken Grotesk (body) · IBM Plex Mono (labels & evidence)
- Fully responsive, mobile-first. Logo mark is a placeholder (tick concept).

> **Note:** all scenario data is synthetic. Real patient/clinic data never enters the app.
