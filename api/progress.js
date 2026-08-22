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
  res.json({ progress: computeState(rows) });
}
