import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-v4-final-safety-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.OPENAI_MODEL = "gpt-6.1-sol";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
process.env.PETE_LLM_API_CALLS_APPROVED = "true";
process.env.OPENAI_API_KEY = "mock-only-no-network";

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { peteSafeRoutineRepairReply, getPeteVerifiedTransactionAnswer } =
  await import("../core/pete-conversation-quality.js");

const state = (...leadTexts: string[]) => ({
  messages: leadTexts.map(text => ({ role: "user", text })),
}) as any;

test("final v4: explicit zero budget cannot turn into an unsolicited starter pitch", () => {
  const result = getPeteVerifiedTransactionAnswer(
    "Ich habe derzeit gar kein Geld für Coaching.", state());
  assert.ok(result?.text);
  assert.match(result.text, /nicht passend|keine Schulden/);
  assert.doesNotMatch(result.text, /Selbststarter|14,95|Ratenzahlung|Kredit/i);
});

test("final v4: safe routine answer is narrowly nonmedical", () => {
  const oldQuestion = "Du hast meine Frage nicht beantwortet. Wie funktioniert eure Methode bei krankem Kind?";
  assert.match(peteSafeRoutineRepairReply(state(oldQuestion, "Bitte diesmal konkret und kurz.")) || "", /Training pausieren/);
  for (const leadTexts of [
    [oldQuestion, "Mein Kind hat Fieber, was tun?"],
    [oldQuestion, "STOP. Schreib mir nicht mehr."],
    [oldQuestion, "Bitte Jochen persönlich übernehmen lassen."],
    ["Wie geht es meinem kranken Kind medizinisch?", "Bitte antworten."],
  ]) assert.equal(peteSafeRoutineRepairReply(state(...leadTexts)), null);
});

test("final v4: unnecessary model-human escalation can safely repair a method answer", async t => {
  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  clearConversationStore();
  writeSettings({ aiEnabled: true, aiModel: "gpt-6.1-sol" });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        reply: "Jochen muss das persönlich beantworten.",
        needsHuman: true,
      }) }] }],
      usage: { input_tokens: 1200, output_tokens: 50, total_tokens: 1250 },
    }), { status: 200 });
  };

  const out = await processIncomingMessage({
    leadId: "policy-v4-known-routine-repair",
    campaignId: DEFAULT_CAMPAIGN_ID,
    messageText: "Du hast meine Frage nicht beantwortet. Wie funktioniert eure Methode bei krankem Kind?",
    conversationMode: "natural",
  });
  assert.equal(calls, 1);
  assert.equal(out.state.owner, "ai");
  assert.equal(out.state.answers.peteReplySource, "safe_noncritical");
  assert.match(out.text ?? "", /Training pausieren/);
  assert.equal(out.state.flags.peteRuntimeHandoffActive === true, false);
});
