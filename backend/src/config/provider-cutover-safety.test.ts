import assert from "node:assert/strict";
import test from "node:test";

// Test-only transport activation to prove the recipient gate survives a
// mistakenly-enabled switch. ALL HTTP requests in this test are mocked.
process.env.NODE_ENV = "test";
process.env.WHATSAPP_SEND_ENABLED = "true";
process.env.WHATSAPP_ALLOWED_RECIPIENT_IDS = "491701234567";
process.env.WHATSAPP_ALLOW_ALL_RECIPIENTS = "false";
process.env.META_ACCESS_TOKEN = "synthetic-meta-test-token";
process.env.META_PHONE_NUMBER_ID = "synthetic-phone-id";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";

const { isWhatsappRecipientAllowed } =
  await import("../services/whatsapp-recipient-gate.service.js");
const { sendMetaWhatsappTextMessage } =
  await import("../services/meta-whatsapp-api.service.js");
const { sendMetaInstagramTextMessage } =
  await import("../services/meta-instagram-api.service.js");
const { evaluateInstagramAutomationGate } =
  await import("../services/instagram-automation-gate.service.js");

test("WhatsApp fail-closed gate blocks empty, malformed, other numbers and empty lists", () => {
  assert.equal(isWhatsappRecipientAllowed("491701234567", []), false);
  assert.equal(isWhatsappRecipientAllowed("", ["491701234567"], true), false);
  assert.equal(isWhatsappRecipientAllowed("491701234568", ["491701234567"], false), false);
  assert.equal(isWhatsappRecipientAllowed("491701234568", ["491701234567"], true), false);
  assert.equal(isWhatsappRecipientAllowed("abc", [], true), false);
  assert.equal(isWhatsappRecipientAllowed("+491701234567", ["491701234567"]), true);
  assert.equal(isWhatsappRecipientAllowed("491701234567", ["+491701234567"]), true);
  assert.equal(isWhatsappRecipientAllowed("491701234567", [], true), true);
  assert.equal(isWhatsappRecipientAllowed("491701234567", ["491701234567"]), true);
});

test("WhatsApp send switch ON but unapproved lead NEVER reaches provider HTTP", async () => {
  const fetchBefore = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("TEST MUST NOT CALL NETWORK");
  };
  try {
    const blocked = await sendMetaWhatsappTextMessage({
      to: "491701234568", body: "Bitte nicht an fremde Nummer senden",
    });
    assert.deepEqual(blocked, {
      ok: true, sent: false, dryRun: true, sendSkipped: true,
      reason: "recipient_not_allowlisted",
    });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

test("Allowed synthetic WhatsApp test number reaches ONLY mocked provider", async () => {
  const fetchBefore = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return {
      ok: true, json: async () => ({
        messages: [{ id: "synthetic-provider-mid-not-delivered" }],
      }),
    } as Response;
  };
  try {
    const simulated = await sendMetaWhatsappTextMessage({
      to: "+491701234567", body: "Nur ein synthetischer Test",
    });
    assert.equal(simulated.ok, true);
    assert.equal(simulated.sent, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.to, "+491701234567");
    assert.match(calls[0].url, /graph\.facebook\.com/);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

test("Instagram still requires explicit sender permission and remains disabled in standard test", async () => {
  assert.deepEqual(evaluateInstagramAutomationGate({
    senderId: "synthetic-id", engineEnabled: false,
    allowedSenderIds: ["synthetic-id"], allowAllSenders: false,
  }), { allowed: false, reason: "engine_disabled" });
  assert.deepEqual(evaluateInstagramAutomationGate({
    senderId: "other-id", engineEnabled: true,
    allowedSenderIds: ["synthetic-id"], allowAllSenders: false,
  }), { allowed: false, reason: "sender_not_allowlisted" });

  const fetchBefore = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("NOT ALLOWED");
  };
  try {
    const blocked = await sendMetaInstagramTextMessage({
      to: "synthetic-id", body: "Kein Live-Send",
    });
    assert.equal(blocked.sent, false);
    assert.equal(blocked.sendSkipped, true);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
