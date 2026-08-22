// Vercel serverless function: POST /api/grade { task, prompt, draft } -> { summary, checks: [...] }
import { gradeSubmission, hasKey } from "../lib/grader.js";
import { getTask } from "../prompts.js";
import { getActiveModel } from "../lib/config.js";
import { recordAttempt } from "../lib/attempts.js";
import { getUserFromToken, readCookie, SESSION_COOKIE } from "../lib/session.js";
import { db, attempts } from "../lib/db.js";
import { eq } from "drizzle-orm";
import { deltaForAttempt } from "../lib/gamification.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const model = await getActiveModel(); // admin-controlled global model
  const task = (req.body?.task || "recall").trim();
  const prompt = (req.body?.prompt || "").trim();
  const draft = (req.body?.draft || "").trim();
  if (!prompt || !draft) return res.status(400).json({ error: "missing_fields" });
  if (!getTask(task)) return res.status(400).json({ error: "unknown_task" });
  if (!hasKey(model)) return res.json({ error: "no_api_key" });
  try {
    const data = await gradeSubmission(model, task, prompt, draft);
    // record the attempt + compute the points reveal if signed in (best-effort; never blocks grading)
    let gamify = null;
    try {
      const user = await getUserFromToken(readCookie(req.headers.cookie, SESSION_COOKIE));
      if (user) {
        const list = Array.isArray(data.checks) ? data.checks : [];
        const total = list.length;
        const checksPassed = list.filter((c) => c.verdict === "pass").length;
        const passed = total > 0 && checksPassed === total;
        const prior = await db().select().from(attempts).where(eq(attempts.userId, user.id));
        gamify = deltaForAttempt(prior, { taskId: task, checksPassed, passed });
        gamify.firstEver = prior.length === 0; // first graded task ever → welcome framing

        await recordAttempt(user.id, { taskId: task, model, prompt, draft, checks: data.checks });
      }
    } catch (e) {
      console.error("attempt record/gamify failed:", e?.message || e);
    }
    res.json(gamify ? { ...data, gamify } : data);
  } catch (err) {
    console.error("grade error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
}
