// Sends the magic-link email via Brevo's transactional API.
// DEV_ECHO_LINK=1 skips sending and returns the link so the flow is testable
// locally without an inbox.
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
      htmlContent:
        `<p>Tap to sign in to You Got It!:</p>` +
        `<p><a href="${link}">Sign in</a></p>` +
        `<p>This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Brevo error ${res.status}: ${await res.text()}`);
  return { echoed: false };
}
