// Pure feedback validation/normalisation — no DB, no I/O — so it's unit-testable
// and shared by the API handler.

export const MAX_MESSAGE = 1000;
const RATINGS = new Set(["up", "down"]);

// Normalise a raw feedback body. Returns { ok: true, value } or { ok: false, error }.
// Rules: rating must be "up"/"down" or empty; a submission needs a rating OR a
// non-empty note; message is trimmed + capped; context is a short safe label.
export function normalizeFeedback({ context, rating, message } = {}) {
  const r = String(rating || "").trim().toLowerCase();
  if (r && !RATINGS.has(r)) return { ok: false, error: "bad_rating" };

  const msg = String(message || "").trim().slice(0, MAX_MESSAGE);
  if (!r && !msg) return { ok: false, error: "empty" };

  const ctx = String(context || "").trim().slice(0, 100) || "unknown";

  return { ok: true, value: { context: ctx, rating: r || null, message: msg || null } };
}
