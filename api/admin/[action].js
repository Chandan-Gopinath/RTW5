// Dynamic admin route — one Vercel function for all /api/admin/* endpoints
// (Hobby plan caps a deployment at 12 serverless functions, so the four admin
// handlers share this single function). The real logic lives in lib/admin/*
// (lib/ is not scanned for functions). `action` comes from the [action] segment.
import config from "../../lib/admin/config.js";
import feedback from "../../lib/admin/feedback.js";
import metrics from "../../lib/admin/metrics.js";
import users from "../../lib/admin/users.js";

const handlers = { config, feedback, metrics, users };

export default async function handler(req, res) {
  const action = req.query?.action;
  const h = handlers[action];
  if (!h) return res.status(404).json({ error: "not_found" });
  return h(req, res);
}
