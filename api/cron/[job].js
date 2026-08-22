// Dynamic cron route — one Vercel function for both /api/cron/daily and
// /api/cron/weekly (Hobby plan caps a deployment at 12 serverless functions).
// The real handlers live in lib/cron/* (lib/ is not scanned for functions).
// `job` comes from the [job] segment. Both are CRON_SECRET-guarded inside.
import daily from "../../lib/cron/daily.js";
import weekly from "../../lib/cron/weekly.js";

const handlers = { daily, weekly };

export default async function handler(req, res) {
  const job = req.query?.job;
  const h = handlers[job];
  if (!h) return res.status(404).json({ error: "not_found" });
  return h(req, res);
}
