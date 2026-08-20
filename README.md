# You Got It!

A design prototype for **You Got It!** — a daily-habit product that teaches non-technical **practice managers** to use AI on their real work, and grades whether they did it well. The graded practice arena is called **AIGround**.

> **Status: design-only clickable prototype.** No AI, backend, or grading logic is wired yet — the prompt/draft/feedback content is the pre-scripted "Riverstone / Margaret Nguyen" recall-letter scenario, used to demonstrate the flow and the visual design. The real-AI build is a separate, later step.

## The flow

`index.html` (sign in) → `dashboard.html` (Your desk) → `learn.html` (3 judgment lessons) → `aiground.html` (the 5-step graded loop: Brief → Prompt → Draft → Feedback → Reveal) → back to Your desk.

## Run it locally

Any static server works, e.g.:

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123/index.html

## Design system

All tokens, type, and components live in `styles.css`:

- **Ground** bright bone `#FCFCFA`, ink `#18181C`
- **Accent** highlighter-yellow `#EFE84B` (used only as a highlight + active marker)
- **Semantic** pass `#2E8B52` · warn `#C6871F` · fix `#C0503C` (kept separate from the accent)
- **Type** Fraunces (display) · Hanken Grotesk (body) · IBM Plex Mono (labels & evidence)
- Fully responsive (mobile-first); the logo mark is a placeholder (tick concept).
