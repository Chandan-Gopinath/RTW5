// GET /api/auth/verify?token=... -> validates the magic token, upserts the user,
// creates a session, sets the cookie, redirects to the dashboard.
import { db, magicTokens, users } from "../../lib/db.js";
import { hashToken } from "../../lib/tokens.js";
import { createSession, serializeCookie, SESSION_COOKIE } from "../../lib/session.js";
import { eq } from "drizzle-orm";

export default async function handler(req, res) {
  const token = req.query?.token;
  if (!token) return res.status(400).send("Missing token.");
  const th = hashToken(token);

  const mt = (await db().select().from(magicTokens).where(eq(magicTokens.tokenHash, th)))[0];
  if (!mt || mt.usedAt || new Date(mt.expiresAt) <= new Date()) {
    return res.status(400).send("This sign-in link is invalid or has expired. Please request a new one.");
  }
  await db().update(magicTokens).set({ usedAt: new Date() }).where(eq(magicTokens.tokenHash, th));

  let user = (await db().select().from(users).where(eq(users.email, mt.email)))[0];
  if (!user) {
    user = (await db().insert(users).values({
      email: mt.email,
      name: mt.name || mt.email.split("@")[0],
    }).returning())[0];
  }
  await db().update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));

  const { token: sessionToken } = await createSession(user.id);
  const secure = process.env.NODE_ENV !== "development";
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, sessionToken, {
    days: Number(process.env.SESSION_DAYS) || 30,
    secure,
  }));
  res.writeHead(302, { Location: "/dashboard.html" });
  res.end();
}
