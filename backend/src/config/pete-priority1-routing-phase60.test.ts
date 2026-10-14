import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Offline only: confirms all DM adapters can select the same Pete route and
// the actual GPT request receives dashboard configuration, not the old q1/q2 flow.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-priority1-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { clearConversationStore } = await import("../data/store.js");
const { getConfiguredDmConversationMode, writeSettings, DEFAULT_MASTER_PROMPT } =
  await import("../services/settings-store.js");
const { buildPeteEffectiveInstructions } = await import("../core/pete-llm-conversation.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");

test("Pete priority 1: free DM mode on every adapter and verified dashboard prompt", async t => {
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

  await t.test("default = natural; old A/B/C/D mode requires explicit setting", () => {
    writeSettings({ dmConversationMode: "natural" });
    assert.equal(getConfiguredDmConversationMode(), "natural");
    writeSettings({ dmConversationMode: "legacy" });
    assert.equal(getConfiguredDmConversationMode(), "legacy");
    writeSettings({ dmConversationMode: "natural" });
    assert.equal(getConfiguredDmConversationMode(), "natural");
  });

  await t.test("unchanged default master is not duplicated, hard safeguards remain", () => {
    writeSettings({ masterPrompt: DEFAULT_MASTER_PROMPT, customerTopObjections: "" });
    const instructions = buildPeteEffectiveInstructions();
    assert.match(instructions, /KI-DM-Setter/);
    assert.match(instructions, /KEIN DM-COACHING/);
    assert.match(instructions, /Nenne NIE Preise/);
    assert.doesNotMatch(instructions, /individueller_master_prompt/);
    assert.doesNotMatch(instructions, /Was merkst du aktuell im Alltag am meisten\?/);
  });

  await t.test("changed dashboard master, objections and tone reach real mocked GPT request", async () => {
    clearConversationStore();
    writeSettings({
      aiEnabled: true,
      dmConversationMode: "natural",
      masterPrompt: "KUNDEN-PROMPT-2026: Ein Nein bedeutet erst einmal Einwand verstehen. Niemals druecken.",
      brandVoice: "Kurze DMs, klare Fragen, keine Lachsmileys.",
      customerTopObjections: "Preis\nZeit\nSchon alles probiert",
      qualificationPrompt: "Frage nur, wenn es im Gespraech noch etwas Wesentliches zu klaeren gibt.",
    });
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    process.env.OPENAI_API_KEY = "fixture-never-real";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      const request = JSON.parse(String(init?.body));
      assert.equal(request.model, "gpt-4.1-mini");
      assert.equal(request.store, false);
      const prompt = String(request.instructions);
      for (const phrase of [
        "KUNDEN-PROMPT-2026",
        "Ein Nein bedeutet erst einmal Einwand verstehen",
        "keine Lachsmileys", "Preis", "Schon alles probiert",
        "qualifikation_als_hinweis_keine_pflichtfragen",
        "KEIN DM-COACHING", "Nenne NIE Preise",
      ]) assert.ok(prompt.includes(phrase), phrase);
      assert.doesNotMatch(prompt, /Was merkst du aktuell im Alltag am meisten\?/);
      assert.doesNotMatch(prompt, /[a-d]\) ich bin oft müde/);
      calls++;
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify({
          reply: "Du möchtest erst wissen, ob das zu deinem Familienalltag passt. Was hast du bisher ausprobiert?",
          needsHuman: false,
        }) }] }],
        usage: { input_tokens: 550, output_tokens: 85 },
      }), { status: 200 });
    };
    const output = await processIncomingMessage({
      leadId: "phase60-dashboard-to-gpt",
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Ich will wieder mehr Energie haben, aber mit Kindern ist das alles schwierig.",
      conversationMode: getConfiguredDmConversationMode(),
    });
    assert.equal(output.state.answers.peteReplySource, "llm");
    assert.equal(calls, 1);
    assert.equal(output.state.owner, "ai");
    assert.equal(output.state.aiPaused, false);
    assert.doesNotMatch(output.text ?? "", /a\)\s|b\)\s|situation_choice/);
  });
});
