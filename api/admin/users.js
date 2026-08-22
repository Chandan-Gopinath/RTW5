// GET /api/admin/users -> { users: [{ name, email, createdAt, attempts, passRate, lastAttempt, isAdmin }] }  (admin-only)
import { db, users, attempts } from "../../lib/db.js";
import { getRequestUser } from "../../lib/session.js";
import { isAdmin } from "../../lib/auth-helpers.js";
import { computeState } from "../../lib/gamification.js";

export default async function handler(req, res) {
  const me = await getRequestUser(req);
  if (!me || !isAdmin(me.email)) return res.status(403).json({ error: "forbidden" });

  const allUsers = await db().select().from(users);
  const allAttempts = await db().select().from(attempts);

  const byUser = {};
  for (const a of allAttempts) {
    (byUser[a.userId] || (byUser[a.userId] = [])).push(a);
  }

  const rows = allUsers
    .map((u) => {
      const list = byUser[u.id] || [];
      const passed = list.filter((a) => a.passed).length;
      const last = list.reduce((m, a) => (!m || new Date(a.createdAt) > new Date(m) ? a.createdAt : m), null);
      const gam = computeState(list); // points/level from the same engine the app uses
      return {
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        attempts: list.length,
        passRate: list.length ? Math.round((passed / list.length) * 100) : null,
        lastAttempt: last,
        points: gam.points,
        level: gam.level,
        levelName: gam.levelName,
        isAdmin: isAdmin(u.email),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ users: rows });
}
