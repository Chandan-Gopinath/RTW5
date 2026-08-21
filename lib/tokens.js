import { randomBytes, createHash } from "node:crypto";

export function generateToken() {
  return randomBytes(32).toString("base64url");
}
export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}
export function isExpired(date, now = new Date()) {
  return new Date(date).getTime() <= now.getTime();
}
