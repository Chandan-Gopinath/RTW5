// Session cookie helpers (pure) + DB-backed session lifecycle.
import { db, sessions, users } from "./db.js";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "./tokens.js";

export const SESSION_COOKIE = "ygi_session";

export function serializeCookie(name, value, { days = 30, secure = true } = {}) {
  const maxAge = Math.floor(days * 24 * 60 * 60);
  const parts = [`${name}=${value}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name, { secure = true } = {}) {
  const parts = [`${name}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(cookieHeader, name) {
  const m = String(cookieHeader || "").match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function createSession(userId, days = Number(process.env.SESSION_DAYS) || 30) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + days * 864e5);
  await db().insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserFromToken(token) {
  if (!token) return null;
  const s = (await db().select().from(sessions).where(eq(sessions.tokenHash, hashToken(token))))[0];
  if (!s || new Date(s.expiresAt) <= new Date()) return null;
  return (await db().select().from(users).where(eq(users.id, s.userId)))[0] || null;
}

export async function destroySession(token) {
  if (!token) return;
  await db().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
