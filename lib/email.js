// Sends the magic-link email via Brevo's transactional API.
// DEV_ECHO_LINK=1 skips sending and returns the link so the flow is testable
// locally without an inbox.

const APP = () => process.env.APP_URL || "https://you-got-it.vercel.app";

// Branded, email-client-safe HTML (inline styles, table layout, hosted PNG logo).
function magicLinkHtml(link) {
  const logo = `${APP()}/email-logo.png`;
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
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.2;margin:0 0 10px;color:#18181C;font-weight:bold;">Welcome to You Got It!</h1>
        <p style="font-size:15px;line-height:1.6;color:#44444A;margin:0 0 22px;">Your secure sign-in link is ready &mdash; tap below and you're in. It's where practice managers build real AI skills on the work already on their desk.</p>
      </td></tr>
      <tr><td style="padding:0 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:#18181C;border-radius:9px;">
            <a href="${link}" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:bold;color:#FCFCFA;text-decoration:none;">Sign in to You Got It! &rarr;</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 32px 0;">
        <p style="font-size:13px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:#8A8A90;margin:0 0 10px;">What happens next</p>
        <p style="font-size:15px;line-height:1.6;color:#44444A;margin:0 0 22px;">You'll land on <strong>Your Desk</strong>, pick a real task &mdash; like a patient recall letter &mdash; practise it with AI on <span style="background:#EFE84B;padding:0 3px;">safe, synthetic data</span>, and get instant feedback graded on the judgment that matters.</p>
      </td></tr>
      <tr><td style="padding:0 32px;">
        <p style="font-size:13px;line-height:1.6;color:#8A8A90;margin:0;border-top:1px solid #ECECE7;padding-top:18px;">This link expires in <strong>15 minutes</strong> and can be used once. If you didn't request it, you can safely ignore this email.</p>
      </td></tr>
      <tr><td style="padding:16px 32px 32px;">
        <p style="font-size:13px;line-height:1.6;color:#8A8A90;margin:0 0 6px;">Need a hand? Just reply to this email, or reach us at <a href="mailto:chandan.g.rao@gmail.com" style="color:#18181C;">chandan.g.rao@gmail.com</a>.</p>
        <p style="font-size:12px;color:#A6A6AC;margin:0;">You Got It! &middot; A daily habit for AI at work</p>
      </td></tr>
    </table>
  </div>`;
}

export async function sendMagicLink(email, link) {
  if (process.env.DEV_ECHO_LINK === "1") {
    console.log("[dev] magic link for", email, "->", link);
    return { echoed: true, link };
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER, name: "You Got It!" },
      to: [{ email }],
      subject: "Your You Got It! sign-in link",
      htmlContent: magicLinkHtml(link),
      replyTo: { email: "chandan.g.rao@gmail.com", name: "You Got It!" },
    }),
  });
  if (!res.ok) throw new Error(`Brevo error ${res.status}: ${await res.text()}`);
  return { echoed: false };
}
