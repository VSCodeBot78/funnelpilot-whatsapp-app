import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Offline test: mocked provider checks routing and source attribution.
// It is NOT an evaluation of real model quality or proof of remote delivery.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-stopfe-qa-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.FUNNELPILOT_LOCAL_TEST_MODE = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { detectLeadIntent } = await import("../core/intent-detector.js");
const { classifyPeteObjection } = await import("../core/pete-objection-handler.js");
const { decidePeteNextAction } = await import("../core/pete-decision-layer.js");
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getPeteBudgetStatus } = await import("../services/pete-api-budget.service.js");
const { clearConversationStore } = await import("../data/store.js");

const ordinaryMessages = [
  "Ich nehme mir Essen mit, aber meine Pausen fallen oft aus. Dann komme ich erst abends zum Essen und stopfe irgendwas in mich rein. Trainieren ist wirklich nicht mein Problem.",
  "Manchmal stopfen wir abends noch schnell etwas rein.",
  "Die Stoppuhr läuft beim Workout.",
  "Ein Stopfen am Wasserhahn ist kaputt.",
  "Ich möchte mit dem Stoppen der Kalorienzählerei anfangen.",
  "Ich habe mich im Job ausstopfen lassen.",
];

test("P0: normal words containing stop/stopp never trigger chat STOP", () => {
  for (const message of ordinaryMessages) {
    assert.notEqual(detectLeadIntent(message).intent, "stop", message);
    assert.notEqual(classifyPeteObjection(message).intent, "hard_stop", message);
    assert.notEqual(decidePeteNextAction(message).decisionType, "hard_stop", message);
  }
});

test("P0: explicit standalone STOP and clear contact opt-outs remain protected", () => {
  for (const message of [
    "STOP", "Stopp!", "Bitte STOP.", "Bitte nicht mehr schreiben",
    "Lass mich in Ruhe", "Bitte keine Nachrichten mehr",
  ]) {
    assert.equal(detectLeadIntent(message).intent, "stop", message);
    assert.equal(classifyPeteObjection(message).intent, "hard_stop", message);
    assert.equal(decidePeteNextAction(message).decisionType, "hard_stop", message);
  }
});

test("P0: synthetic conversation reaches the mocked AI provider, does not leak STOP, and keeps refusal guarded", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    clearConversationStore();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  process.env.OPENAI_API_KEY = "mock-key-no-external-call";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  writeSettings({ aiEnabled: true });
  const replies = [
    "Viermal Training klappt bereits. Beim Essen bringt dein Schichtalltag die geplanten Pausen durcheinander.",
    "Du bereitest Essen vor, kannst es wegen ausfallender Pausen aber oft nicht essen. Das ist das Problem, nicht dein Training.",
  ];
  let providerCalls = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    assert.match(String(init?.body), /Schicht|Pausen|Essen/i);
    const reply = replies[providerCalls++];
    assert.ok(reply, "No unexpected third model request");
    return new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ reply, needsHuman: false }) }] }],
      usage: { input_tokens: 600, output_tokens: 70 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const leadId = "p0-stopfe-fresh-contact";
  const send = (messageText: string) => processIncomingMessage({
    leadId, campaignId: DEFAULT_CAMPAIGN_ID, messageText, conversationMode: "natural",
  });
  const first = await send("Ich trainiere viermal die Woche. Wegen Schichtarbeit klappt mein Essen kaum.");
  assert.equal(first.state.answers.peteReplySource, "llm");
  assert.equal(first.text, replies[0]);
  const second = await send(ordinaryMessages[0]);
  assert.equal(second.state.answers.peteReplySource, "llm");
  assert.equal(second.text, replies[1]);
  assert.notEqual(second.state.flags.stopped, true);
  assert.equal(providerCalls, 2);
  assert.equal(getPeteBudgetStatus().requestsMetered, 2);

  const stop = await send("Bitte nicht mehr schreiben");
  assert.equal(stop.state.flags.stopped, true);
  assert.equal(stop.state.answers.peteReplySource, "guarded_safety");
  assert.equal(providerCalls, 2, "A genuine STOP must not call AI");
});
