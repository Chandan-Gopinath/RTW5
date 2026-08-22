# Adding a graded task — the canonical recipe

Every task must appear consistently across **all** sections, with the same synthetic data and a
**1:1 mapping** between what's taught, what's shown, and what's graded. Follow this checklist in
order. The desk renders itself from the catalog, so there is **no dashboard edit**.

## The golden rule (keep these counts equal)

For a task with **N** graded checks:

```
grader checks (prompts.js)  ==  Learn lessons (learn.html)  ==  AIGround tips (aiground.html)  ==  fallbackGrade checks
        N                           N                              N                                   N
```

Same `id`/concept, same order, same synthetic data (names, dates, details) everywhere.

## Sections to touch (in order)

1. **`catalog.js`** — add one row:
   `{ id, tier: 'starter'|'core'|'advanced', status: 'soon'|'live', order, category, title, blurb, meta, chips: [...] }`.
   Start as `status:'soon'` (renders as a locked teaser); flip to `'live'` once steps 2–5 exist.

2. **`prompts.js`** — add the grader to `TASKS`: `id: { id, graderSystem }`. The grader defines the
   **rubric** — the scenario, the answer key (synthetic data), and exactly N checks, each with a
   stable `id`, a `pass/warn/fail` verdict, cited evidence, and a one-line "why". This is the source
   of truth for the check set.

3. **`aiground.html` → `TASK_VIEWS[id]`** — the practice view:
   - `brief` = `{ title, lead, recordLabel, record: [[k,v],…] }` — the `record` rows are the
     **synthetic data** (must match the grader's answer key).
   - `promptLead`, `promptPlaceholder`.
   - `tips: [...]` — **one short reminder per grader check, same order** (surfaced as "Keep in mind —
     you're graded on these" on the prompt step).
   - `reveal` = `{ lead, promptLabel, promptText, draftLabel, draftText }` — the strong version.
   - `fallbackDraft` + `fallbackGrade` = `{ summary, checks: [...] }` — demo-mode results; the
     `checks` ids/titles mirror the grader's.

4. **`aiground.html` → hub** — add a `.path__node` with `data-start-task="<id>"` (available), or a
   `.path__node.is-lock` teaser if still "soon".

5. **`learn.html` → `LEARN[id]`** — `{ title, eyebrow, heading, lead, ctaText, lessons: [...] }`.
   **One lesson per grader check**, same concept/order, each with `title`, `text`, `do`, `dont`.
   State the count in `lead`/`ctaText` ("Four judgment skills…").

## Consistency checklist before shipping

- [ ] Counts equal (grader checks == Learn lessons == AIGround tips == fallbackGrade checks).
- [ ] Same synthetic names/dates/details in the grader answer key, the AIGround `record` + `reveal`,
      and the Learn `do`/`dont` examples.
- [ ] Catalog `tier`/`order`/`status` set; `status:'live'` only when 2–5 are done.
- [ ] `npm test` green; desk shows the task; Learn → AIGround route works (`?task=<id>`).

## Notes

- **Difficulty tiers** (`starter`/`core`/`advanced`) are content difficulty — distinct from points
  levels. Starter tasks get a gentler rubric (fewer checks) + a shorter Learn page.
- **"Completed everything"** is handled automatically by the desk (spaced-repeat refresh); no work
  per task.
- The gamification engine is task-agnostic, so points/levels/streak "just work" for any new task.
