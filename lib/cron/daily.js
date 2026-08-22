// Vercel cron: GET /api/cron/daily — sends the daily nudge to eligible users.
// Scheduled in vercel.json for 11:30 Australia/Sydney. Guarded by CRON_SECRET.
import { authorizeCron, runReminderBatch } from "../reminder-runner.js";

export default async function handler(req, res) {
  if (!authorizeCron(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    const summary = await runReminderBatch("daily");
    res.json({ ok: true, ...summary });
  } catch (err) {
    console.error("cron daily error:", err?.message || err);
    res.status(500).json({ error: "cron_failed", message: String(err?.message || err) });
  }
}
