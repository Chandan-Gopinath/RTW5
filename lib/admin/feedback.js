// GET /api/admin/feedback -> { feedback: [{ name, email, context, rating, message, createdAt }] }
// Admin-only (same gate as /api/admin/users). Newest first.
import { db, feedback, users } from "../db.js";
import { eq } from "drizzle-orm";
import { getRequestUser } from "../session.js";
import { isAdmin } from "../auth-helpers.js";

export default async function handler(req, res) {
  const me = await getRequestUser(req);
  if (!me || !isAdmin(me.email)) return res.status(403).json({ error: "forbidden" });

  const rows = await db()
    .select({
      context: feedback.context,
      rating: feedback.rating,
      message: feedback.message,
      createdAt: feedback.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id));

  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ feedback: rows });
}
