// Shared Claude logic used by both the local Express server (server.js) and the
// Vercel serverless functions (api/draft.js, api/grade.js).

import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  DRAFT_SYSTEM,
  GRADER_SYSTEM,
  GRADE_SCHEMA,
  gradeUserMessage,
} from "../prompts.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

function textOf(response) {
  const block = (response.content || []).find((b) => b.type === "text");
  return block ? block.text : "";
}

// Generate the letter from the learner's prompt (naive general-assistant behaviour).
export async function generateDraft(prompt) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: DRAFT_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort: "low" },
  });
  return textOf(response).trim();
}

// Grade the submission against the planted-trap rubric; returns { summary, checks: [...] }.
export async function gradeSubmission(prompt, draft) {
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
  return JSON.parse(textOf(response) || "{}");
}
