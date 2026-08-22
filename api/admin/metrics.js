// GET /api/admin/metrics -> { metrics } (admin-only). Success metrics computed
// from users + attempts: "doing, not watching".
import { db, users, attempts } from "../../lib/db.js";
import { getRequestUser } from "../../lib/session.js";
import { isAdmin } from "../../lib/auth-helpers.js";
import { computeMetrics } from "../../lib/metrics.js";

export default async function handler(req, res) {
  const me = await getRequestUser(req);
  if (!me || !isAdmin(me.email)) return res.status(403).json({ error: "forbidden" });

  const [allUsers, allAttempts] = await Promise.all([
    db().select().from(users),
    db().select().from(attempts),
  ]);
  res.json({ metrics: computeMetrics(allUsers, allAttempts) });
}
