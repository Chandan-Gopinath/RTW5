import { db, attempts } from "./db.js";
import { and, eq } from "drizzle-orm";

// Insert one graded run for a user. Returns { attemptNo, passed, checksPassed, total }.
// attemptNo = the user's Nth try at this task (powers the "improvement on retry" metric).
export async function recordAttempt(userId, { taskId, model, prompt, draft, checks }) {
  const list = Array.isArray(checks) ? checks : [];
  const total = list.length;
  const checksPassed = list.filter((c) => c.verdict === "pass").length;
  const passed = total > 0 && checksPassed === total;
  const prior = await db().select().from(attempts).where(and(eq(attempts.userId, userId), eq(attempts.taskId, taskId)));
  const attemptNo = prior.length + 1;
  await db().insert(attempts).values({
    userId, taskId, model, prompt, draft, passed, checksPassed, total, verdicts: list, attemptNo,
  });
  return { attemptNo, passed, checksPassed, total };
}
