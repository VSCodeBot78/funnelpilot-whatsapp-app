import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Mock-only: no paid calls, Instagram or WhatsApp messages.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-usd2-lab-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.PETE_MOBILE_LAB_ENABLED = "true";
process.env.PETE_MOBILE_LAB_ISOLATED_DATA = "true";
process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD = "4323801";
process.env.PETE_LAB_GPT54_USD2_APPROVED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
process.env.PETE_LLM_API_CALLS_APPROVED = "true";
process.env.OPENAI_MODEL = "gpt-5.4";
process.env.OPENAI_API_KEY = "fixture-only-not-real";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
process.env.WHATSAPP_ALLOW_ALL_RECIPIENTS = "false";

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { isApprovedPrivateLabGpt54, getPeteBudgetStatus,
  getPeteBudgetStatusSafe, reservePeteBudget } =
  await import("../services/pete-api-budget.service.js");
const { isPeteLlmReadyForProvider } =
  await import("../core/pete-llm-conversation.js");
const send = (leadId: string, messageText: string) =>
  processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural", messageText });

test("Private Pete lab GPT-5.4: explicit permission and separate 2 USD limit", async t => {
  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
    for (const name of ["PETE_MOBILE_LAB_ENABLED", "PETE_MOBILE_LAB_ISOLATED_DATA",
      "PETE_PROJECT_PRIOR_SPEND_MICRO_USD", "PETE_LAB_GPT54_USD2_APPROVED",
      "PETE_LLM_CONVERSATION_ENABLED", "PETE_LLM_API_CALLS_APPROVED",
      "OPENAI_MODEL", "OPENAI_API_KEY"]) delete process.env[name];
    clearConversationStore();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  await t.test("API key without explicit extra approval cannot call model", async () => {
    clearConversationStore();
    writeSettings({ aiEnabled: false });
    assert.equal(isPeteLlmReadyForProvider(), false);
    let calls = 0;
    globalThis.fetch = async () => {
      calls++; throw Error("no authorized provider calls");
    };
    const out = await send("lab_gpt54_without_approval_123456789",
      "Wegen Schichtarbeit habe ich kaum Zeit.");
    assert.equal(calls, 0);
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.answers.peteLlmFailureReason, "not_authorized");
  });
  await t.test("approved lab uses GPT-5.4, and tracks prior project charges", async () => {
    clearConversationStore();
    process.env.PETE_LAB_GPT54_USD2_APPROVED = "true";
    assert.equal(isApprovedPrivateLabGpt54(), true);
    assert.equal(isPeteLlmReadyForProvider(), true);
    const before = getPeteBudgetStatus();
    assert.equal(before.model, "gpt-5.4");
    assert.equal(before.priorConfirmedUsd, 4.5839);
    assert.equal(before.committedUsd, 4.5839);
    assert.equal(before.hardCapUsd, 8);
    assert.equal(before.testCapUsd, 2);
    assert.equal(before.testRemainingUsd, 2);
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "gpt-5.4");
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 800);
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify({
          reply: "Schichtarbeit macht feste Zeiten schwierig. Wir können zuerst schauen, wo du im Alltag Luft hast.",
          needsHuman: false,
        }) }] }],
        usage: { input_tokens: 1000, output_tokens: 100 },
      }), { status: 200 });
    };
    const out = await send("lab_gpt54_shift_approved_1234567890",
      "Sowohl als auch. Wegen Schichtarbeit habe ich kaum Zeit.");
    assert.equal(calls, 1);
    assert.equal(out.state.owner, "ai");
    assert.equal(out.state.answers.peteReplySource, "llm");
    assert.match(out.text ?? "", /Schichtarbeit/);
    const after = getPeteBudgetStatus();
    assert.equal(after.requestsStarted, 1);
    assert.equal(after.requestsMetered, 1);
    assert.equal(after.testSpentUsd, 0.004);
    assert.equal(after.committedUsd, 4.5879);
    assert.equal(after.reservedUsd, 0);
  });
  await t.test("STOP and verified keywords bypass paid GPT", async () => {
    clearConversationStore();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++; throw Error("safety and official links should be deterministic");
    };
    const stop = await send("lab_gpt54_stop_12345678900000", "Bitte nicht mehr schreiben.");
    assert.equal(stop.state.flags.stopped, true);
    const check = await send("lab_gpt54_check_1234567890000", "CHECK");
    assert.equal(check.state.answers.peteReplySource, "verified_transaction");
    assert.match(check.text ?? "", /check\.jochen-kammerer\.de/);
    assert.equal(calls, 0);
  });
  await t.test("unmetered outstanding calls cannot exceed 2 USD of new charges", () => {
    const request = { model: "gpt-5.4", requestBody: "z".repeat(17000),
      maxOutputTokens: 800 };
    let held = 0;
    for (let i = 0; i < 50; i++) {
      try { reservePeteBudget(request); held++; }
      catch (err: any) {
        assert.equal(err.reason, "exhausted");
        break;
      }
    }
    assert.ok(held > 0 && held < 50);
    const current = getPeteBudgetStatus();
    assert.ok(current.testSpentUsd !== null && current.testSpentUsd <= 2);
    assert.ok(current.committedUsd <= 6.5839);
    assert.ok(current.reservedUsd > 0);
    assert.equal(current.requestsStarted, held + 1);
    assert.throws(() => reservePeteBudget(request),
      (err: any) => err.reason === "exhausted");
    assert.ok(getPeteBudgetStatus().remainingUsd < 0.075);
  });
  await t.test("wrong model or enabled outbound send fails closed", () => {
    process.env.INSTAGRAM_SEND_ENABLED = "true";
    try {
      assert.equal(isApprovedPrivateLabGpt54(), false);
      assert.equal(isPeteLlmReadyForProvider(), false);
      assert.equal(getPeteBudgetStatusSafe().ok, false);
    } finally { process.env.INSTAGRAM_SEND_ENABLED = "false"; }
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    try {
      assert.equal(isApprovedPrivateLabGpt54(), false);
      assert.equal(isPeteLlmReadyForProvider(), false);
      assert.equal(getPeteBudgetStatusSafe().ok, false);
    } finally { process.env.OPENAI_MODEL = "gpt-5.4"; }
  });
});
