import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// No real API, Meta messages or customer data in this test.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase59-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { isSalesFollowUpOptOut } = await import("../core/pete-conversation-quality.js");
const { evaluateGhostingState } = await import("../services/ghosting.service.js");
const { evaluateProviderBookingFollowUp } = await import("../services/provider-booking.service.js");
const { evaluateLatestAiOutboundPermission } = await import("../services/ai-outbound-guard.service.js");
const { persistConversationState } = await import("../core/state-manager.js");
const { getConversationState, clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const send = (leadId: string, messageText: string) =>
  processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural" });

test("Phase 59: sales follow-up refusal is persistent and not a full STOP", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await t.test("detects refusals and ignores ordinary questions or global STOP", () => {
    for (const value of [
      "Passt, ich will erst nachdenken und keine Verkaufsnachricht.",
      "Bitte keine weiteren Angebote.",
      "Kein Marketing-Follow-up mehr, danke.",
      "Bitte nicht mehr mit Werbung anschreiben.",
    ]) assert.equal(isSalesFollowUpOptOut(value), true, value);
    for (const value of [
      "Wie funktioniert das Coaching?",
      "Welche Verkaufsnachricht meinst du?",
      "Bitte nicht mehr schreiben.",
    ]) assert.equal(isSalesFollowUpOptOut(value), false, value);
  });

  await t.test("mocked LLM can answer questions while all automatic follow-ups stay blocked", async () => {
    clearConversationStore();
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    process.env.OPENAI_API_KEY = "fixture-no-network";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    writeSettings({ aiEnabled: true });
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      const request = JSON.parse(String((options as RequestInit).body));
      assert.match(request.instructions, /kein Nachfassen/i);
      assert.match(request.instructions, /wieder dieselben Tipps/i);
      assert.match(request.instructions, /Stagnation nicht automatisch/i);
      return new Response(JSON.stringify({ output: [{ content: [{
        type: "output_text", text: JSON.stringify({
          reply: "Verstanden. Du kannst dich selbst melden, wenn du Fragen hast.",
          needsHuman: false,
        }),
      }] }], usage: { input_tokens: 300, output_tokens: 50 } }), { status: 200 });
    };
    const id = "phase59-optout-lead";
    const first = await send(id, "Passt, ich will erst nachdenken und keine Verkaufsnachricht.");
    assert.equal(first.state.flags.salesFollowUpsOptedOut, true);
    assert.equal(first.state.flags.stopped, false);
    assert.equal(first.state.owner, "ai");
    assert.equal(first.state.aiPaused, false);
    assert.equal(first.state.answers.peteReplySource, "llm");
    const state = getConversationState(id, DEFAULT_CAMPAIGN_ID);
    assert.ok(state);
    state.providerBooking = {
      status: "awaiting_booking", active: true, stage: "inactive",
      linkSentAt: new Date(Date.now() - 72 * 3600000).toISOString(),
      sentHistory: [],
    };
    persistConversationState(state);
    const ghosting = evaluateGhostingState(state, state.ghosting);
    assert.equal(ghosting.dueNow, false);
    assert.match(ghosting.reason, /Verkaufsnachfass/);
    const booking = evaluateProviderBookingFollowUp(state);
    assert.equal(booking.dueNow, false);
    assert.match(booking.reason, /Verkaufsnachfass/);
    const guarded = evaluateLatestAiOutboundPermission({
      leadId: id, campaignId: DEFAULT_CAMPAIGN_ID, purpose: "automated_followup",
    });
    assert.equal(guarded.allowed, false);
    assert.equal(guarded.reason, "sales_followup_opt_out");
    assert.equal(evaluateLatestAiOutboundPermission({
      leadId: id, campaignId: DEFAULT_CAMPAIGN_ID, purpose: "conversation_reply",
    }).allowed, true);
    const next = await send(id, "Was ist generell ein sinnvoller Schlafrhythmus?");
    assert.ok(next.text);
    assert.equal(next.state.flags.salesFollowUpsOptedOut, true);
    assert.equal(next.state.owner, "ai");
    assert.equal(calls, 2);
    assert.equal(evaluateProviderBookingFollowUp(next.state).dueNow, false);
  });

  await t.test("persists without model and STOP takes precedence", async () => {
    clearConversationStore();
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    globalThis.fetch = async () => { throw Error("No API calls permitted"); };
    const id = "phase59-no-model";
    const first = await send(id, "Bitte keine weiteren Angebote.");
    assert.equal(first.state.flags.salesFollowUpsOptedOut, true);
    assert.equal(first.state.flags.stopped, false);
    const stop = await send(id, "Bitte nicht mehr schreiben.");
    assert.equal(stop.state.flags.stopped, true);
    assert.equal((await send(id, "Hallo?")).text, null);
  });
});
