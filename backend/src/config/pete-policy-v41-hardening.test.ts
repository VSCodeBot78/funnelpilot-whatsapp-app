import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Synthetic-only. API calls are mocked and transport send flags stay false.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-v41-guards-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.OPENAI_MODEL = "gpt-6.1-sol";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
process.env.PETE_LLM_API_CALLS_APPROVED = "true";
process.env.OPENAI_API_KEY = "offline-fixture-not-real";

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { peteSafeNoncriticalExplanationReply, isPeteChestBreathingEmergency } =
  await import("../core/pete-conversation-quality.js");

function state(...texts: string[]) {
  return { messages: texts.map(text => ({ role: "user", text })) } as any;
}

const send = async (leadId: string, messageText: string) =>
  processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural" });

const mock = (needsHuman = true) => new Response(JSON.stringify({
  output: [{ content: [{ type: "output_text", text: JSON.stringify({
    reply: "Das ist eine allgemeine Frage zum Elternalltag.", needsHuman,
  }) }] }],
  usage: { input_tokens: 1100, output_tokens: 65, total_tokens: 1165 },
}), { status: 200 });

test("Policy v4.1: true danger and narrow noncritical responses", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    clearConversationStore();
    fs.rmSync(dir, { force: true, recursive: true });
  });
  writeSettings({ aiEnabled: true, aiModel: "gpt-6.1-sol" });

  await t.test("known H12 short-of-breath wording triggers 112 on FIRST turn and no LLM", async () => {
    clearConversationStore();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("no network on emergency"); };
    assert.equal(isPeteChestBreathingEmergency("Ich habe Brustschmerz und bekomme schlecht Luft."), true);
    const out = await send("v41-h12", "Ich habe Brustschmerz und bekomme schlecht Luft.");
    assert.match(out.text ?? "", /112/);
    assert.match(out.text ?? "", /Nicht trainieren/i);
    assert.doesNotMatch(out.text ?? "", /energie|bauch|stress\/schlaf|was ist dir|was möchtest/i);
    assert.equal(out.state.answers.peteReplySource, "guarded_safety");
    assert.equal(out.state.owner, "human");
    assert.equal(calls, 0);
    const followup = await send("v41-h12", "Kann ich jetzt erst mal mit dem Training weitermachen?");
    assert.equal(followup.text, null);
    assert.equal(followup.replySuppressedReason, "human_owned");
    assert.equal(calls, 0);
  });

  await t.test("pressure on chest and barely any air is also critical", async () => {
    clearConversationStore();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("no LLM"); };
    const out = await send("v41-chest-pressure", "Druck auf der Brust und kaum Luft.");
    assert.match(out.text ?? "", /112/);
    assert.equal(calls, 0);
  });

  await t.test("H06 ordinary coaching entry question does not transfer chat", async () => {
    clearConversationStore();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mock(calls > 1); };
    await send("v41-entry", "Ich bin Vater mit zwei Kindern und will persönliche Begleitung.");
    const out = await send("v41-entry", "Wie ist der Einstieg strukturiert? Ich will nicht einfach einen Pflicht-Call.");
    assert.equal(out.state.owner, "ai");
    assert.equal(out.state.flags.peteRuntimeHandoffActive === true, false);
    assert.equal(out.state.answers.peteReplySource, "safe_noncritical");
    assert.match(out.text ?? "", /5-Wochen-Startphase/);
    assert.match(out.text ?? "", /nicht verbindlich|nicht behaupten/);
    assert.equal(calls, 2);
  });

  await t.test("H07 previous coaches and family interruptions receive real method answer", async () => {
    clearConversationStore();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mock(calls > 1); };
    await send("v41-trust", "Vier Online-Coaches haben nur schöne Pläne verkauft. Ich bin skeptisch.");
    const out = await send("v41-trust", "Wie geht ihr mit Unterbrechungen durch Familie und Überstunden um?");
    assert.equal(out.state.owner, "ai");
    assert.equal(out.state.answers.peteReplySource, "safe_noncritical");
    assert.match(out.text ?? "", /Wiedereinstieg/);
    assert.doesNotMatch(out.text ?? "", /Jochen muss persönlich/);
  });

  await t.test("noncritical fallback is narrow, no financial/medical/explicit human bypass", () => {
    assert.equal(peteSafeNoncriticalExplanationReply(state(
      "Ich nehme Medikamente und habe Atemnot. Wie ist der Einstieg strukturiert?")), null);
    assert.equal(peteSafeNoncriticalExplanationReply(state(
      "Wie ist der Einstieg strukturiert? Bitte Jochen persönlich hier antworten.")), null);
    assert.equal(peteSafeNoncriticalExplanationReply(state(
      "Wie ist der Einstieg strukturiert? Ich habe eine Frage zu Ratenzahlung.")), null);
    assert.equal(peteSafeNoncriticalExplanationReply(state(
      "STOP. Ich will keine weiteren Nachrichten. Wie ist der Einstieg?")), null);
  });

  await t.test("explicit human request still takes owner without a model call", async () => {
    clearConversationStore();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mock(); };
    const out = await send("v41-human", "Bitte lass Jochen persönlich hier übernehmen.");
    assert.equal(out.state.owner, "human");
    assert.equal(calls, 0);
  });

  await t.test("N03: unknown weekly video-call count has a verified noncommittal response", async () => {
    clearConversationStore();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("No paid model needed"); };
    const out = await send("v41-unknown-calls", "Wie viele persönliche Videoanrufe pro Woche sind genau im Preis enthalten?");
    assert.equal(calls, 0);
    assert.equal(out.state.owner, "ai");
    assert.equal(out.state.answers.peteReplySource, "verified_transaction");
    assert.match(out.text ?? "", /nicht hinterlegt/i);
    assert.doesNotMatch(out.text ?? "", /garantiert|sicher.*[1-9].*Calls/i);
    assert.equal(out.state.flags.peteRuntimeHandoffActive === true, false);
  });

  await t.test("N07: selfstarter checkout is independently possible without appointment", async () => {
    clearConversationStore();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("No paid model needed"); };
    const first = await send("v41-no-call", "Ich möchte den Selbststarter selbst kaufen, ohne Strategiegespräch.");
    assert.match(first.text ?? "", /https:\/\//);
    const second = await send("v41-no-call", "Kann ich über den Link direkt kaufen, ohne Pflichttermin?");
    assert.equal(calls, 0);
    assert.equal(second.state.owner, "ai");
    assert.equal(second.state.answers.peteReplySource, "verified_transaction");
    assert.match(second.text ?? "", /ohne vorheriges Strategiegespräch/i);
    assert.match(second.text ?? "", /https:\/\//);
    assert.equal(second.state.flags.peteRuntimeHandoffActive === true, false);
  });

});
