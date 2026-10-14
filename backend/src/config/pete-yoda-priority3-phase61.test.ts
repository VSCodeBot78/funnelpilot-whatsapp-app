import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Offline only: checks that Pete's live model request receives decision
// principles and that a refusal/handover cannot be lost in a long chat.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-yoda-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { clearConversationStore } = await import("../data/store.js");
const { getConfiguredDmConversationMode, writeSettings } = await import("../services/settings-store.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { PETE_SETTER_MENTOR_PLAYBOOK } = await import("../core/pete-setter-mentor.js");

function mockedProviderReply(reply: string) {
  return new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text",
      text: JSON.stringify({ reply, needsHuman: false }) }] }],
    usage: { input_tokens: 700, output_tokens: 85 },
  }), { status: 200 });
}

test("Pete priority 3: Yoda setter, honest objections and no-pressure exit", async t => {
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
  for (const term of [
    "YODA-MODUS", "VERKAUFEN BEGINNT BEIM NEIN", "UNTERSCHIEDE",
    "GUTER EINWAND-DIALOG", "PASSUNG STATT DRUCK", "GESPRÄCH ENDET NATÜRLICH",
  ]) assert.ok(PETE_SETTER_MENTOR_PLAYBOOK.includes(term), term);
  assert.match(PETE_SETTER_MENTOR_PLAYBOOK, /keine Pflichtfragen/i);
  assert.match(PETE_SETTER_MENTOR_PLAYBOOK, /Bei einem klaren Nein keine neue Verkaufsrunde/);

  writeSettings({ aiEnabled: true, dmConversationMode: "natural" });
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  process.env.OPENAI_API_KEY = "offline-fixture";
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  let apiCalls = 0;
  const replies = [
    "Verstanden, du willst erst schauen, ob das in euren Alltag passt. Was war bisher dein größtes Hindernis?",
    "Klar, du hast schon vieles ausprobiert. Was müsste diesmal anders sein, damit es für dich überhaupt interessant wird?",
    "Dann würde ein kurzes Gespräch mit Jochen Sinn machen. Möchtest du das?",
  ];
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.store, false);
    assert.equal(payload.model, "gpt-4.1-mini");
    for (const signal of [
      "YODA-MODUS", "VERKAUFEN BEGINNT BEIM NEIN", "UNTERSCHIEDE",
      "GUTER EINWAND-DIALOG", "Nenne NIE Preise", "KEIN DM-COACHING",
    ]) assert.ok(String(payload.instructions).includes(signal), signal);
    assert.match(String(payload.instructions), /GESPRÄCHSSTIMME/);
    assert.match(String(payload.instructions), /Keine unnötige dritte-Person-Verkaufsrede/);
    assert.doesNotMatch(String(payload.instructions), /Was merkst du aktuell im Alltag am meisten\?/);
    return mockedProviderReply(replies[apiCalls++] || replies[2]);
  };
  const send = (leadId: string, messageText: string) =>
    processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
      conversationMode: getConfiguredDmConversationMode(), messageText });

  await t.test("three-turn prospect conversation stays GPT-led, not legacy", async () => {
    clearConversationStore();
    const input = [
      "Ich will erst mal schauen, ob das überhaupt zu unserer Familie passt.",
      "Ich habe schon zwei Programme probiert und beide abgebrochen.",
      "Ich hätte lieber persönlich Unterstützung. Ich suche einen vernünftigen Weg.",
    ];
    for (const text of input) {
      const output = await send("pete-yoda-buyer", text);
      assert.equal(output.state.answers.peteReplySource, "llm");
      assert.equal(output.state.owner, "ai");
      assert.doesNotMatch(output.text ?? "", /^(?:a\)|b\)|c\)|d\))/i);
    }
    assert.equal(apiCalls, 3);
  });

  await t.test("hard STOP overrides model and suppresses later replies", async () => {
    clearConversationStore();
    const before = apiCalls;
    const stop = await send("pete-yoda-stop", "STOP. Bitte nicht mehr schreiben.");
    assert.notEqual(stop.state.answers.peteReplySource, "llm");
    assert.equal(stop.state.flags.stopped, true);
    const following = await send("pete-yoda-stop", "Hallo?");
    assert.equal(following.text, null);
    assert.equal(apiCalls, before);
  });
});
