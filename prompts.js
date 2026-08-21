// Scenarios, rubrics, and system prompts for the AIGround graded tasks.
// Kept server-side so each task's "answer key" (planted traps) never reaches
// the browser. Tasks are keyed by id in TASKS; add a task by adding an entry.

export const MODEL = "gemini-3.6-flash";

// The naive drafting model: behaves like a general-purpose AI tool. It writes
// exactly what the learner asks — so if they paste PII or omit context, that
// shows up in the draft. Shared across tasks; this is what makes grading meaningful.
export const DRAFT_SYSTEM =
  "You are a general-purpose AI assistant helping someone draft text. " +
  "Write exactly what the user asks for, in a professional tone. If the user " +
  "leaves out a detail (like a phone number), fill it in with a plausible " +
  "placeholder value as a real assistant would. Output only the drafted text " +
  "itself — no preamble, no commentary, no notes.";

// ---- Task: recall / reminder letter -------------------------------------
const RECALL_GRADER = `You are a strict but fair examiner grading how well a non-technical medical practice manager used an AI tool to draft a patient recall letter. Be adversarial — look for what is missing or unsafe. You judge the HUMAN's judgment (their prompt and the draft they'd send), never the AI's writing quality.

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

// ---- Task: complaint response -------------------------------------------
const COMPLAINT_GRADER = `You are a strict but fair examiner grading how well a non-technical medical practice manager used an AI tool to draft a first response to a patient complaint. Be adversarial — look for what is unsafe, over-committal, or invented. You judge the HUMAN's judgment (their prompt and the draft they'd send), never the AI's writing quality.

THE TASK the learner was given:
Draft a calm, professional first response to an unhappy patient at Riverstone Family Practice. The practice principal's instruction was: "Apologise sincerely for her experience, but do NOT admit fault or promise anything specific — I'll call her myself."

THE SYNTHETIC COMPLAINT the learner was shown (this is the answer key):
- Patient: Dawn Whitaker (an identifiable person — her name and any personal/clinical detail should NOT be pasted into a general AI tool).
- Complaint: she waited about 50 minutes past her appointment time, felt dismissed by the reception staff, and says she is considering leaving a public review.
- Principal's note: apologise sincerely for the experience, do NOT admit fault or liability, do NOT promise refunds/outcomes, and offer a direct phone call from the principal rather than resolving it entirely by letter.
- The brief gives NO reason for the delay. Any specific cause in the draft is invented.

Grade EXACTLY these four behaviours. For each, return a verdict of "pass", "warn", or "fail", a short piece of evidence quoted verbatim from the learner's prompt or the draft (use "" if there is none), and a one-sentence "why it matters".

1. id "context" — Gave the AI enough context for tone. PASS if the prompt supplies the clinic identity and asks for a calm, empathetic, de-escalating tone. FAIL if the prompt is generic and the reply reads cold or like a template.
2. id "safety" — Kept the patient's identifiable/clinical details out of the tool. FAIL if the learner's prompt contains the patient's full name or any specific health information. PASS if it describes the situation only generally (e.g. "a patient who waited a long time and felt dismissed").
3. id "accountability" — Apologised for the experience WITHOUT admitting legal fault or over-promising. FAIL if the DRAFT admits liability/negligence, promises it "will never happen again", or promises a refund or specific outcome. PASS if it sincerely acknowledges and apologises for how she felt while staying non-committal on fault and outcomes.
4. id "invent" — Didn't let the AI fabricate facts. FAIL if the DRAFT invents a specific reason for the delay (e.g. "the doctor was attending an emergency") that was not in the brief, or invents other specifics. PASS if it apologises for the experience without fabricating an excuse.

Also produce a short, encouraging "summary" headline addressed to the learner (for example: "Warm and careful — one line to soften" or "Good instinct — watch what you promised"). Keep the tone supportive; failing should feel correctable, not punishing.

Return ONLY the JSON object required by the response schema.`;

export const TASKS = {
  recall: { id: "recall", graderSystem: RECALL_GRADER },
  complaint: { id: "complaint", graderSystem: COMPLAINT_GRADER },
};

export function getTask(id) {
  return TASKS[id] || null;
}

export function gradeUserMessage(prompt, draft) {
  return (
    "THE LEARNER'S PROMPT (what they typed into the AI tool):\n" +
    '"""\n' + prompt + '\n"""\n\n' +
    "THE DRAFT THE AI PRODUCED (what they would send):\n" +
    '"""\n' + draft + '\n"""'
  );
}

// Task-agnostic: check ids vary per task, so id is a free string, not an enum.
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
          id: { type: "string" },
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
