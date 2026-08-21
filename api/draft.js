// Vercel serverless function: POST /api/draft { prompt } -> { draft }
import { generateDraft, hasKey } from "../lib/grader.js";
import { getActiveModel } from "../lib/config.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const model = await getActiveModel(); // admin-controlled global model
  const prompt = (req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "empty_prompt" });
  if (!hasKey(model)) return res.json({ error: "no_api_key" });
  try {
    const draft = await generateDraft(model, prompt);
    res.json({ draft });
  } catch (err) {
    console.error("draft error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
}
