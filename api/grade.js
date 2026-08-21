// Vercel serverless function: POST /api/grade { task, prompt, draft } -> { summary, checks: [...] }
import { gradeSubmission, hasKey } from "../lib/grader.js";
import { getTask, getModel, DEFAULT_MODEL } from "../prompts.js";
import { recordAttempt } from "../lib/attempts.js";
import { getUserFromToken, readCookie, SESSION_COOKIE } from "../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const model = (req.body?.model || DEFAULT_MODEL).trim();
  const task = (req.body?.task || "recall").trim();
  const prompt = (req.body?.prompt || "").trim();
  const draft = (req.body?.draft || "").trim();
  if (!prompt || !draft) return res.status(400).json({ error: "missing_fields" });
  if (!getTask(task)) return res.status(400).json({ error: "unknown_task" });
  if (!getModel(model)) return res.status(400).json({ error: "unknown_model" });
  if (!hasKey(model)) return res.json({ error: "no_api_key" });
  try {
    const data = await gradeSubmission(model, task, prompt, draft);
    // record the attempt if signed in (best-effort; never blocks grading)
    try {
      const user = await getUserFromToken(readCookie(req.headers.cookie, SESSION_COOKIE));
      if (user) await recordAttempt(user.id, { taskId: task, model, prompt, draft, checks: data.checks });
    } catch (e) {
      console.error("attempt record failed:", e?.message || e);
    }
    res.json(data);
  } catch (err) {
    console.error("grade error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
}
