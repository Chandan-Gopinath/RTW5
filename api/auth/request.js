// POST /api/auth/request { email, name } -> { ok: true } (always; no enumeration)
import { db, magicTokens, users } from "../../lib/db.js";
import { normalizeEmail, isValidEmail } from "../../lib/auth-helpers.js";
import { generateToken, hashToken } from "../../lib/tokens.js";
import { sendMagicLink } from "../../lib/email.js";
import { and, eq, gt, isNull } from "drizzle-orm";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || "").trim();
  if (!isValidEmail(email)) return res.status(400).json({ error: "invalid_email" });

  // Rate-limit / anti-bombing: at most 5 outstanding (unused, unexpired) links per email.
  const active = await db().select().from(magicTokens).where(
    and(eq(magicTokens.email, email), gt(magicTokens.expiresAt, new Date()), isNull(magicTokens.usedAt))
  );
  if (active.length >= 5) return res.json({ ok: true });

  const token = generateToken();
  await db().insert(magicTokens).values({
    tokenHash: hashToken(token),
    email,
    name: name || null,
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });

  const base = process.env.APP_URL || `https://${req.headers.host}`;
  const link = `${base}/api/auth/verify?token=${token}`;
  const returning = Boolean((await db().select().from(users).where(eq(users.email, email)))[0]);
  try { await sendMagicLink(email, link, { name, returning }); } catch (e) { console.error("magic-link email failed:", e?.message || e); }

  res.json({ ok: true });
}
