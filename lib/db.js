// Neon Postgres client + Drizzle schema. The Neon HTTP driver is used so
// serverless functions don't exhaust Postgres connections on Vercel.
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

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

let _db;
export function db() {
  if (!_db) _db = drizzle(neon(process.env.DATABASE_URL), { schema: { users, magicTokens, sessions } });
  return _db;
}
