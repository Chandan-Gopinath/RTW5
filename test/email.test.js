import { test } from "node:test";
import assert from "node:assert/strict";

test("sendMagicLink echoes in dev mode without sending", async () => {
  process.env.DEV_ECHO_LINK = "1";
  const { sendMagicLink } = await import("../lib/email.js");
  const out = await sendMagicLink("a@b.co", "https://x/verify?token=t");
  assert.equal(out.echoed, true);
  assert.equal(out.link, "https://x/verify?token=t");
});
