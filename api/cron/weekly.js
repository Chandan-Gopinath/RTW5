// Vercel cron: GET /api/cron/weekly — sends the weekly recap to all users.
// Scheduled in vercel.json for Monday 11:30 Australia/Sydney. Guarded by CRON_SECRET.
import { authorizeCron, runReminderBatch } from "../../lib/reminder-runner.js";

export default async function handler(req, res) {
  if (!authorizeCron(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    const summary = await runReminderBatch("weekly");
    res.json({ ok: true, ...summary });
  } catch (err) {
    console.error("cron weekly error:", err?.message || err);
    res.status(500).json({ error: "cron_failed", message: String(err?.message || err) });
  }
}
