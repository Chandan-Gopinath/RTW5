// Shared grading logic used by both the local Express server (server.js) and
// the Vercel serverless functions (api/draft.js, api/grade.js).
// Uses the Google Gemini API (generativelanguage.googleapis.com) — swapped in
// as a free-tier alternative while the Anthropic account has no credit.

import {
  MODEL,
  DRAFT_SYSTEM,
  GRADER_SYSTEM,
  GRADE_SCHEMA,
  gradeUserMessage,
} from "../prompts.js";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

export const hasKey = () => Boolean(process.env.GEMINI_API_KEY);

// Gemini's responseSchema is an OpenAPI-subset — strip fields it doesn't accept
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

async function generateContent({ system, message, generationConfig }) {
  const key = process.env.GEMINI_API_KEY;
  const res = await fetch(`${API_ROOT}/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || `Gemini API error ${res.status}`);
  }
  return body?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Generate the letter from the learner's prompt (naive general-assistant behaviour).
export async function generateDraft(prompt) {
  const text = await generateContent({
    system: DRAFT_SYSTEM,
    message: prompt,
    generationConfig: { maxOutputTokens: 1200 },
  });
  return text.trim();
}

// Grade the submission against the planted-trap rubric; returns { summary, checks: [...] }.
export async function gradeSubmission(prompt, draft) {
  const text = await generateContent({
    system: GRADER_SYSTEM,
    message: gradeUserMessage(prompt, draft),
    generationConfig: {
      maxOutputTokens: 3000,
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(GRADE_SCHEMA),
    },
  });
  return JSON.parse(text || "{}");
}
