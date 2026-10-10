import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// All provider calls in this file are intercepted. No real API/Meta sends.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-pete-phase45-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { readSettings, writeSettings } = await import("../services/settings-store.js");
const { buildPeteContext, validatePeteLlmReply,
  isTrustedPeteTransactionRequest } = await import("../core/pete-llm-conversation.js");

async function send(leadId: string, messageText: string) {
  return processIncomingMessage({
    leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural",
  });
}

test("Phase 45: model route is opt-in and preserves all trusted safety interlocks", async t => {
  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
    delete process.env.OPENAI_API_KEY;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await t.test("default mode does not contact a paid provider", async () => {
    clearConversationStore();
    writeSettings({ aiEnabled: false });
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("should not fetch"); };
    const answer = await send("default-off", "Ich bin Mama und abends völlig platt.");
    assert.match(answer.text || "", /Kinder, Job/);
    assert.equal(calls, 0);
  });

  await t.test("environment alone is insufficient: no key and no consent => fail-closed human handover", async () => {
    clearConversationStore();
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    delete process.env.OPENAI_API_KEY;
    writeSettings({ aiEnabled: false });
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("should not fetch"); };
    const answer = await send("not-authorized", "Mein Kind war krank, wie kann ich wieder anfangen?");
    assert.match(answer.text || "", /Jochen weiter/);
    assert.equal(answer.state.owner, "human");
    assert.equal(answer.state.aiPaused, true);
    assert.equal(answer.state.answers.peteReplySource, "llm_handoff");
    assert.equal(calls, 0);
    const next = await send("not-authorized", "Und meine zweite Frage?");
    assert.equal(next.text, null);
    assert.equal(next.replySuppressedReason, "human_owned");
  });

  await t.test("explicit synthetic provider opt-in sends multi-turn history, no storage, no real requests", async () => {
    clearConversationStore();
    writeSettings({ aiEnabled: true });
    process.env.OPENAI_API_KEY = "test-never-send";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    const transcript = [
      "Ich bin Mama von zwei Kindern und abends platt.",
      "Wenn die Kinder schlafen, kann ich nur noch aufs Sofa.",
      "Ich habe dreimal abends trainiert, aber mein Kind wurde krank.",
      "Das habe ich dir schon gesagt. Warum fragst du noch mal?",
      "Wie soll das bei krankem Kind funktionieren, wenn ich keine Zeit habe?",
      "Du beantwortest meine Frage nicht. Erkläre es bitte konkret.",
    ];
    const captured: Array<Record<string, unknown>> = [];
    globalThis.fetch = async (_url, init) => {
      const options = init as RequestInit;
      const body = JSON.parse(String(options.body));
      captured.push(body);
      assert.equal(body.store, false);
      assert.equal(body.model, "gpt-4.1-mini");
      assert.equal((body.text as any).format.strict, true);
      assert.match(String((body.input as any)[0].content), /Mama/);
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify({
          reply: "Stimmt, die Frage hattest du schon beantwortet. Mein Fehler. Wenn dein Kind krank ist, hat Training Pause. Wichtig ist, danach ohne Druck wieder einsteigen zu können.",
          needsHuman: false,
        }) }] }],
      }), { status: 200 });
    };
    for (const item of transcript) {
      const out = await send("phase45-six-turns", item);
      assert.equal(out.state.owner, "ai");
      assert.equal(out.state.answers.peteReplySource, "llm");
      assert.doesNotMatch(out.text || "", /[–—]|😅/u);
      assert.doesNotMatch(out.text || "", /Woran ist es bisher meistens gescheitert/);
    }
    assert.equal(captured.length, transcript.length);
    const context = JSON.parse(String((captured.at(-1)?.input as any)[0].content).split("\n")[1]);
    assert.ok(context.conversation.some((m: any) => m.text.includes("Kind wurde krank")));
    assert.ok(context.conversation.some((m: any) => m.text.includes("Du beantwortest meine Frage nicht")));
    assert.equal(context.conversation.length, transcript.length * 2 - 1);
  });

  await t.test("untrusted model output cannot invent price or checkout", async () => {
    clearConversationStore();
    writeSettings({ aiEnabled: true });
    process.env.OPENAI_API_KEY = "test-never-send";
    globalThis.fetch = async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        reply: "Du hast gerade für 2499 Euro gebucht, dein Termin ist bestätigt.",
        needsHuman: false,
      }) }] }],
    }), { status: 200 });
    const out = await send("invented-price", "Kann ich dir meine Situation erklären?");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.aiPaused, true);
    assert.equal(out.state.answers.peteLlmFailureReason, "invalid_output");
    assert.doesNotMatch(out.text || "", /2499|gebucht|bestätigt/);
  });

  await t.test("HTTP provider error does not re-enter mechanical question flow", async () => {
    clearConversationStore();
    writeSettings({ aiEnabled: true });
    process.env.OPENAI_API_KEY = "test-never-send";
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    const out = await send("provider-fail", "Mein Kind ist krank, kannst du mich beraten?");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.answers.peteLlmFailureReason, "provider_unavailable");
  });

  await t.test("STOP bypasses all model calls and suppresses subsequent messages", async () => {
    clearConversationStore();
    writeSettings({ aiEnabled: true });
    process.env.OPENAI_API_KEY = "test-never-send";
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("unsafe"); };
    const first = await send("phase45-stop", "Bitte nicht mehr schreiben");
    assert.equal(first.state.flags.stopped, true);
    await send("phase45-stop", "Hallo?");
    assert.equal(calls, 0);
  });

  await t.test("trusted prices and guides use source of truth, not model", async () => {
    clearConversationStore();
    writeSettings({ aiEnabled: true });
    process.env.OPENAI_API_KEY = "test-never-send";
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("unsafe"); };
    assert.equal(isTrustedPeteTransactionRequest("Was kostet die 5-Wochen-Begleitung?"), true);
    const price = await send("price-trusted", "Was kostet die 5-Wochen-Begleitung?");
    assert.match(price.text || "", /499 €/);
    const guide = await send("guide-trusted", "Schick mir den Keto Guide");
    assert.match(guide.text || "", /keto-guide/);
    assert.equal(calls, 0);
  });

  await t.test("self-reported booking is never treated as confirmed by LLM", async () => {
    clearConversationStore();
    writeSettings({ aiEnabled: true });
    process.env.OPENAI_API_KEY = "test-never-send";
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("model must not confirm bookings"); };
    const first = await send("phase45-booking", "Ich möchte ein Strategiegespräch buchen");
    assert.equal(first.state.currentStep, "booking");
    const claim = await send("phase45-booking", "Hab gebucht, ist der Termin sicher bestätigt?");
    assert.notEqual(claim.state.providerBooking.status, "booked");
    assert.match(claim.text || "", /noch nicht|bestätigung|bestätigt|prüf/i);
    assert.equal(calls, 0);
  });

  await t.test("style validator rejects artificial claims and extra questions", () => {
    assert.equal(validatePeteLlmReply({ reply: "https://fake.example", needsHuman: false }), null);
    assert.equal(validatePeteLlmReply({ reply: "Ich kann das! Was? Warum?", needsHuman: false }), null);
    assert.equal(validatePeteLlmReply({ reply: "Dein Termin ist bestätigt.", needsHuman: false }), null);
    const valid = validatePeteLlmReply({
      reply: "Das ist schwer 😅 — lass uns schauen.", needsHuman: false,
    });
    assert.ok(valid);
    assert.doesNotMatch(valid.reply, /[–—]|😅/u);
    assert.equal(readSettings().aiEnabled, true);
  });
});
