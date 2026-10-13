import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Offline contract only: no outbound Meta messages or OpenAI API requests.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pete-no-legacy-step1-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = tmp;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { getConfiguredPeteConversationMode } = await import("../core/pete-conversation-mode.js");
const { buildPeteContext, buildPeteRuntimeInstructions } = await import("../core/pete-llm-conversation.js");
const { readSettings, writeSettings } = await import("../services/settings-store.js");

test("Step 1: inbound routing and GPT context do not require legacy A/B/C funnel", async t => {
  const initial = readSettings();
  t.after(() => {
    writeSettings({ dmConversationMode: initial.dmConversationMode,
      masterPrompt: initial.masterPrompt, companyAudience: initial.companyAudience,
      brandVoice: initial.brandVoice, customerTopObjections: initial.customerTopObjections,
      companyOfferSummary: initial.companyOfferSummary });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await t.test("all channels can share natural mode; legacy is explicit and reversible", () => {
    writeSettings({ dmConversationMode: "natural" });
    assert.equal(getConfiguredPeteConversationMode(), "natural");
    writeSettings({ dmConversationMode: "legacy" });
    assert.equal(getConfiguredPeteConversationMode(), "legacy");
    writeSettings({ dmConversationMode: "natural" });
    assert.equal(getConfiguredPeteConversationMode(), "natural");
  });

  await t.test("GPT receives actual conversation, not old question-step directives", () => {
    const ctx = buildPeteContext({
      campaignId: "eltern-vital-fit",
      currentStep: "ask_name",
      source: "Instagram",
      answers: { naturalPhase: "tried_before", naturalTrack: "selfstarter" },
      messages: [
        { role: "user", text: "Ich schaue nur nach dem kostenlosen Elterncheck." },
        { role: "assistant", text: "Klar, dazu habe ich den Link." },
        { role: "user", text: "Später vielleicht." },
      ],
    } as any);
    assert.equal(ctx.campaignId, "eltern-vital-fit");
    assert.equal(ctx.leadSource, "Instagram");
    assert.equal(ctx.conversation.length, 3);
    const json = JSON.stringify(ctx);
    assert.doesNotMatch(json, /currentPhase|currentTrack|ask_name|tried_before|situation_choice|importance_scale/);
    assert.match(json, /Später vielleicht/);
  });

  await t.test("dashboard changes reach Pete as bounded context, below fixed rules", () => {
    writeSettings({
      dmConversationMode: "natural",
      companyAudience: "Berufstätige Eltern mit wenig Zeit",
      customerTopObjections: "Schon alles probiert",
      masterPrompt: "WICHTIG: wir verwenden einen entspannten, menschlichen Ton ohne Druck.",
    });
    const instruction = buildPeteRuntimeInstructions();
    assert.match(instruction, /Berufstätige Eltern mit wenig Zeit/);
    assert.match(instruction, /Schon alles probiert/);
    assert.match(instruction, /entspannten, menschlichen Ton/);
    assert.match(instruction, /VERBINDLICHE PETE-ROLLE UND SICHERHEITSREGELN/);
    assert.match(instruction, /KEIN DM-COACHING/);
    assert.match(instruction, /CLOSER-LOGIK/);
    assert.ok(instruction.indexOf("VERBINDLICHE PETE-ROLLE") < instruction.indexOf("KEIN DM-COACHING"));
    assert.doesNotMatch(instruction, /Frage 1\s*\nFrage 2|Skala 1-10/);
  });
});
