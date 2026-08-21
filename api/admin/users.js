// GET /api/admin/users -> { users: [{ name, email, createdAt, attempts, passRate, lastAttempt, isAdmin }] }  (admin-only)
import { db, users, attempts } from "../../lib/db.js";
import { getRequestUser } from "../../lib/session.js";
import { isAdmin } from "../../lib/auth-helpers.js";

export default async function handler(req, res) {
  const me = await getRequestUser(req);
  if (!me || !isAdmin(me.email)) return res.status(403).json({ error: "forbidden" });

  const allUsers = await db().select().from(users);
  const allAttempts = await db().select().from(attempts);

  const byUser = {};
  for (const a of allAttempts) {
    const b = byUser[a.userId] || (byUser[a.userId] = { total: 0, passed: 0, last: null });
    b.total++;
    if (a.passed) b.passed++;
    if (!b.last || new Date(a.createdAt) > new Date(b.last)) b.last = a.createdAt;
  }

  const rows = allUsers
    .map((u) => {
      const s = byUser[u.id] || { total: 0, passed: 0, last: null };
      return {
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        attempts: s.total,
        passRate: s.total ? Math.round((s.passed / s.total) * 100) : null,
        lastAttempt: s.last,
        isAdmin: isAdmin(u.email),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ users: rows });
}
