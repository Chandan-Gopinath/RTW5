// Transactional email via Brevo. The magic-link sign-in email plus the reminder
// engine's daily nudge + weekly recap all share one branded, email-client-safe
// shell and one low-level sender.
// DEV_ECHO_LINK=1 skips the network call and logs instead, so flows are testable
// locally without an inbox.

const APP = () => process.env.APP_URL || "https://you-got-it.vercel.app";

function esc(s) {
  return String(s || "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

// Low-level send. Returns { echoed: true } in dev, { echoed: false } after a live send.
export async function sendEmail({ to, subject, html }) {
  if (process.env.DEV_ECHO_LINK === "1") {
    console.log("[dev] email to", to, "-", subject);
    return { echoed: true };
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER, name: "You Got It!" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      replyTo: { email: "chandan.g.rao@gmail.com", name: "You Got It!" },
    }),
  });
  if (!res.ok) throw new Error(`Brevo error ${res.status}: ${await res.text()}`);
  return { echoed: false };
}

// Shared branded shell (inline styles, table layout, hosted PNG logo). `bodyHtml`
// is trusted, pre-escaped HTML; `footer` is a short plain legitimacy line.
function shell({ heading, bodyHtml, footer }) {
  const logo = `${APP()}/email-logo.png`;
  const foot = footer
    ? `<p style="font-size:13px;line-height:1.6;color:#8A8A90;margin:0;border-top:1px solid #ECECE7;padding-top:18px;">${footer}</p>`
    : "";
  return `
  <div style="background:#FCFCFA;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#18181C;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #ECECE7;border-radius:16px;">
      <tr><td style="padding:32px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="${logo}" width="40" height="40" alt="You Got It!" style="display:block;border:0;"></td>
          <td style="padding-left:11px;font-weight:bold;font-size:19px;color:#18181C;vertical-align:middle;">You Got It!</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:26px 32px 0;">
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.2;margin:0 0 10px;color:#18181C;font-weight:bold;">${heading}</h1>
      </td></tr>
      <tr><td style="padding:0 32px;">${bodyHtml}</td></tr>
      <tr><td style="padding:22px 32px 32px;">${foot}</td></tr>
    </table>
  </div>`;
}

function ctaButton(href, label) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;"><tr>
    <td style="background:#18181C;border-radius:9px;">
      <a href="${href}" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:bold;color:#FCFCFA;text-decoration:none;">${label}</a>
    </td>
  </tr></table>`;
}

function para(text) {
  return `<p style="font-size:15px;line-height:1.6;color:#44444A;margin:0 0 20px;">${text}</p>`;
}

// ---- Magic-link sign-in ---------------------------------------------------

function magicLinkHtml(link, { name, returning } = {}) {
  const first = esc((name || "").trim());
  const heading = first ? (returning ? `Welcome back, ${first}!` : `Welcome, ${first}!`) : "Welcome to You Got It!";
  const body =
    para("Your secure sign-in link is ready &mdash; tap below and you're in. It's where practice managers build real AI skills on the work already on their desk.") +
    ctaButton(link, "Sign in to You Got It! &rarr;") +
    `<p style="font-size:13px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:#8A8A90;margin:22px 0 10px;">What happens next</p>` +
    para("You'll land on <strong>Your Desk</strong>, pick a real task &mdash; like a patient recall letter &mdash; practise it with AI on <span style=\"background:#EFE84B;padding:0 3px;\">safe, synthetic data</span>, and get instant feedback graded on the judgment that matters.");
  return shell({
    heading,
    bodyHtml: body,
    footer: "This link expires in <strong>15 minutes</strong> and can be used once. If you didn't request it, you can safely ignore this email.",
  });
}

export async function sendMagicLink(email, link, { name, returning } = {}) {
  const first = (name || "").trim().replace(/[\r\n]+/g, " ");
  const subject = first
    ? (returning ? `Welcome back, ${first}!` : `${first}, welcome to You Got It!`)
    : "Your You Got It! sign-in link";

  if (process.env.DEV_ECHO_LINK === "1") {
    console.log("[dev] magic link for", email, "->", link);
    return { echoed: true, link };
  }
  await sendEmail({ to: email, subject, html: magicLinkHtml(link, { name, returning }) });
  return { echoed: false };
}

// ---- Reminder: daily nudge ------------------------------------------------

const REMINDER_FOOTER =
  "You're getting this because you signed up for You Got It! &mdash; a daily habit for AI at work. Use the unsubscribe link in your mail app to stop these reminders.";

// task: { title, path, refreshLine, mode }  (from lib/reminders.js TASK_META + pickDailyTask)
function dailyNudgeHtml({ name, task }) {
  const first = esc((name || "").trim());
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const href = `${APP()}${task.path}${task.path.includes("?") ? "&" : "?"}src=daily`;
  const heading = task.mode === "refresh" ? "Today's quick refresh" : "Today's focus";
  const lead =
    task.mode === "refresh"
      ? `${greeting} you've practised ${esc(task.title)} before &mdash; let's keep it sharp. ${esc(task.refreshLine)}`
      : `${greeting} there's a real task waiting on your desk: ${esc(task.title)}. Ten minutes, safe synthetic data, instant feedback.`;
  const body = para(lead) + ctaButton(href, task.mode === "refresh" ? "Refresh it now &rarr;" : "Practise now &rarr;");
  return shell({ heading, bodyHtml: body, footer: REMINDER_FOOTER });
}

