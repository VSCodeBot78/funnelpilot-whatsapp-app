import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// All provider responses are mocked. NO OpenAI, Meta or WhatsApp requests.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-pete-phase49-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { getOrCreateConversationState, appendAssistantMessage, persistConversationState } =
  await import("../core/state-manager.js");
const { writeSettings } = await import("../services/settings-store.js");
const { OFFER_TRUTH } = await import("./offer-truth.js");
const { validatePeteLlmReply } = await import("../core/pete-llm-conversation.js");
const { isGeneralNonMedicalKnowledgeRequest, normalizePeteReplyStyle,
  getPeteVerifiedTransactionAnswer, isUnsafeLlmClaim } =
  await import("../core/pete-conversation-quality.js");

function enableMock() {
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  process.env.OPENAI_API_KEY = "test-fake-key-only";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  writeSettings({ aiEnabled: true });
}
async function send(leadId: string, messageText: string) {
  return processIncomingMessage({
    leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural",
  });
}
const mockResponse = (reply: string) => new Response(JSON.stringify({
  output: [{ content: [{ type: "output_text", text: JSON.stringify({
    reply, needsHuman: false,
  }) }] }],
  usage: { input_tokens: 200, output_tokens: 80 },
}), { status: 200 });

test("Phase 49: verified transactions plus safe context-aware AI", async t => {
  const prevFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = prevFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await t.test("price is answered from offer truth, not the questionnaire", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("price must be verified"); };
    const result = await send("phase49-price", "Wie teuer ist das?");
    assert.match(result.text || "", /14,95/);
    assert.match(result.text || "", /499/);
    assert.equal(result.state.answers.peteReplySource, "verified_transaction");
    assert.equal(calls, 0);
    const coaching = getPeteVerifiedTransactionAnswer("Was kostet das Coaching?", result.state);
    assert.match(coaching?.text || "", /499/);
    const starter = getPeteVerifiedTransactionAnswer("Was kostet der Selbststarter?", result.state);
    assert.ok(starter?.text.includes(OFFER_TRUTH.selfstarter.productUrl));
    assert.match(getPeteVerifiedTransactionAnswer("Was kostet Premium für 6 Monate?",
      result.state)?.text || "", /Jochen persönlich/);
  });

  await t.test("natural multi-sentence price questions answer 499 euros without provider or silent takeover", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("confirmed prices must not use an LLM"); };
    const cases = [
      "Ich glaube, ich brauche eher jemanden, der mich begleitet. Trainingsplaene gibt's ja ueberall, aber alleine ziehe ich das nie durch. Was wuerde mich so eine Begleitung bei Jochen denn kosten?",
      "Ich brauche wohl jemanden, der mich begleitet. Was wuerde mich eine persoenliche Begleitung bei dir kosten?",
      "Was wuerde mich so eine Begleitung kosten, so ungefaehr?",
    ];
    for (const [index, messageText] of cases.entries()) {
      const out = await send("phase49-natural-price-" + index, messageText);
      assert.match(out.text || "", /499/);
      assert.equal(out.state.answers.peteReplySource, "verified_transaction");
      assert.notEqual(out.state.owner, "human");
      assert.equal(out.replySuppressedReason, undefined);
    }
    assert.equal(calls, 0, "verified price must never require paid provider output");
  });

  await t.test("real follower: 'klar, kostet das was?' means strategy-call booking, never silent LLM handoff", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("strategy-call booking cost must bypass LLM"); };
    const question = "Wäre ein persönliches Strategiegespräch für dich passend, um zu klären, welche Unterstützung dir im Alltag wirklich hilft?";
    for (const [index, messageText] of [
      "klar, kostet das was?",
      "Kostet das Strategiegespräch was?",
      "ja, ist das kostenlos?",
      "muss ich dafür was zahlen?",
    ].entries()) {
      const id = "phase49-strategy-call-" + index;
      const s = getOrCreateConversationState(id, DEFAULT_CAMPAIGN_ID);
      appendAssistantMessage(s, question);
      persistConversationState(s);
      const out = await send(id, messageText);
      assert.match(out.text || "", /keine Zahlung nötig|Terminbuchung kostet nichts/);
      assert.match(out.text || "", /https:\/\/calendly\.com\/eltern-fitundvital\/strategiegespraech/);
      assert.doesNotMatch(out.text || "", /499|14,95/);
      assert.equal(out.state.answers.peteReplySource, "verified_transaction");
      assert.equal(out.state.owner, "ai");
      assert.equal(out.state.aiPaused, false);
      assert.equal(out.replySuppressedReason, undefined);
    }
    assert.equal(calls, 0);
    const differentLinkState = getOrCreateConversationState("phase49-different-event", DEFAULT_CAMPAIGN_ID);
    appendAssistantMessage(differentLinkState, question);
    const unverified = getPeteVerifiedTransactionAnswer("klar, kostet das was?", differentLinkState,
      "https://calendly.com/eltern-fitundvital/coaching");
    assert.match(unverified?.text || "", /nicht bestätigt|nicht sicher prüfen/);
    assert.doesNotMatch(unverified?.text || "", /keine Zahlung nötig|strategiegespraech\b/);
    assert.equal(unverified?.handoff, undefined);
    const tracked = getPeteVerifiedTransactionAnswer("klar, kostet das was?", differentLinkState,
      "https://calendly.com/eltern-fitundvital/strategiegespraech?utm_source=whatsapp_funnel_app&utm_campaign=eltern-vital-fit");
    assert.match(tracked?.text || "", /keine Zahlung nötig/);
    assert.equal(tracked?.handoff, undefined);
    const deceptive = getPeteVerifiedTransactionAnswer("klar, kostet das was?", differentLinkState,
      "https://calendly.com.evil.example/eltern-fitundvital/strategiegespraech");
    assert.match(deceptive?.text || "", /nicht bestätigt|nicht sicher prüfen/);
    assert.doesNotMatch(deceptive?.text || "", /evil\.example|keine Zahlung nötig|https:\/\//);

    const coaching = getPeteVerifiedTransactionAnswer("Was kostet die 5-Wochen-Begleitung?",
      differentLinkState);
    assert.match(coaching?.text || "", /499/);
  });

  await t.test("accepted strategy-call invitation is never an LLM handoff", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("booking acceptance must avoid provider"); };
    const offer = "Ein persönliches Strategiegespräch wäre dafür ein sinnvoller nächster Schritt, um zu klären, welche Begleitung zu deinem Alltag passt. Möchtest du das?";
    for (const [index, reply] of ["wenn es unverbindlich ist gerne", "ja gerne", "klar"].entries()) {
      const leadId = "phase49-yes-" + index;
      const state = getOrCreateConversationState(leadId, DEFAULT_CAMPAIGN_ID);
      appendAssistantMessage(state, offer);
      persistConversationState(state);
      const out = await send(leadId, reply);
      assert.match(out.text || "", /calendly\.com\/eltern-fitundvital\/strategiegespraech/);
      assert.equal(out.state.owner, "ai");
      assert.equal(out.replySuppressedReason, undefined);
      assert.equal(out.state.answers.peteReplySource, "verified_transaction");
      assert.equal(out.state.currentStep, "booking");
    }
    assert.equal(calls, 0);
  });

  await t.test("self-reported booking is not a provider-verified booking", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("no provider required"); };
    const result = await send("phase49-booking",
      "Ich habe einen Termin gebucht, aber keine Bestätigung. Ist meine Buchung wirklich verifiziert?");
    assert.match(result.text || "", /keine verifizierte Buchungsbestätigung/);
    assert.equal(result.state.owner, "human");
    assert.equal(result.state.aiPaused, true);
    assert.equal(result.state.answers.peteReplySource, "verified_transaction");
    assert.equal(calls, 0);
  });

  await t.test("payment and missing access go to human, never a sales quiz", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("no receipt from model"); };
    const result = await send("phase49-purchase",
      "Ich habe bezahlt und der Zugang fehlt. Ist der Zahlungseingang bestätigt?");
    assert.match(result.text || "", /nicht verlässlich prüfen/);
    assert.equal(result.state.owner, "human");
    assert.doesNotMatch(result.text || "", /größte[rn]? Knackpunkt/);
    assert.equal(calls, 0);
  });

  await t.test("incidental appointment mention routes to full LLM context", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++; return mockResponse("Bei kranken Kindern kann Training pausieren. Ein flexibler Plan erleichtert später den Wiedereinstieg.");
    };
    const reply = await send("phase49-substance",
      "Ich möchte erst den Unterschied verstehen, bevor ich mit jemandem einen Termin vereinbare.");
    assert.equal(reply.state.answers.peteReplySource, "llm");
    assert.match(reply.text || "", /flexibler Plan/);
    assert.equal(calls, 1);
  });

  await t.test("historical pregnancy is not an acute health emergency", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++; return mockResponse("Du trainierst schon zweimal pro Woche. Allgemein können Erholung, Energiebilanz und Alltag eine Rolle spielen, ohne dass man daraus eine Diagnose ableiten kann.");
    };
    const reply = await send("phase49-post-pregnancy",
      "Ich trainiere zweimal pro Woche schwer und nehme nach der Schwangerschaft nicht ab.");
    assert.equal(reply.state.answers.peteReplySource, "llm");
    assert.match(reply.text || "", /Energiebilanz/);
    assert.equal(calls, 1);
    assert.equal(isGeneralNonMedicalKnowledgeRequest("Ich bin nach der Schwangerschaft nicht mehr so fit und trainiere."), true);
    assert.equal(isGeneralNonMedicalKnowledgeRequest(
      "Nach der Schwangerschaft habe ich starke Schmerzen beim Training."), false);
  });

  await t.test("general evidence without diagnosis may get a general answer", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++; return mockResponse("Regelmäßiges Krafttraining kann Muskeln erhalten. Schlaf und Ernährung spielen ebenfalls eine Rolle; das ersetzt keine Diagnose.");
    };
    const reply = await send("phase49-evidence",
      "Was sagt die Evidenz zu Krafttraining und Schlaf, ohne medizinische Ferndiagnose?");
    assert.equal(reply.state.answers.peteReplySource, "llm");
    assert.equal(calls, 1);
  });

  await t.test("acute symptoms and insulin remain medical safety handoffs", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("unsafe model call"); };
    const messages = [
      "Ich habe Typ-1-Diabetes und nehme Insulin. Muss ich die Dosis für Keto ändern?",
      "Ich habe Brustschmerzen und Schwindel beim Training.",
      "Ich bin schwanger und möchte jetzt eine strenge Keto-Diät anfangen.",
    ];
    for (let i = 0; i < messages.length; i++) {
      const reply = await send("phase49-medical-" + i, messages[i]);
      assert.notEqual(reply.state.answers.peteReplySource, "llm");
      assert.equal(reply.state.aiPaused, true);
    }
    assert.equal(calls, 0);
  });

  await t.test("no made-up personal experience, payment, price or channel promise", () => {
    for (const reply of [
      "Das kenne ich gut, meine Kinder machen das auch.",
      "Ich bleibe hier für dich da und antworte persönlich.",
      "Hier gibt es keine versteckten Kosten oder Extras.",
      "Alles basiert auf echten Informationen.",
      "Garantiert keine Doppelantworten auf Instagram und WhatsApp.",
      "Hier gibt es klare Antworten ohne automatische Nachsendungen.",
      "Deine Zahlung ist verifiziert.",
    ]) {
      assert.equal(isUnsafeLlmClaim(reply), true, reply);
      assert.equal(validatePeteLlmReply({ reply, needsHuman: false }), null, reply);
    }
  });

  await t.test("typographic dashes cannot become stray sentence dots", () => {
    const result = normalizePeteReplyStyle("Das passt gut — ohne starren Plan. 😅");
    assert.equal(result, "Das passt gut, ohne starren Plan.");
    assert.doesNotMatch(result, /\s+\./);
    assert.doesNotMatch(result, /[–—]/);
  });
});
