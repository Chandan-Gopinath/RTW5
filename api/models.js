// Vercel serverless function: GET /api/models
// -> { models: [{ id, label, provider, live }], default }
// 'live' = the model's provider key is configured (else the app falls back to demo).
import { MODELS, DEFAULT_MODEL } from "../prompts.js";
import { hasKey } from "../lib/grader.js";

export default async function handler(req, res) {
  const models = Object.values(MODELS).map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    live: hasKey(m.id),
  }));
  res.json({ models, default: DEFAULT_MODEL });
}
