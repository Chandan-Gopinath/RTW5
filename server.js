// Local dev server — serves the static prototype and the two API endpoints.
// On Vercel these endpoints are the serverless functions in /api; this Express
// server is for running the whole thing locally (`npm start`). Both share the
// grading logic in lib/grader.js so there's a single source of truth.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDraft, gradeSubmission, hasKey } from "./lib/grader.js";
import { getTask, getModel, MODELS, DEFAULT_MODEL } from "./prompts.js";
import authRequest from "./api/auth/request.js";
import authVerify from "./api/auth/verify.js";
import authMe from "./api/auth/me.js";
import authSignout from "./api/auth/signout.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.post("/api/auth/request", (req, res) => authRequest(req, res));
app.get("/api/auth/verify", (req, res) => authVerify(req, res));
app.get("/api/auth/me", (req, res) => authMe(req, res));
app.post("/api/auth/signout", (req, res) => authSignout(req, res));

app.get("/api/models", (req, res) => {
  const models = Object.values(MODELS).map((m) => ({
    id: m.id, label: m.label, provider: m.provider, live: hasKey(m.id),
  }));
  res.json({ models, default: DEFAULT_MODEL });
});

app.post("/api/draft", async (req, res) => {
  const model = (req.body?.model || DEFAULT_MODEL).trim();
  const prompt = (req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "empty_prompt" });
  if (!getModel(model)) return res.status(400).json({ error: "unknown_model" });
  if (!hasKey(model)) return res.json({ error: "no_api_key" });
  try {
    res.json({ draft: await generateDraft(model, prompt) });
  } catch (err) {
    console.error("draft error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
});

app.post("/api/grade", async (req, res) => {
  const model = (req.body?.model || DEFAULT_MODEL).trim();
  const task = (req.body?.task || "recall").trim();
  const prompt = (req.body?.prompt || "").trim();
  const draft = (req.body?.draft || "").trim();
  if (!prompt || !draft) return res.status(400).json({ error: "missing_fields" });
  if (!getTask(task)) return res.status(400).json({ error: "unknown_task" });
  if (!getModel(model)) return res.status(400).json({ error: "unknown_model" });
  if (!hasKey(model)) return res.json({ error: "no_api_key" });
  try {
    res.json(await gradeSubmission(model, task, prompt, draft));
  } catch (err) {
    console.error("grade error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 8123;
app.listen(PORT, () => {
  console.log(`You Got It! running at http://localhost:${PORT}`);
  const live = Object.values(MODELS).filter((m) => hasKey(m.id)).map((m) => m.label);
  console.log(live.length ? `Live models: ${live.join(", ")}.` : "No API keys set — running in demo mode.");
});
