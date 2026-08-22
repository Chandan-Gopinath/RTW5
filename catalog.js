// Single source of truth for the task catalog's METADATA (ordering, tier, status,
// desk copy). Per-task CONTENT lives elsewhere keyed by the same id: grader in
// prompts.js, practice copy in aiground.html (TASK_VIEWS), lesson in learn.html (LEARN).
//
// Adding a task later = one row here + its grader + its view/lesson copy.
// A future task sits here as status:"soon" (renders as a locked teaser); flip to
// "live" once its grader + copy exist.
//
// Tiers (difficulty): starter -> core -> advanced. Distinct from points levels.
(function () {
  window.YGI_CATALOG = [
    {
      id: "reminder-sms", tier: "starter", status: "live", order: 10,
      category: "Patient correspondence",
      title: "Appointment reminder text",
      blurb: "Draft a short, friendly SMS reminding a patient about their appointment — your gentle first task to learn how it all works.",
      meta: "~5 min · start here",
      chips: ["Give the AI clinic context", "Keep it short and clear", "No sensitive detail in a text"],
    },
    {
      id: "plain-english", tier: "starter", status: "live", order: 12,
      category: "Patient correspondence",
      title: "Say it in plain English",
      blurb: "Turn a line of clinical shorthand into something a patient can actually understand — without changing what it means.",
      meta: "~5 min · starter",
      chips: ["Say who it's for", "Keep the meaning exact", "Don't add anything new"],
    },
    {
      id: "closure-notice", tier: "starter", status: "live", order: 14,
      category: "Clinic notices",
      title: "Public holiday closure notice",
      blurb: "Draft a short notice that the clinic is closed for a public holiday — clear, and pointing people to help if they need it.",
      meta: "~5 min · starter",
      chips: ["Give the clinic and the dates", "Keep it short", "Don't invent a number"],
    },
    {
      id: "recall", tier: "core", status: "live", order: 20,
      category: "Patient correspondence",
      title: "Recall & reminder letters",
      blurb: "Draft a warm, on-brand recall letter with AI — and learn what's unsafe to share, what to verify, and how to make it sound like your clinic.",
      meta: "~10 min · graded in AIGround",
      chips: ["Give the AI context", "Keep unsafe data out", "Verify what it gives back"],
    },
    {
      id: "complaint", tier: "core", status: "live", order: 30,
      category: "Complaints & sensitive",
      title: "Complaint responses",
      blurb: "Draft a calm, professional first reply — and judge when a draft needs a human, not AI.",
      meta: "De-escalate with care",
      chips: ["Set a careful tone", "Keep her details out", "Apologise, don't over-commit"],
    },
    {
      id: "staff-announcement", tier: "core", status: "soon", order: 40,
      category: "Staff communication",
      title: "Staff announcements",
      blurb: "Turn messy meeting notes into a clear, calm message the whole team can act on.",
      meta: "Messy notes → message",
    },
    {
      id: "policy-update", tier: "advanced", status: "soon", order: 50,
      category: "Policies & procedures",
      title: "Policy updates",
      blurb: "Shape rough notes into a staff-ready SOP — and check the AI hasn't misstated the rule.",
      meta: "Notes → SOP",
    },
    {
      id: "board-report", tier: "advanced", status: "soon", order: 60,
      category: "Reporting",
      title: "Board reporting",
      blurb: "Turn a set of numbers into a written summary — and verify the AI read the figures right.",
      meta: "Numbers → narrative",
    },
    {
      id: "compliance-prep", tier: "advanced", status: "soon", order: 70,
      category: "Compliance & audit",
      title: "Compliance prep",
      blurb: "Generate checklists and evidence summaries — while confirming everything against the primary source.",
      meta: "Checklists & evidence",
    },
  ];

  window.YGI_TIERS = {
    starter: { label: "Starter", order: 1 },
    core: { label: "Core", order: 2 },
    advanced: { label: "Advanced", order: 3 },
  };

  // Pure desk selection. tasks = { [taskId]: { attempts, passed, lastAt } } (may be empty).
  // Returns { focus, allDone, rest, soon }:
  //  - focus  = the first live task not yet passed (a new user's Starter); if every live task is
  //             passed -> allDone=true and focus = the least-recently-done one (spaced-repeat refresh).
  //  - rest   = the other live tasks (with their done/started state available via `tasks`).
  //  - soon   = future tasks (locked teasers).
  window.ygiPickDesk = function (catalog, tasks) {
    tasks = tasks || {};
    var live = catalog.filter(function (t) { return t.status === "live"; });
    var soon = catalog.filter(function (t) { return t.status === "soon"; });
    var focus = null, allDone = false;
    for (var i = 0; i < live.length; i++) {
      var s = tasks[live[i].id];
      if (!(s && s.passed)) { focus = live[i]; break; }
    }
    if (!focus && live.length) {
      allDone = true;
      focus = live.slice().sort(function (a, b) {
        var la = (tasks[a.id] && tasks[a.id].lastAt) || 0;
        var lb = (tasks[b.id] && tasks[b.id].lastAt) || 0;
        return new Date(la) - new Date(lb);
      })[0];
    }
    var rest = live.filter(function (t) { return !focus || t.id !== focus.id; });
    return { focus: focus, allDone: allDone, rest: rest, soon: soon };
  };
})();
