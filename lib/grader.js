// Shared grading logic used by both the local Express server (server.js) and
// the Vercel serverless functions (api/draft.js, api/grade.js).
// Supports multiple providers: Google Gemini and Groq (OpenAI-compatible).
// The scenario/rubric/schema in prompts.js are provider-agnostic; each provider
// adapter below turns them into the right API call.

import {
  DRAFT_SYSTEM,
  getTask,
  getModel,
  DEFAULT_MODEL,
  GRADE_SCHEMA,
  gradeUserMessage,
} from "../prompts.js";

const GEMINI_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Does the given model's provider have its API key configured?
export function hasKey(modelId = DEFAULT_MODEL) {
  const m = getModel(modelId);
  return Boolean(m && process.env[m.envKey]);
}

// Gemini's responseSchema is an OpenAPI subset — strip fields it doesn't accept
// (additionalProperties) rather than keeping two copies of the schema.
function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    const { additionalProperties, ...rest } = schema;
    for (const key of Object.keys(rest)) rest[key] = toGeminiSchema(rest[key]);
    return rest;
  }
  return schema;
}

// --- provider adapters: each takes { system, message, json } and returns text ---

async function callGemini(m, { system, message, json }) {
  const generationConfig = json
    ? { maxOutputTokens: 3000, responseMimeType: "application/json", responseSchema: toGeminiSchema(GRADE_SCHEMA) }
    : { maxOutputTokens: 1200 };
  const res = await fetch(`${GEMINI_ROOT}/${m.model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env[m.envKey] },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `Gemini API error ${res.status}`);
  return body?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGroq(m, { system, message, json }) {
  const payload = {
    model: m.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: message },
    ],
    max_tokens: json ? 3000 : 1200,
    temperature: json ? 0.2 : 0.7,
  };
  // JSON mode guarantees valid JSON (the grader prompt dictates the exact shape).
  if (json) payload.response_format = { type: "json_object" };
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env[m.envKey]}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `Groq API error ${res.status}`);
  return body?.choices?.[0]?.message?.content || "";
}

function generate(modelId, opts) {
  const m = getModel(modelId) || getModel(DEFAULT_MODEL);
  return m.provider === "groq" ? callGroq(m, opts) : callGemini(m, opts);
}

// Generate the letter from the learner's prompt (naive general-assistant behaviour).
export async function generateDraft(modelId, prompt) {
  const text = await generate(modelId, { system: DRAFT_SYSTEM, message: prompt, json: false });
  return text.trim();
}

// Grade the submission against the task's planted-trap rubric.
// Returns { summary, checks: [...] }; throws if the model returns an unexpected shape.
export async function gradeSubmission(modelId, taskId, prompt, draft) {
  const task = getTask(taskId);
  if (!task) throw new Error(`unknown task: ${taskId}`);
  const text = await generate(modelId, {
    system: task.graderSystem,
    message: gradeUserMessage(prompt, draft),
    json: true,
  });
  const data = JSON.parse(text || "{}");
  if (!data || !Array.isArray(data.checks)) throw new Error("grader returned unexpected shape");
  return data;
}