export async function sendDailyNudge(email, { name, task } = {}) {
  const subject = task.mode === "refresh"
    ? "A quick 10-minute refresh on your desk"
    : "Today's focus is ready on your desk";
  await sendEmail({ to: email, subject, html: dailyNudgeHtml({ name, task }) });
  return { echoed: process.env.DEV_ECHO_LINK === "1" };
}

// ---- Reminder: weekly recap -----------------------------------------------

// stats: from lib/reminders.js weeklyStats()
function weeklyRecapHtml({ name, stats }) {
  const first = esc((name || "").trim());
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const href = `${APP()}/dashboard.html?src=weekly`;

  let body;
  if (stats.activeThisWeek) {
    const streakLine =
      stats.streakUnlocked && stats.streak > 0
        ? ` You're on a <strong>${stats.streak}-day streak</strong> &mdash; nice.`
        : "";
    const nextLine =
      stats.pointsToNext > 0 && stats.nextLevelName
        ? ` Just <strong>${stats.pointsToNext} points</strong> to <em>${esc(stats.nextLevelName)}</em>.`
        : "";
    body =
      para(`${greeting} here's your week.`) +
      para(
        `You earned <span style="background:#EFE84B;padding:0 3px;"><strong>+${stats.pointsThisWeek} points</strong></span> across <strong>${stats.tasksThisWeek} task${stats.tasksThisWeek === 1 ? "" : "s"}</strong>.${streakLine}`,
      ) +
      para(`You're <strong>Level ${stats.level} &mdash; ${esc(stats.levelName)}</strong>.${nextLine}`) +
      ctaButton(href, "Keep it going &rarr;");
  } else {
    body =
      para(`${greeting} no pressure &mdash; your desk is here whenever you're ready.`) +
      para("A single ten-minute task, on safe synthetic data, is a great way back in. You've got this.") +
      ctaButton(href, "Pick a task &rarr;");
  }
  return shell({ heading: "Your week at You Got It!", bodyHtml: body, footer: REMINDER_FOOTER });
}

export async function sendWeeklyRecap(email, { name, stats } = {}) {
  const subject = stats.activeThisWeek
    ? `Your week: +${stats.pointsThisWeek} points`
    : "Your desk is here whenever you're ready";
  await sendEmail({ to: email, subject, html: weeklyRecapHtml({ name, stats }) });
  return { echoed: process.env.DEV_ECHO_LINK === "1" };
}
