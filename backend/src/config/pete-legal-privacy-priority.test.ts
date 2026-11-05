import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Offline only. No provider credentials or customer data leave this process.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fp-legal-priority-"));
Object.assign(process.env, {
  NODE_ENV: "test", DATA_DIR: temp,
  INSTAGRAM_ENGINE_ENABLED: "false", INSTAGRAM_SEND_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false",
  PETE_LLM_CONVERSATION_ENABLED: "true", PETE_LLM_API_CALLS_APPROVED: "true",
  OPENAI_MODEL: "gpt-6.1-sol", OPENAI_API_KEY: "SYNTHETIC-never-network",
});
const { decidePeteNextAction } = await import("../core/pete-decision-layer.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { writeSettings } = await import("../services/settings-store.js");
const { clearConversationStore } = await import("../data/store.js");
const send = (leadId: string, messageText: string) =>
  processIncomingMessage({ leadId, campaignId: "eltern-vital-fit",
    messageText, conversationMode: "natural" });
test("privacy deletion and payment refund are safety handoffs before Pete or sales", async t => {
  const nativeFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async url => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    calls++;
    return new Response(JSON.stringify({
      usage: { input_tokens: 100, output_tokens: 20 },
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        reply: "Ich beantworte dir die Frage sachlich.", needsHuman: false,
        nextStep: "none", evidenceQuote: "",
      }) }] }],
    }), { status: 200 });
  };
  writeSettings({ aiEnabled: true });
  t.after(() => {
    globalThis.fetch = nativeFetch;
    clearConversationStore();
    fs.rmSync(temp, { recursive: true, force: true });
  });

  for (const [i, text] of [
    "Bitte lösche meine personenbezogenen Daten.",
    "Ich möchte meine Daten löschen lassen.",
    "Meine Zahlung ist abgebucht und ich will eine Rückzahlung.",
    "Ich möchte eine Rückerstattung für die Abbuchung.",
  ].entries()) await t.test("direct safety: " + text, async () => {
    assert.equal(decidePeteNextAction(text).decisionType, "legal_privacy");
    const before = calls;
    const out = await send("legal-priority-" + i, text);
    assert.equal(calls, before, "the model never receives sensitive legal/payment text");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.aiPaused, true);
    assert.equal(out.state.lastActor, "human", "human handoff must be visible in the owner inbox");
    assert.equal(out.state.flags.peteRuntimeHandoffActive, true);
    assert.equal(out.state.answers.peteReplySource, "guarded_safety");
    assert.doesNotMatch(out.text ?? "", /https?:\/\/|bestätigt.*(?:erstattung|buchung)/i);
    const follow = await send("legal-priority-" + i, "Ich möchte nur noch kurz etwas fragen.");
    assert.equal(follow.text, null, "human-owned follow-up stays silent");
    assert.equal(follow.state.owner, "human");
    assert.equal(follow.state.aiPaused, true);
    assert.equal(follow.state.lastActor, "lead", "lastActor tracks the newest inbound message");
    assert.equal(calls, before, "no provider call after human takeover");
  });

  await t.test("emergency notice precedes protected human takeover", async () => {
    const before = calls;
    const out = await send("emergency-priority", "Ich habe Brustschmerzen und bekomme schlecht Luft.");
    assert.match(out.text ?? "", /112/);
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.aiPaused, true);
    assert.equal(out.state.lastActor, "human");
    assert.equal(out.state.flags.peteRuntimeHandoffActive, true);
    assert.equal(calls, before);
    const next = await send("emergency-priority", "Und welche Übungen soll ich machen?");
    assert.equal(next.text, null);
    assert.equal(next.state.owner, "human");
    assert.equal(next.state.aiPaused, true);
    assert.equal(next.state.lastActor, "lead");
    assert.equal(calls, before);
  });

  await t.test("ordinary coaching-price question is not reclassified as legal", () => {
    assert.notEqual(decidePeteNextAction("Was kostet die 5-Wochen-Begleitung?").decisionType, "legal_privacy");
  });
});
