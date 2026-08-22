// GET /api/progress -> { progress } for the signed-in user (computed from attempts).
import { getRequestUser } from "../lib/session.js";
import { db, attempts } from "../lib/db.js";
import { eq } from "drizzle-orm";
import { computeState } from "../lib/gamification.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "unauthenticated" });
  const rows = await db().select().from(attempts).where(eq(attempts.userId, user.id));

  // Per-task completion for the desk catalog: attempts, whether ever passed, last time.
  const tasks = {};
  for (const r of rows) {
    const t = tasks[r.taskId] || (tasks[r.taskId] = { attempts: 0, passed: false, lastAt: null, bestChecks: 0, total: r.total || 0 });
    t.attempts += 1;
    if (r.passed) t.passed = true;
    if (!t.lastAt || new Date(r.createdAt) > new Date(t.lastAt)) t.lastAt = r.createdAt;
    if ((r.checksPassed || 0) > t.bestChecks) t.bestChecks = r.checksPassed || 0;
    if (r.total) t.total = r.total;
  }

  res.json({ progress: computeState(rows), tasks });
}
