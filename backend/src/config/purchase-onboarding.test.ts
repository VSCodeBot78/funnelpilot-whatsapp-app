import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "funnel-pilot-purchase-onboarding-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { default: app } = await import("../app.js");
const { getConversationState, clearConversationStore } = await import("../data/store.js");

test("Coaching purchase onboarding is prepared locally, never falsely marked sent", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  const leadId = "fp-onboarding-simulated-buyer";
  const campaignId = "eltern-vital-fit";
  const payload = {
    leadId,
    campaignId,
    event: "checkout.completed",
    paymentStatus: "paid",
    productId: "fp-local-499-test",
    checkoutId: "local-test-checkout-id",
  };

  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    clearConversationStore();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const first = await fetch(base + "/webhook/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 200);
  const response = await first.json() as { ok: boolean; status: string; reply: string };
  assert.equal(response.ok, true);
  assert.equal(response.status, "paid");
  assert.match(response.reply, /Onboarding-Gespräch/u);
  assert.match(response.reply, /https:\/\/calendly.com\//u);

  const state = getConversationState(leadId, campaignId);
  assert.ok(state);
  assert.equal(state.answers.coachingEntryPurchaseStatus, "paid");
  assert.ok(state.answers.onboardingPromptPreparedAt);
  assert.equal(state.answers.onboardingPromptSentAt, undefined);
  assert.equal(state.messages.at(-1)?.role, "assistant");
  assert.notEqual(state.messages.at(-1)?.sent, true);

  const duplicate = await fetch(base + "/webhook/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(duplicate.status, 200);
  const dupe = await duplicate.json() as { duplicated?: boolean };
  assert.equal(dupe.duplicated, true);
  assert.equal(getConversationState(leadId, campaignId)?.messages.length, state.messages.length);
});
