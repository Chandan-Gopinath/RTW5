// Session cookie helpers (pure) + DB-backed session lifecycle (added in Task 5).
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
