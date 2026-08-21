import { db, appConfig } from "./db.js";
import { eq } from "drizzle-orm";
import { getModel, DEFAULT_MODEL } from "../prompts.js";

const ACTIVE_MODEL_KEY = "grading_model";

// The globally-active grading model (admin-controlled). Falls back to the
// default if unset or invalid — grading never breaks on a bad config row.
export async function getActiveModel() {
  try {
    const row = (await db().select().from(appConfig).where(eq(appConfig.key, ACTIVE_MODEL_KEY)))[0];
    if (row && getModel(row.value)) return row.value;
  } catch (_) { /* fall through to default */ }
  return DEFAULT_MODEL;
}

export async function setActiveModel(id) {
  if (!getModel(id)) throw new Error("unknown_model");
  await db().insert(appConfig)
    .values({ key: ACTIVE_MODEL_KEY, value: id, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appConfig.key, set: { value: id, updatedAt: new Date() } });
}
