// POST /api/auth/signout -> clears the session
import { destroySession, readCookie, clearCookie, SESSION_COOKIE } from "../../lib/session.js";

export default async function handler(req, res) {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  await destroySession(token);
  const secure = process.env.NODE_ENV !== "development";
  res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE, { secure }));
  res.json({ ok: true });
}
