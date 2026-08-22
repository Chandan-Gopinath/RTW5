// One-time helper: create the "You Got It!" custom-event goals in Plausible
// via the provisioning API, so you don't have to add them by hand.
//
// USAGE (you run this — your API key never leaves your machine):
//   PLAUSIBLE_API_KEY=xxxxx node scripts/setup-plausible-goals.mjs
//
// - Get an API key: Plausible → Account Settings → API Keys.
// - The provisioning API + funnels are Business-plan features.
// - Safe to re-run: Plausible returns the existing goal if it already exists.
// - This creates GOALS only. Funnels have no reliable public create-endpoint,
//   so build the funnel once in the dashboard from these goals, in order:
//     Signin → Learn Started → Enter AIGround → Task Started → Draft Generated → Graded

const SITE_ID = "you-got-it.vercel.app"; // must match the domain in your Plausible dashboard
const API = "https://plausible.io/api/v1/sites/goals";

// The custom events the site already fires (see analytics.js + data-event attrs).
const EVENTS = [
  "Signup",
  "Signin",
  "Sign Out",
  "Learn Started",
  "Enter AIGround",
  "Task Started",
  "Draft Generated",
  "Graded",
  "Task Passed",
  "Task Failed",
  "Try Again",
  "Reveal Viewed",
  "Model Switched",
  "Progress Viewed",
  "Level Up",
  "Streak Unlocked",
  "Points Earned",
  "Sound Toggled",
  "Tour Started",
  "Tour Completed",
  "Tour Skipped",
  "Reminder Clicked",
];

const key = process.env.PLAUSIBLE_API_KEY;
if (!key) {
  console.error("Missing PLAUSIBLE_API_KEY. Run:\n  PLAUSIBLE_API_KEY=xxxxx node scripts/setup-plausible-goals.mjs");
  process.exit(1);
}

async function createGoal(eventName) {
  const res = await fetch(API, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_id: SITE_ID,
      goal_type: "event",
      event_name: eventName,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  return body;
}

let ok = 0;
let failed = 0;
for (const name of EVENTS) {
  try {
    await createGoal(name);
    console.log(`✓ ${name}`);
    ok++;
  } catch (err) {
    console.error(`✗ ${name} — ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${ok} ok, ${failed} failed (site: ${SITE_ID}).`);
if (failed === 0) {
  console.log("Next: build the funnel in the dashboard from these goals, in order:");
  console.log("  Signin → Learn Started → Enter AIGround → Task Started → Draft Generated → Graded");
}
process.exit(failed === 0 ? 0 : 1);
