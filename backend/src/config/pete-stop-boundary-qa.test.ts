import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// An isolated temporary ledger and fake provider ensure zero real API cost.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-stop-boundary-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
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
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getPeteBudgetStatus } = await import("../services/pete-api-budget.service.js");

test("QA: read-only OpenAI authentication must pass before durable paid reservation", () => {
  const yaml = fs.readFileSync(path.resolve(import.meta.dirname,
    "../../../.github/workflows/pete-quality-real-one-time.yml"), "utf8");
  const auth = yaml.indexOf("name: Verify OpenAI credentials without generating tokens");
  const reserve = yaml.indexOf("node scripts/pete-quality-one-time-budget.mjs reserve");
  const runner = yaml.indexOf("npx tsx src/config/pete-quality-real-runner.ts");
  assert.ok(auth > 0 && reserve > auth && runner > reserve);
  assert.match(yaml, /api\.openai\.com\/v1\/models\/gpt-4\.1-mini/);
  assert.match(yaml, /status.*!=.*200/);
  assert.doesNotMatch(yaml, /workflow_dispatch:/);
});

test("P0: no accidental opt-out from 'stopfe', 'Stoppuhr' and ordinary lead language", () => {
  for (const input of [
    "Ich nehme mir Essen mit, aber meine Pausen fallen oft aus. Dann komme ich erst abends zum Essen und stopfe irgendwas in mich rein. Trainieren ist wirklich nicht mein Problem.",
    "Ich stopfe dann abends irgendwas in mich rein.",
    "Die Stoppuhr auf meinem Handy hilft beim Training.",
    "Beim Stopfen der Socken denke ich an gar nichts.",
    "Ich muss etwas ausstopfen, bevor die Kinder kommen.",
    "Ich habe einen Stop-Loss im Depot.",
    "Der Stopfen sitzt fest.",
  ]) {
    assert.notEqual(detectLeadIntent(input).intent, "stop", input);
    assert.notEqual(classifyPeteObjection(input).intent, "hard_stop", input);
    assert.notEqual(decidePeteNextAction(input).decisionType, "hard_stop", input);
  }
});

test("P0: explicit no-contact requests still trigger authoritative STOP", () => {
  for (const input of [
    "STOP",
    "Stopp!",
    "Bitte nicht mehr schreiben.",
    "Lass mich in Ruhe!",
    "Bitte keine Nachrichten mehr.",
    "Schreib mir nicht mehr.",
  ]) {
    assert.equal(detectLeadIntent(input).intent === "stop" ||
      classifyPeteObjection(input).intent === "hard_stop", true, input);
    assert.equal(decidePeteNextAction(input).decisionType, "hard_stop", input);
  }
});

test("P0: free-text explanation reaches mocked LLM, not canned STOP", async t => {
  t.after(() => {
    delete process.env.OPENAI_API_KEY;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    clearConversationStore();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  clearConversationStore();
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  process.env.OPENAI_API_KEY = "offline-mock-key-no-network";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  writeSettings({ aiEnabled: true });
  const fetchBefore = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchBefore; });
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    assert.equal((init as RequestInit).method, "POST");
    return new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        reply: calls === 1
          ? "Training ist bei dir schon regelmäßig drin. Beim Essen ist die Schicht der Knackpunkt. Was wirft deine Planung am häufigsten um?"
          : "Du nimmst bereits Essen mit, aber die Pausen fallen aus. Was passiert an Tagen, an denen du erst abends essen kannst?",
        needsHuman: false,
      }) }] }],
      usage: { input_tokens: 400, output_tokens: 65 },
    }), { status: 200 });
  };

  const leadId = "stopfe-qa-new-contact";
  const first = await processIncomingMessage({
    leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText: "Ich trainiere viermal die Woche. Mit dem Essen auf Schicht klappt es nicht.",
    conversationMode: "natural",
  });
  assert.equal(first.state.answers.peteReplySource, "llm", JSON.stringify({ reason: first.state.answers.peteLlmFailureReason, detail: first.state.answers.peteLlmFailureDetail, calls }));
  const second = await processIncomingMessage({
    leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText: "Ich nehme mir Essen mit, aber meine Pausen fallen oft aus. Dann stopfe ich abends irgendwas rein. Trainieren ist wirklich nicht mein Problem.",
    conversationMode: "natural",
  });
  assert.equal(second.state.flags.stopped, false);
  assert.equal(second.state.answers.peteReplySource, "llm", JSON.stringify({ reason: second.state.answers.peteLlmFailureReason, detail: second.state.answers.peteLlmFailureDetail, calls }));
  assert.equal(calls, 2);
  assert.notEqual(second.text, "Alles klar, danke für die Rückmeldung. Dann schreibe ich dir dazu nicht weiter.");
  assert.equal(getPeteBudgetStatus().requestsMetered, 2);
});
