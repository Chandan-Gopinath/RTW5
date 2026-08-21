export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}
export function isAdmin(email, adminEmailsEnv = process.env.ADMIN_EMAILS || "") {
  const list = String(adminEmailsEnv).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(normalizeEmail(email));
}
