import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Phase 1 transport and runtime regression: offline, no OpenAI or Meta sends.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pete-natural-routing-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = tmp;
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { clearConversationStore } = await import("../data/store.js");

const entryRoutes = [
  { file: "../routes/meta-instagram.ts", expectedCalls: 1 },
  { file: "../routes/meta-whatsapp.ts", expectedCalls: 1 },
  // Mobile start/message, ordinary testchat and scoped desktop owner route.
  { file: "../routes/test-chat.ts", expectedCalls: 4 },
  { file: "../routes/webhook.ts", expectedCalls: 3 },
];

test("Phase 1: every inbound transport selects natural Pete, never legacy", async t => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await t.test("no route leaves a mode implicit or reads a legacy setting", () => {
    for (const { file, expectedCalls } of entryRoutes) {
      const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
      const engineCalls = source.match(/processIncomingMessage\(\{/g) ?? [];
      const naturalModes = source.match(/conversationMode:\s*"natural"/g) ?? [];
      assert.equal(engineCalls.length, expectedCalls, `${file}: unexpected number of engine calls`);
      assert.equal(naturalModes.length, engineCalls.length, `${file}: not every engine call selects natural mode`);
      assert.doesNotMatch(source, /conversationMode:\s*"legacy"|readSettings\(\)\.dmConversationMode/);
    }
  });

  await t.test("natural path cannot continue into the legacy questionnaire", () => {
    const source = fs.readFileSync(new URL("../core/conversation-engine.ts", import.meta.url), "utf8");
    const start = source.indexOf('if (input.conversationMode === "natural")');
    const legacy = source.indexOf('if (isSelfstarterInterest(input.messageText))', start);
    assert.ok(start >= 0 && legacy > start, "natural/legacy boundary was removed unexpectedly");
    const naturalPath = source.slice(start, legacy);
    assert.match(naturalPath, /peteReplySource", "natural_handoff"/);
    assert.match(naturalPath, /takeOverByHuman\(state\)/);
    assert.match(naturalPath, /return \{ text: handoffText/);
  });

  await t.test("a real synthetic parent turn stays in natural dialogue", async () => {
    const result = await processIncomingMessage({
      leadId: "phase1-natural-parent",
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: "Hi, ich bin Papa von drei Kindern und abends platt.",
      conversationMode: "natural",
    });
    assert.ok(result.text, "expected a reply");
    assert.doesNotMatch(result.text || "", /(?:^|\n)\s*[abcde]\)|auf einer skala von 1 bis 10/i);
    assert.notEqual(result.state.answers.peteReplySource, "legacy");
    assert.equal(result.state.owner, "ai");
  });
});
