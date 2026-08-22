// Local dev server — serves the static prototype and the two API endpoints.
// On Vercel these endpoints are the serverless functions in /api; this Express
// server is for running the whole thing locally (`npm start`). Both share the
// grading logic in lib/grader.js so there's a single source of truth.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasKey } from "./lib/grader.js";
import { MODELS, DEFAULT_MODEL } from "./prompts.js";
import gradeHandler from "./api/grade.js";
import draftHandler from "./api/draft.js";
import authRequest from "./api/auth/request.js";
import authVerify from "./api/auth/verify.js";
import authMe from "./api/auth/me.js";
import authSignout from "./api/auth/signout.js";
import adminConfig from "./lib/admin/config.js";
import adminUsers from "./lib/admin/users.js";
import adminMetrics from "./lib/admin/metrics.js";
import progressHandler from "./api/progress.js";
import feedbackHandler from "./api/feedback.js";
import adminFeedback from "./lib/admin/feedback.js";
import cronDaily from "./lib/cron/daily.js";
import cronWeekly from "./lib/cron/weekly.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.post("/api/auth/request", (req, res) => authRequest(req, res));
app.get("/api/auth/verify", (req, res) => authVerify(req, res));
app.get("/api/auth/me", (req, res) => authMe(req, res));
app.post("/api/auth/signout", (req, res) => authSignout(req, res));
app.get("/api/admin/config", (req, res) => adminConfig(req, res));
app.post("/api/admin/config", (req, res) => adminConfig(req, res));
app.get("/api/admin/users", (req, res) => adminUsers(req, res));
app.get("/api/admin/metrics", (req, res) => adminMetrics(req, res));
app.post("/api/feedback", (req, res) => feedbackHandler(req, res));
app.get("/api/admin/feedback", (req, res) => adminFeedback(req, res));
app.get("/api/cron/daily", (req, res) => cronDaily(req, res));
app.get("/api/cron/weekly", (req, res) => cronWeekly(req, res));

app.get("/api/models", (req, res) => {
  const models = Object.values(MODELS).map((m) => ({
    id: m.id, label: m.label, provider: m.provider, live: hasKey(m.id),
  }));
  res.json({ models, default: DEFAULT_MODEL });
});

// delegate to the same serverless handlers Vercel uses (single source of truth)
app.post("/api/draft", (req, res) => draftHandler(req, res));
app.post("/api/grade", (req, res) => gradeHandler(req, res));

const PORT = process.env.PORT || 8123;
app.listen(PORT, () => {
  console.log(`You Got It! running at http://localhost:${PORT}`);
  const live = Object.values(MODELS).filter((m) => hasKey(m.id)).map((m) => m.label);
  console.log(live.length ? `Live models: ${live.join(", ")}.` : "No API keys set — running in demo mode.");
});
