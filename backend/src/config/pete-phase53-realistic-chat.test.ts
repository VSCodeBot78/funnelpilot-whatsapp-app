import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase53-"));
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
const { writeSettings } = await import("../services/settings-store.js");
const { peteSafeBudgetBoundaryReply, getPeteVerifiedTransactionAnswer } =
  await import("../core/pete-conversation-quality.js");
const { PETE_PHASE3_REALISTIC, getRealisticPhase3Message } =
  await import("./pete-phase3-realistic-scenarios.js");

const send = (leadId: string, messageText: string) =>
  processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural" });
function enableProvider() {
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  process.env.OPENAI_API_KEY = "only-offline-fixture";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  writeSettings({ aiEnabled: true });
}
function providerResponse(reply: string, needsHuman: boolean): Response {
  return new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text",
      text: JSON.stringify({ reply, needsHuman }) }] }],
    usage: { input_tokens: 500, output_tokens: 80 },
  }), { status: 200 });
}

test("Phase 53: meaningful dialogue and strict transfer controls", async t => {
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

  await t.test("model may NOT silence a parent just for setting a budget boundary", async () => {
    clearConversationStore(); enableProvider();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? providerResponse("Das müsste Jochen übernehmen.", true)
        : providerResponse("Der Selbststarter ist für den selbstständigen Einstieg gedacht. Einen Kauf musst du jetzt nicht entscheiden.", false);
    };
    const first = await send("phase53-budget",
      "Wir müssen gerade aufs Geld achten, bitte keine Verkaufsshow.");
    assert.equal(first.state.answers.peteReplySource, "safe_noncritical");
    assert.equal(first.state.owner, "ai");
    assert.equal(first.state.aiPaused, false);
    assert.match(first.text || "", /keinen Kauf|nichts entscheiden|Orientierung/);
    const next = await send("phase53-budget",
      "Danke. Was bedeutet eigenständiger Einstieg eigentlich?");
    assert.equal(next.state.answers.peteReplySource, "llm");
    assert.equal(next.state.owner, "ai");
    assert.equal(calls, 2);
  });

  await t.test("model request for human on unrecognized case STILL stops automation", async () => {
    clearConversationStore(); enableProvider();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return providerResponse("Jochen sollte das persönlich prüfen.", true);
    };
    const first = await send("phase53-unknown",
      "Ich brauche eine individuelle Klärung zu etwas, das ich hier nicht erklären kann.");
    assert.equal(first.state.owner, "human");
    assert.equal(first.state.aiPaused, true);
    assert.equal(first.state.answers.peteLlmFailureReason, "model_handoff");
    const next = await send("phase53-unknown", "Hallo?");
    assert.equal(next.text, null);
    assert.equal(calls, 1);
  });

  await t.test("payment concern can NEVER be downgraded to budget smalltalk", async () => {
    clearConversationStore(); enableProvider();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("no API for payment"); };
    const out = await send("phase53-payment",
      "Ich habe bezahlt, aber mein Zugang fehlt, bitte prüft meine Zahlung. Wir haben kaum Geld.");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.aiPaused, true);
    assert.notEqual(out.state.answers.peteReplySource, "safe_noncritical");
    assert.equal(calls, 0);
  });

  await t.test("explicit human request, emergency and STOP stay hard-gated", async () => {
    clearConversationStore(); enableProvider();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("must be blocked"); };
    const human = await send("phase53-human", "Jochen soll bitte hier im Chat übernehmen.");
    assert.equal(human.state.owner, "human");
    const medical = await send("phase53-medical",
      "Ich nehme Insulin und bin gerade schwanger. Wie muss ich die Dosis ändern?");
    assert.equal(medical.state.owner, "human");
    const stop = await send("phase53-stop", "STOP. Bitte nicht mehr schreiben.");
    assert.equal(stop.state.flags.stopped, true);
    const again = await send("phase53-stop", "Hallo?");
    assert.equal(again.text, null);
    assert.equal(calls, 0);
  });

  await t.test("narrow handover exception refuses all personal or transaction risk", () => {
    for (const example of [
      "Ich habe die Zahlung bezahlt, habe aber wenig Geld.",
      "Mein Kind ist krank und ich habe Angst.",
      "Bitte mit Jochen persönlich sprechen, mein Budget ist knapp.",
      "Datenschutz, bitte nichts mehr speichern, ich hab kein Geld.",
      "Ich bin schwanger und brauche eine Lösung für kleines Budget.",
    ]) assert.equal(peteSafeBudgetBoundaryReply(example), null, example);
    assert.match(peteSafeBudgetBoundaryReply("Bitte keine Verkaufsshow, Budget knapp.") || "",
      /Orientierung/);
  });

  await t.test("combined offer scope and mandatory price facts need no invented checkout terms", async () => {
    clearConversationStore(); enableProvider();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("should be verified"); };
    const out = await send("phase53-scope",
      "Was ist im Angebot eigentlich enthalten und was muss ich verbindlich zahlen?");
    assert.equal(out.state.answers.peteReplySource, "verified_transaction");
    assert.match(out.text || "", /14,95/);
    assert.match(out.text || "", /499/);
    assert.match(out.text || "", /nicht verbindlich bestätigen/);
    assert.equal(calls, 0);
  });

  await t.test("the roleplays use actual parent messages, not role labels", () => {
    assert.equal(PETE_PHASE3_REALISTIC.length, 10);
    assert.equal(new Set(PETE_PHASE3_REALISTIC.map(x => x.id)).size, 10);
    for (const scenario of PETE_PHASE3_REALISTIC) {
      assert.ok(scenario.turns.length >= 4 && scenario.turns.length <= 10);
      assert.ok(scenario.turns[0].length > 30);
      assert.doesNotMatch(scenario.turns[0], /^Ich bin (?:Mutter trainiert|Käufer behauptet|Lead behauptet)/);
      for (let index = 0; index < scenario.turns.length; index++)
        assert.equal(getRealisticPhase3Message(scenario.id, index, ""), scenario.turns[index]);
      assert.equal(getRealisticPhase3Message(scenario.id, scenario.turns.length, ""), null);
    }
    const repeated = getRealisticPhase3Message("family-01", 5,
      "Was hast du bisher versucht?");
    assert.match(repeated || "", /Warum fragst du wieder dasselbe/);
  });

  await t.test("noncritical reply cannot confirm a payment or promise a booking", () => {
    const example = peteSafeBudgetBoundaryReply("Budget knapp, bitte keinen Verkaufsdruck.");
    assert.ok(example);
    assert.doesNotMatch(example, /€|bezahlt|gebucht|verifiziert/);
    const claimed = getPeteVerifiedTransactionAnswer(
      "Ich habe bezahlt, aber keine Bestätigung bekommen.", {} as any);
    assert.equal(claimed?.handoff, true);
  });
});
