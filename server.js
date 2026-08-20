// You Got It! — tiny backend that serves the static prototype and proxies two
// Claude calls for AIGround: generate the draft, and grade the submission.
// The API key is read ONLY from ANTHROPIC_API_KEY and never reaches the browser.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  DRAFT_SYSTEM,
  GRADER_SYSTEM,
  GRADE_SCHEMA,
  gradeUserMessage,
} from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

function textOf(response) {
  const block = (response.content || []).find((b) => b.type === "text");
  return block ? block.text : "";
}

// POST /api/draft { prompt } -> { draft }
app.post("/api/draft", async (req, res) => {
  const prompt = (req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "empty_prompt" });
  if (!hasKey()) return res.json({ error: "no_api_key" });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: DRAFT_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: "low" },
    });
    res.json({ draft: textOf(response).trim() });
  } catch (err) {
    console.error("draft error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
});

// POST /api/grade { prompt, draft } -> { summary, checks: [...] }
app.post("/api/grade", async (req, res) => {
  const prompt = (req.body?.prompt || "").trim();
  const draft = (req.body?.draft || "").trim();
  if (!prompt || !draft) return res.status(400).json({ error: "missing_fields" });
  if (!hasKey()) return res.json({ error: "no_api_key" });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: GRADER_SYSTEM,
      messages: [{ role: "user", content: gradeUserMessage(prompt, draft) }],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: GRADE_SCHEMA },
      },
    });
    const data = JSON.parse(textOf(response) || "{}");
    res.json(data);
  } catch (err) {
    console.error("grade error:", err?.message || err);
    res.status(502).json({ error: "api_error", message: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 8123;
app.listen(PORT, () => {
  console.log(`You Got It! running at http://localhost:${PORT}`);
  console.log(hasKey() ? "ANTHROPIC_API_KEY detected — live grading on." : "No ANTHROPIC_API_KEY — running in demo mode.");
});
