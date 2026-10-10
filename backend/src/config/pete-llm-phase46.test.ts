import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-pete-phase46-"));
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
const { getConversationState, clearConversationStore } = await import("../data/store.js");
const { takeOverByHuman, persistConversationState } = await import("../core/state-manager.js");
const { writeSettings } = await import("../services/settings-store.js");
const { buildPeteContext, validatePeteLlmReply, isTrustedPeteTransactionRequest,
  isExplicitPeteHumanTakeoverRequest, isPeteLlmReadyForProvider } =
  await import("../core/pete-llm-conversation.js");

async function send(leadId: string, messageText: string) {
  return processIncomingMessage({
    leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural",
  });
}
function enableMockProvider() {
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  process.env.OPENAI_API_KEY = "mock-only-no-network";
  writeSettings({ aiEnabled: true });
}
function mockResponse(reply: string, needsHuman = false): Response {
  return new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text", text: JSON.stringify({ reply, needsHuman }) }] }],
  }), { status: 200 });
}

test("Phase 46: LLM safety gate, human ownership and race conditions", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await t.test("old OpenAI key plus AI setting cannot trigger unapproved paid calls", async () => {
    clearConversationStore();
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    process.env.OPENAI_API_KEY = "old-dotenv-key";
    writeSettings({ aiEnabled: true });
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("No API permission"); };
    assert.equal(isPeteLlmReadyForProvider(), false);
    const out = await send("phase46-cost-guard", "Wie komme ich nach einer schwierigen Woche wieder rein?");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.answers.peteLlmFailureReason, "not_authorized");
    assert.equal(calls, 0);
  });

  await t.test("feature remains deterministic if its separate feature flag is off", async () => {
    clearConversationStore();
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    writeSettings({ aiEnabled: true });
    assert.equal(isPeteLlmReadyForProvider(), false);
    globalThis.fetch = async () => { throw Error("must not fetch"); };
    const out = await send("phase46-feature-off", "Ich bin Mama und abends völlig platt.");
    assert.equal(out.state.answers.peteReplySource, "deterministic");
    assert.ok(out.text);
  });

  await t.test("explicit human chat takeover beats a booking CTA and model", async () => {
    clearConversationStore();
    enableMockProvider();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("must not fetch"); };
    assert.equal(isExplicitPeteHumanTakeoverRequest("Jochen soll bitte hier übernehmen"), true);
    assert.equal(isExplicitPeteHumanTakeoverRequest("Ich brauche jemanden an meiner Seite beim Coaching"), false);
    const out = await send("phase46-human-request", "Jochen soll bitte hier übernehmen");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.aiPaused, true);
    assert.equal(out.state.flags.peteRuntimeHandoffActive, true);
    assert.equal(out.state.flags.wantsBooking, false);
    assert.equal(out.state.answers.peteReplySource, "human_handoff");
    assert.equal(calls, 0);
    assert.equal((await send("phase46-human-request", "Noch eine Frage?")).text, null);
  });

  await t.test("price, invoice, booking, identity and resource requests bypass model", async () => {
    clearConversationStore();
    enableMockProvider();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("must not fetch"); };
    for (const input of [
      "Wie teuer ist das?", "Was kostet das Coaching?",
      "Gibt es eine Monatsrate?", "Sind die Kosten verbindlich?",
      "Ich habe bezahlt, ist die Zahlung bestätigt?", "Wer schreibt mir?",
      "Schick mir bitte den Keto Guide", "Hab gebucht, ist der Termin bestätigt?",
    ]) assert.equal(isTrustedPeteTransactionRequest(input), true, input);
    const price = await send("phase46-price", "Wie teuer ist das?");
    assert.match(price.text || "", /5-Wochen|Selbststarter/);
    assert.equal(price.state.answers.peteReplySource, "deterministic");
    const payment = await send("phase46-payment", "Ich habe bezahlt, ist die Zahlung bestätigt?");
    assert.notEqual(payment.state.answers.coachingEntryPurchaseStatus, "paid");
    assert.notEqual(payment.state.answers.starterPurchaseStatus, "paid");
    assert.equal(calls, 0);
  });

  await t.test("transcript sent to a provider is bounded and redacts common identifiers", () => {
    const messages = Array.from({ length: 40 }, (_, i) => ({
      id: String(i), role: i % 2 ? "assistant" : "user",
      text: "Viel Alltag und wenig Zeit. ".repeat(60) + " frau@example.org 0176 12345678",
      createdAt: "2026-01-01T00:00:00Z",
    }));
    messages[39].text = "Meine Mail frau@example.org, Handy +49 176 12345678, Geheimnis sk-proj-abcdefghijklmnop";
    const context = buildPeteContext({ campaignId: "dummy", answers: {}, messages } as any);
    const serialized = JSON.stringify(context);
    assert.ok(serialized.length <= 12500);
    assert.ok(context.conversation.length <= 36);
    assert.ok(context.conversation.length > 0);
    assert.match(serialized, /\[E-Mail entfernt\]/);
    assert.doesNotMatch(serialized, /frau@example\.org|\+49 176 12345678|sk-proj-abcdefghijklmnop/);
    assert.match(context.conversation.at(-1)?.text || "", /Handy/);
  });

  await t.test("human takeover during pending AI call prevents overwriting ownership", async () => {
    clearConversationStore();
    enableMockProvider();
    let settle!: (resp: Response) => void;
    let started!: () => void;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    globalThis.fetch = async () => { started(); return new Promise<Response>(resolve => { settle = resolve; }); };
    const pending = send("phase46-race-human", "Ich bin Mama und will einfach wieder Energie.");
    await waiting;
    const state = getConversationState("phase46-race-human", DEFAULT_CAMPAIGN_ID);
    assert.ok(state);
    takeOverByHuman(state);
    persistConversationState(state);
    settle(mockResponse("Jetzt geht es endlich weiter."));
    const out = await pending;
    assert.equal(out.text, null);
    assert.equal(out.replySuppressedReason, "human_owned");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.messages.filter(m => m.role === "assistant").length, 0);
  });

  await t.test("STOP during pending model call drops stale answer permanently", async () => {
    clearConversationStore();
    enableMockProvider();
    let settle!: (resp: Response) => void;
    let started!: () => void;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    globalThis.fetch = async () => { started(); return new Promise<Response>(resolve => { settle = resolve; }); };
    const pending = send("phase46-race-stop", "Ich möchte wieder mehr Energie bekommen.");
    await waiting;
    const stop = await send("phase46-race-stop", "Bitte nicht mehr schreiben");
    assert.equal(stop.state.flags.stopped, true);
    settle(mockResponse("Ich möchte dir ein Angebot machen."));
    const out = await pending;
    assert.equal(out.text, null);
    assert.equal(out.replySuppressedReason, "stopped");
    assert.equal(out.state.flags.stopped, true);
    assert.equal(out.state.messages.some(m => m.text.includes("ein Angebot machen")), false);
  });

  await t.test("newer lead message supersedes older pending AI reply", async () => {
    clearConversationStore();
    enableMockProvider();
    let settle!: (resp: Response) => void;
    let started!: () => void;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    globalThis.fetch = async () => { started(); return new Promise<Response>(resolve => { settle = resolve; }); };
    const pending = send("phase46-race-new", "Ich brauche einen machbaren Alltag.");
    await waiting;
    const current = await send("phase46-race-new", "Schick mir den Keto Guide");
    assert.match(current.text || "", /keto-guide/);
    settle(mockResponse("Hast du Zeit für Sport?"));
    const old = await pending;
    assert.equal(old.text, null);
    assert.equal(old.replySuppressedReason, "superseded");
    assert.equal(old.state.answers.peteReplySource, "deterministic");
    assert.equal(old.state.messages.some(m => m.text.includes("Hast du Zeit für Sport")), false);
  });

  await t.test("model requests human handover and cannot create provider proof", async () => {
    clearConversationStore();
    enableMockProvider();
    globalThis.fetch = async () => mockResponse("Jochen muss das prüfen.", true);
    const out = await send("phase46-llm-handoff", "Ich will verstehen, was mir hilft.");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.answers.peteLlmFailureReason, "model_handoff");
    assert.doesNotMatch(out.text || "", /muss das prüfen/);
  });

  await t.test("output validator denies unverified money and booking claims", () => {
    for (const reply of [
      "Dein Termin ist bestätigt.", "Deine Zahlung wurde bestätigt.",
      "Das kostet 499 Euro.", "Der Preis liegt bei zwölf Euro.",
      "Hier der Checkout: https://example.com",
    ]) assert.equal(validatePeteLlmReply({ reply, needsHuman: false }), null, reply);
  });
});
