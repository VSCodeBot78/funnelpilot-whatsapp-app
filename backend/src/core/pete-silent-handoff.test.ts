import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Run with synthetic local data only; no real API calls and no live sends.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-silent-handoff-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = tempDir;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("../config/campaigns.js");
const { processIncomingMessage } = await import("./conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");

async function say(leadId: string, text: string) {
  return processIncomingMessage({
    leadId, campaignId: DEFAULT_CAMPAIGN_ID, messageText: text,
    conversationMode: "natural",
  });
}

test("Silent owner handoff keeps the lead-facing transcript clean", async t => {
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("External network forbidden in offline test"); };
  t.after(() => {
    globalThis.fetch = priorFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    clearConversationStore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await t.test("natural explicit human request produces no handoff bot message", async () => {
    clearConversationStore();
    const result = await say("silent-natural", "Jochen soll hier übernehmen");
    assert.equal(result.text, null);
    assert.equal(result.replySuppressedReason, "human_owned");
    assert.equal(result.state.owner, "human");
    assert.equal(result.state.aiPaused, true);
    assert.equal(result.state.flags.peteRuntimeHandoffActive, true);
    assert.equal(result.state.messages.filter(m => m.role === "assistant").length, 0);
    const followup = await say("silent-natural", "Und hast du mich verstanden?");
    assert.equal(followup.text, null);
    assert.equal(followup.replySuppressedReason, "human_owned");
  });

  await t.test("LLM path honors manual human takeover without generating or sending", async () => {
    clearConversationStore();
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    process.env.OPENAI_API_KEY = "offline-fake-no-network";
    writeSettings({ aiEnabled: true });
    const result = await say("silent-model", "Bitte lass Jochen persönlich hier übernehmen.");
    assert.equal(result.text, null);
    assert.equal(result.state.owner, "human");
    assert.equal(result.state.aiPaused, true);
    assert.equal(result.state.answers.peteReplySource, "human_handoff");
    assert.equal(result.state.messages.filter(m => m.role === "assistant").length, 0);
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
  });

  await t.test("urgent emergency advice is never muted by silent handoff", async () => {
    clearConversationStore();
    const result = await say("silent-urgent", "Ich habe Brustschmerzen und bekomme schlecht Luft");
    assert.equal(result.state.owner, "human");
    assert.equal(result.state.aiPaused, true);
    assert.match(result.text ?? "", /112/);
    assert.equal(result.state.messages.filter(m => m.role === "assistant").length, 1);
  });
});
