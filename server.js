// Local dev server — serves the static prototype and the two API endpoints.
// On Vercel these endpoints are the serverless functions in /api; this Express
// server is for running the whole thing locally (`npm start`). Both share the
// grading logic in lib/grader.js so there's a single source of truth.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDraft, gradeSubmission, hasKey } from "./lib/grader.js";
import { getTask } from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.post("/api/draft", async (req, res) => {
  const prompt = (req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "empty_prompt" });
  if (!hasKey()) return res.json({ error: "no_api_key" });
  try {
    res.json({ draft: await generateDraft(prompt) });
  } catch (err) {
    console.error("draft error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
});

app.post("/api/grade", async (req, res) => {
  const task = (req.body?.task || "recall").trim();
  const prompt = (req.body?.prompt || "").trim();
  const draft = (req.body?.draft || "").trim();
  if (!prompt || !draft) return res.status(400).json({ error: "missing_fields" });
  if (!getTask(task)) return res.status(400).json({ error: "unknown_task" });
  if (!hasKey()) return res.json({ error: "no_api_key" });
  try {
    res.json(await gradeSubmission(task, prompt, draft));
  } catch (err) {
    console.error("grade error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 8123;
app.listen(PORT, () => {
  console.log(`You Got It! running at http://localhost:${PORT}`);
  console.log(hasKey() ? "GEMINI_API_KEY detected — live grading on." : "No GEMINI_API_KEY — running in demo mode.");
});
