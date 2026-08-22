// POST /api/feedback { context, rating, message } -> { ok: true }
// Auth-gated to the signed-in user; stores one row in the feedback table.
import { getRequestUser } from "../lib/session.js";
import { normalizeFeedback } from "../lib/feedback.js";
import { db, feedback } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "unauthenticated" });

  const norm = normalizeFeedback(req.body || {});
  if (!norm.ok) return res.status(400).json({ error: norm.error });

  try {
    await db().insert(feedback).values({ userId: user.id, ...norm.value });
    res.json({ ok: true });
  } catch (err) {
    console.error("feedback insert error:", err?.message || err);
    res.status(500).json({ error: "insert_failed" });
  }
}
