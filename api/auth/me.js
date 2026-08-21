// GET /api/auth/me -> { user: { name, email, isAdmin } } | 401
import { getUserFromToken, readCookie, SESSION_COOKIE } from "../../lib/session.js";
import { isAdmin } from "../../lib/auth-helpers.js";

export default async function handler(req, res) {
  const user = await getUserFromToken(readCookie(req.headers.cookie, SESSION_COOKIE));
  if (!user) return res.status(401).json({ error: "unauthenticated" });
  res.json({ user: { name: user.name, email: user.email, isAdmin: isAdmin(user.email) } });
}
