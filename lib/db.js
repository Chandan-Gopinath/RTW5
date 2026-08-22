// Neon Postgres client + Drizzle schema. The Neon HTTP driver is used so
// serverless functions don't exhaust Postgres connections on Vercel.
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
});

export const magicTokens = pgTable("magic_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// One row per graded run — powers per-user history, the admin users-view,
// and (later) gamification.
export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull(),
  model: text("model"),
  prompt: text("prompt"),
  draft: text("draft"),
  passed: boolean("passed").notNull(),
  checksPassed: integer("checks_passed").notNull(),
  total: integer("total").notNull(),
  verdicts: jsonb("verdicts"),
  attemptNo: integer("attempt_no").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per piece of user feedback (thumbs + optional note). userId is nullable
// for safety; context records where it came from (e.g. "grade:recall", "menu").
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  context: text("context"),
  rating: text("rating"), // "up" | "down"
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tiny key/value store for global settings (e.g. the active grading model).
export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

let _db;
export function db() {
  if (!_db) _db = drizzle(neon(process.env.DATABASE_URL), { schema: { users, magicTokens, sessions, attempts, feedback, appConfig } });
  return _db;
}
