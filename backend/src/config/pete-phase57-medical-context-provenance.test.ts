import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Complete isolation: provider responses are mocked and outbound disabled.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase57-"));
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
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { isGeneralNonMedicalKnowledgeRequest } =
  await import("../core/pete-conversation-quality.js");

function enableMock() {
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  process.env.OPENAI_API_KEY = "local-mock-do-not-send";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  writeSettings({ aiEnabled: true });
}
const send = (leadId: string, messageText: string) =>
  processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural" });
const mockResponse = () => new Response(JSON.stringify({
  output: [{ content: [{ type: "output_text", text: JSON.stringify({
    reply: "Die bisherigen Werte sind ärztlich geprüft. Du fragst nach allgemeinen Zusammenhängen zwischen Training, Schlaf und Ernährung, nicht nach einer Diagnose.",
    needsHuman: false,
  }) }] }],
  usage: { input_tokens: 600, output_tokens: 100 },
}), { status: 200 });

test("Phase 57: verified past medical context and response provenance", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await t.test("past check and explicit refusal of remote diagnosis stay general", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mockResponse(); };
    const leadId = "phase57-past-check";
    for (const text of [
      "Meine letzte Schwangerschaft ist über zwei Jahre her. Ich trainiere zweimal die Woche schwer, aber das Gewicht bewegt sich kaum.",
      "Bitte komm mir nicht mit einfach mehr Sport. Das mache ich schon.",
      "Ich schlafe wegen Job und Kind oft nur sechs Stunden und sitze tagsüber viel.",
      "Was sagt die Forschung allgemein zu Gewichtsstagnation trotz Krafttraining?",
    ]) {
      const out = await send(leadId, text);
      assert.equal(out.state.owner, "ai");
      assert.equal(out.state.answers.peteReplySource, "llm");
    }
    const last = "Ich möchte keine Ferndiagnose. Meine Werte wurden beim Arzt schon überprüft.";
    assert.equal(isGeneralNonMedicalKnowledgeRequest(last), true);
    const out = await send(leadId, last);
    assert.equal(out.state.owner, "ai");
    assert.equal(out.state.answers.peteReplySource, "llm");
    assert.match(out.text || "", /ärztlich geprüft/);
    assert.equal(calls, 5);
  });

  await t.test("acute complaint is still blocked and correctly labelled, even after an LLM answer", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mockResponse(); };
    const first = await send("phase57-acute-after-llm", "Ich bin Papa und will wieder mehr Energie bekommen.");
    assert.equal(first.state.answers.peteReplySource, "llm");
    const second = await send("phase57-acute-after-llm",
      "Ich habe Brustschmerzen und Schwindel beim Training. Ich nehme Medikamente.");
    assert.equal(second.state.owner, "human");
    assert.equal(second.state.aiPaused, true);
    assert.equal(second.state.answers.peteReplySource, "guarded_safety");
    assert.doesNotMatch(second.text || "", /ärztlich geprüft/);
    assert.equal(calls, 1);
    const after = await send("phase57-acute-after-llm", "Hallo, noch eine Frage?");
    assert.equal(after.text, null);
    assert.equal(calls, 1);
  });

  await t.test("narrow exemption never applies to active red flags or treatment", () => {
    for (const text of [
      "Keine Ferndiagnose, meine Werte wurden beim Arzt überprüft. Ich nehme Insulin und möchte die Dosis ändern.",
      "Keine Ferndiagnose. Meine Werte wurden beim Arzt überprüft, jetzt habe ich Brustschmerzen.",
      "Keine Ferndiagnose, meine Werte sind überprüft. Ich bin jetzt schwanger.",
      "Bitte interpretiere meine aktuellen Blutwerte und ändere meine Behandlung.",
    ]) assert.equal(isGeneralNonMedicalKnowledgeRequest(text), false, text);
  });

  await t.test("STOP right after an LLM reply must be honestly attributed", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mockResponse(); };
    const first = await send("phase57-stop", "Ich bin Papa und möchte mehr Energie.");
    assert.equal(first.state.answers.peteReplySource, "llm");
    const second = await send("phase57-stop", "STOP, bitte nicht mehr schreiben.");
    assert.equal(second.state.flags.stopped, true);
    assert.equal(second.state.answers.peteReplySource, "guarded_safety");
    assert.equal(calls, 1);
  });
});
