// Vercel serverless function: POST /api/draft { model, prompt } -> { draft }
import { generateDraft, hasKey } from "../lib/grader.js";
import { getModel, DEFAULT_MODEL } from "../prompts.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const model = (req.body?.model || DEFAULT_MODEL).trim();
  const prompt = (req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "empty_prompt" });
  if (!getModel(model)) return res.status(400).json({ error: "unknown_model" });
  if (!hasKey(model)) return res.json({ error: "no_api_key" });
  try {
    const draft = await generateDraft(model, prompt);
    res.json({ draft });
  } catch (err) {
    console.error("draft error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
}
