// GET  /api/admin/config -> { models: [{id,label,provider,live}], active }
// POST /api/admin/config { model } -> { ok, active }   (admin-only)
import { getActiveModel, setActiveModel } from "../config.js";
import { getRequestUser } from "../session.js";
import { isAdmin } from "../auth-helpers.js";
import { MODELS } from "../../prompts.js";
import { hasKey } from "../grader.js";

export default async function handler(req, res) {
  const user = await getRequestUser(req);
  if (!user || !isAdmin(user.email)) return res.status(403).json({ error: "forbidden" });

  if (req.method === "GET") {
    const models = Object.values(MODELS).map((m) => ({ id: m.id, label: m.label, provider: m.provider, live: hasKey(m.id) }));
    return res.json({ models, active: await getActiveModel() });
  }
  if (req.method === "POST") {
    const model = (req.body?.model || "").trim();
    try { await setActiveModel(model); } catch (_) { return res.status(400).json({ error: "unknown_model" }); }
    return res.json({ ok: true, active: model });
  }
  return res.status(405).json({ error: "method_not_allowed" });
}
