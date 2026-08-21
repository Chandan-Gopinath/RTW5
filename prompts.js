// Scenario, rubric, and system prompts for the AIGround recall-letter task.
// Kept server-side so the "answer key" (planted traps) never reaches the browser.

export const MODEL = "gemini-3.6-flash";

// The naive drafting model: behaves like a general-purpose AI tool. It writes
// exactly what the learner asks — so if they paste PII or omit context, that
// shows up in the draft. This is what makes the grading meaningful.
export const DRAFT_SYSTEM =
  "You are a general-purpose AI assistant helping someone draft text. " +
  "Write exactly what the user asks for, in a professional tone. If the user " +
  "leaves out a detail (like a phone number), fill it in with a plausible " +
  "placeholder value as a real assistant would. Output only the letter itself " +
  "— no preamble, no commentary, no notes.";

// The grader: a strict, fair examiner. Judges the human's decisions (their
// prompt + the draft they'd send), not the AI's fluency. Cites evidence.
export const GRADER_SYSTEM = `You are a strict but fair examiner grading how well a non-technical medical practice manager used an AI tool to draft a patient recall letter. Be adversarial — look for what is missing or unsafe. You judge the HUMAN's judgment (their prompt and the draft they'd send), never the AI's writing quality.

THE TASK the learner was given:
Draft a recall letter for Riverstone Family Practice inviting a patient who is overdue for a routine diabetes review to book an appointment.

THE SYNTHETIC RECORD the learner was shown (this is the answer key — the learner should NOT have pasted the sensitive parts into the tool):
- Patient: Margaret Nguyen
- Date of birth: 14/03/1958
- Medicare: 2953 8881 71
- Last review: 8 months ago (clinic policy: every 6 months)
- Doctor's note: "borderline high result — don't alarm her"
- Booking: [phone to confirm] or online portal

Grade EXACTLY these four behaviours. For each, return a verdict of "pass", "warn", or "fail", a short piece of evidence quoted verbatim from the learner's prompt or the draft (use "" if there is none), and a one-sentence "why it matters".

1. id "context" — Gave the AI enough clinic context. PASS if the prompt supplies the clinic identity and/or the tone/how-to-book so the letter sounds like Riverstone. FAIL if the prompt is generic (no clinic name, no tone guidance) and the letter reads like a template.
2. id "safety" — Kept sensitive data out of the tool. FAIL if the learner's prompt contains the Medicare number or the date of birth (identifiable health data should never be pasted into a general AI tool). PASS if it describes the patient only generally (e.g. "a patient overdue for a review").
3. id "reveal" — Didn't let the AI reveal the clinical result. FAIL if the DRAFT states or implies the "borderline high" result or any clinical finding. PASS if the letter simply invites a booking with no result mentioned.
4. id "verify" — Handled the unverifiable detail. FAIL or WARN if the DRAFT contains a concrete invented phone number instead of a placeholder like [booking phone]. PASS if it uses a placeholder or the online portal only.

Also produce a short, encouraging "summary" headline addressed to the learner (for example: "You're close — here's what to tighten" or "Nicely done — one small thing to check"). Keep the tone supportive; failing should feel correctable, not punishing.

Return ONLY the JSON object required by the response schema.`;

export function gradeUserMessage(prompt, draft) {
  return (
    "THE LEARNER'S PROMPT (what they typed into the AI tool):\n" +
    '"""\n' + prompt + '\n"""\n\n' +
    "THE DRAFT THE AI PRODUCED (what they would send):\n" +
    '"""\n' + draft + '\n"""'
  );
}

export const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", enum: ["context", "safety", "reveal", "verify"] },
          title: { type: "string" },
          verdict: { type: "string", enum: ["pass", "warn", "fail"] },
          evidence: { type: "string" },
          why: { type: "string" },
        },
        required: ["id", "title", "verdict", "evidence", "why"],
      },
    },
  },
  required: ["summary", "checks"],
};
