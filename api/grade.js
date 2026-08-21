// Vercel serverless function: POST /api/grade { task, prompt, draft } -> { summary, checks: [...] }
import { gradeSubmission, hasKey } from "../lib/grader.js";
import { getTask } from "../prompts.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const task = (req.body?.task || "recall").trim();
  const prompt = (req.body?.prompt || "").trim();
  const draft = (req.body?.draft || "").trim();
  if (!prompt || !draft) return res.status(400).json({ error: "missing_fields" });
  if (!getTask(task)) return res.status(400).json({ error: "unknown_task" });
  if (!hasKey()) return res.json({ error: "no_api_key" });
  try {
    const data = await gradeSubmission(task, prompt, draft);
    res.json(data);
  } catch (err) {
    console.error("grade error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
}
