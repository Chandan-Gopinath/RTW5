// Vercel serverless function: POST /api/grade { model, task, prompt, draft } -> { summary, checks: [...] }
import { gradeSubmission, hasKey } from "../lib/grader.js";
import { getTask, getModel, DEFAULT_MODEL } from "../prompts.js";
import { db, attempts } from "../lib/db.js";
import { getUserFromToken, readCookie, SESSION_COOKIE } from "../lib/session.js";
import { and, eq } from "drizzle-orm";

// Record a graded run against the signed-in user (best-effort; never blocks grading).
async function recordAttempt(req, { task, model, prompt, draft, data }) {
  try {
    const user = await getUserFromToken(readCookie(req.headers.cookie, SESSION_COOKIE));
    if (!user) return;
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const total = checks.length;
    const checksPassed = checks.filter((c) => c.verdict === "pass").length;
    const prior = await db().select().from(attempts).where(and(eq(attempts.userId, user.id), eq(attempts.taskId, task)));
    await db().insert(attempts).values({
      userId: user.id,
      taskId: task,
      model,
      prompt,
      draft,
      passed: total > 0 && checksPassed === total,
      checksPassed,
      total,
      verdicts: checks,
      attemptNo: prior.length + 1,
    });
  } catch (e) {
    console.error("attempt record failed:", e?.message || e);
  }
}

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
    await recordAttempt(req, { task, model, prompt, draft, data });
    res.json(data);
  } catch (err) {
    console.error("grade error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
}
