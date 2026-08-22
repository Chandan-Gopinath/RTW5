// The reminder batch: loads users + attempts + prior sends, applies the skip /
// idempotency rules (from lib/reminders.js), sends via Brevo (lib/email.js), and
// logs each send. Called by the two cron handlers; kept here so they stay thin
// and the logic is testable without HTTP.

import { db, users, attempts, reminderLog } from "./db.js";
import {
  CATALOG, TASK_META, pickDailyTask, practisedToday, weeklyStats, alreadySent,
} from "./reminders.js";
import { sendDailyNudge, sendWeeklyRecap } from "./email.js";

// Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. Fail closed if the
// secret isn't configured — a public route must never blast emails unauthenticated.
export function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (req.headers?.authorization || "") === `Bearer ${secret}`;
}

function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

// type: "daily" | "weekly". Returns { type, sent, skipped, failed, total }.
export async function runReminderBatch(type, now = new Date()) {
  const [allUsers, allAttempts, allReminders] = await Promise.all([
    db().select().from(users),
    db().select().from(attempts),
    db().select().from(reminderLog),
  ]);
  const attemptsByUser = groupBy(allAttempts, "userId");
  const remindersByUser = groupBy(allReminders, "userId");

  let sent = 0, skipped = 0, failed = 0;

  for (const u of allUsers) {
    const userAttempts = attemptsByUser.get(u.id) || [];
    const userReminders = remindersByUser.get(u.id) || [];

    // idempotency — already sent this period? (safe cron retries)
    if (alreadySent(userReminders, type, now)) { skipped++; continue; }

    try {
      if (type === "daily") {
        // don't nag someone who already showed up today
        if (practisedToday(userAttempts, now)) { skipped++; continue; }
        const pick = pickDailyTask(CATALOG, userAttempts, now);
        if (!pick) { skipped++; continue; }
        const task = { ...TASK_META[pick.taskId], mode: pick.mode };
        await sendDailyNudge(u.email, { name: u.name, task });
        await db().insert(reminderLog).values({
          userId: u.id, type: "daily", meta: { taskId: pick.taskId, mode: pick.mode },
        });
        sent++;
      } else if (type === "weekly") {
        const stats = weeklyStats(userAttempts, now);
        await sendWeeklyRecap(u.email, { name: u.name, stats });
        await db().insert(reminderLog).values({
          userId: u.id, type: "weekly",
          meta: { pointsThisWeek: stats.pointsThisWeek, tasksThisWeek: stats.tasksThisWeek, active: stats.activeThisWeek },
        });
        sent++;
      } else {
        skipped++;
      }
    } catch (e) {
      // one user's failure never aborts the batch; no log row → it retries next run
      console.error(`reminder ${type} failed for ${u.id}:`, e?.message || e);
      failed++;
    }
  }

  return { type, sent, skipped, failed, total: allUsers.length };
}
