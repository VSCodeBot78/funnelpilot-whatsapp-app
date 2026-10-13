import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Situational communication styles in real parent DMs. Offline simulation:
// this can verify prompt and memory transport, NOT the quality of real GPT text.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-colors-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_MOBILE_LAB_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
process.env.PETE_LLM_API_CALLS_APPROVED = "true";
process.env.OPENAI_MODEL = "gpt-4.1-mini";
process.env.OPENAI_API_KEY = "offline-mock-not-a-secret";

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { evaluatePeteRuntimeSafety } = await import("../core/pete-runtime-safety.js");
writeSettings({ aiEnabled: true });

type Scenario = { name: string; messages: readonly [string, string, string] };
const personas: Scenario[] = [
  { name: "blue-parent-expects-facts", messages: [
    "Hallo, ich bin Vater von zwei Kindern und will mich erst in Ruhe informieren.",
    "Mir ist wichtig zu verstehen, wie so eine Begleitung überhaupt abläuft.",
    "Ich entscheide erst, wenn ich wirklich verstanden habe, was dahintersteckt.",
  ] },
  { name: "green-parent-needs-space", messages: [
    "Ich bin Mama und mit Beruf und Familie gerade ziemlich ausgelastet.",
    "Ich habe schon zwei Anläufe hinter mir, die nicht lange gehalten haben.",
    "Ich weiß nicht, ob ich wieder etwas Neues anfangen will.",
  ] },
  { name: "red-parent-wants-speed", messages: [
    "Ich will endlich fitter werden. Bitte möglichst kurz antworten.",
    "Mein Ziel ist klar, ich will wieder regelmäßig Krafttraining machen.",
    "Ich will wissen, ob Jochen mir helfen könnte, ohne ewige Frageketten.",
  ] },
  { name: "yellow-parent-shares-aspirations", messages: [
    "Ich würde so gerne wieder mit meinen Kindern unbeschwert draußen toben.",
    "Im Moment komme ich abends nach dem Job kaum von der Couch.",
    "Das wäre so schön, wenn ich mich wieder vital und leicht fühlen würde.",
  ] },
  { name: "yellow-to-blue-pivot", messages: [
    "Ich wünsche mir wieder mehr Energie für die Wochenenden mit meinen Kids.",
    "Ich habe schon viel ausprobiert und will diesmal nichts überstürzen.",
    "Deshalb möchte ich ganz sachlich verstehen, wie Jochens Begleitung abläuft.",
  ] },
  { name: "blue-to-green-pivot", messages: [
    "Ich möchte zuerst verstehen, wie du arbeitest.",
    "Im Job bin ich ziemlich strukturiert, aber bei Fitness klappt das nicht.",
    "Ehrlich gesagt habe ich Angst, mich wieder zu übernehmen.",
  ] },
  { name: "red-to-green-pivot", messages: [
    "Ich will das Thema Fitness jetzt angehen und nicht lange diskutieren.",
    "Zwei kleine Kinder und Vollzeit. Mehr Infos brauchst du nicht.",
    "Wobei ich schon Sorge habe, dass ich das wieder nicht durchhalte.",
  ] },
  { name: "green-to-red-pivot", messages: [
    "Ich habe lange gezögert, weil mein Familienalltag anstrengend ist.",
    "Eigentlich will ich nichts anfangen, was mich noch mehr stresst.",
    "Inzwischen bin ich mir sicher, dass ich Unterstützung brauche. Wie wäre der nächste Schritt?",
  ] },
  { name: "terse-parent-does-not-give-essay", messages: [
    "Hi",
    "Ja",
    "Bin Papa von zwei Kindern. Wenig Zeit.",
  ] },
];

const replyTexts = [
  "Verstanden, du möchtest erst für dich einordnen, was gerade wichtig ist.",
  "Danke, das ergänzt dein bisheriges Bild.",
  "Okay, du hast deinen Wunsch jetzt etwas klarer beschrieben.",
] as const;

function readRequestContext(body: any) {
  const raw = String(body?.input?.[0]?.content ?? "");
  const marker = "\nBeantworte die letzte Lead-Nachricht.";
  const last = raw.lastIndexOf(marker);
  assert.ok(last > 0, "prompt must contain last-lead instruction");
  const opening = raw.indexOf("\n");
  assert.ok(opening > 0, "prompt must contain JSON context");
  return JSON.parse(raw.slice(opening + 1, last));
}

test("Phase 59: four situational color styles, pivots and short parent replies", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await t.test("ordinary fitness fears are NOT a crisis; genuine distress still escalates", () => {
    for (const message of [
      "Ehrlich gesagt habe ich Angst, mich wieder zu übernehmen.",
      "Ich habe Angst, wieder an einem Fitnessprogramm zu scheitern.",
      "Mir macht es Angst, wieder alles nach zwei Wochen aufzugeben.",
    ]) {
      assert.notEqual(evaluatePeteRuntimeSafety(message).category,
        "emotional_crisis", message);
    }
    for (const message of [
      "Ich kann nicht mehr, mir ist alles zu viel.",
      "Ich habe eine Panikattacke.",
      "Ich habe Angst, mir etwas anzutun.",
      "Ich bin total am Ende.",
    ]) {
      const safety = evaluatePeteRuntimeSafety(message);
      assert.equal(safety.category, "emotional_crisis", message);
      assert.equal(safety.shouldHandoffToJochen, true, message);
      assert.equal(safety.shouldStopAutomation, true, message);
    }
  });

  for (const person of personas) {
    await t.test(person.name + " keeps real statements in GPT context", async () => {
      clearConversationStore();
      let calls = 0;
      const requests: any[] = [];
      globalThis.fetch = async (url, init) => {
        assert.equal(String(url), "https://api.openai.com/v1/responses");
        const body = JSON.parse(String(init?.body));
        requests.push(body);
        calls++;
        assert.equal(body.model, "gpt-4.1-mini");
        assert.equal(body.store, false);
        for (const word of ["VIER-FARBEN-KOMMUNIKATION", "BLAU", "GRÜN", "ROT", "GELB", "FARBWECHSEL", "REALISTISCHE ELTERN-DMs", "KI-DM-Setter"]) {
          assert.ok(String(body.instructions).includes(word), word);
        }
        return new Response(JSON.stringify({
          output: [{ content: [{ type: "output_text",
            text: JSON.stringify({ reply: replyTexts[(calls - 1) % 3], needsHuman: false }) }] }],
          usage: { input_tokens: 500, output_tokens: 100 },
        }), { status: 200 });
      };
      const leadId = "phase59-" + person.name;
      for (const [index, messageText] of person.messages.entries()) {
        const reply = await processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
          messageText, conversationMode: "natural" });
        assert.equal(reply.state.answers.peteReplySource, "llm", person.name);
        assert.equal(reply.state.owner, "ai");
        assert.equal(reply.state.aiPaused, false);
        assert.ok((reply.text ?? "").length <= 500);
        assert.equal(requests.length, index + 1);
        const ctx = readRequestContext(requests[index]);
        assert.ok(Array.isArray(ctx.conversation));
        for (const known of person.messages.slice(0, index + 1)) {
          assert.ok(ctx.conversation.some((m: any) => m.role === "user" && m.text === known),
            "do not forget earlier parent facts: " + known);
        }
        assert.doesNotMatch(reply.text ?? "", /\b(?:blau|grün|rot|gelb)\b/i,
          "color labels should not be surfaced to parents");
      }
      assert.equal(calls, 3, "one simulated request for each user turn");
    });
  }
  assert.equal(personas.length, 9);
});
