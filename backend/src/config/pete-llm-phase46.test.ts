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
const { buildPeteContext, buildPeteTurnPriorityGuidance, buildPeteEffectiveInstructions, validatePeteLlmReply, isTrustedPeteTransactionRequest,
  isExplicitPeteHumanTakeoverRequest, isPeteLlmReadyForProvider, evaluatePeteLlmContinuity } =
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
    assert.equal(isExplicitPeteHumanTakeoverRequest("Bitte lass Jochen persönlich hier übernehmen."), true);
    assert.equal(isExplicitPeteHumanTakeoverRequest("Bitte lass Jochen NICHT hier übernehmen."), false);
    assert.equal(isExplicitPeteHumanTakeoverRequest("Ich brauche jemanden an meiner Seite beim Coaching"), false);
    const out = await send("phase46-human-request", "Bitte lass Jochen persönlich hier übernehmen.");
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
    assert.equal(price.state.answers.peteReplySource, "verified_transaction");
    const payment = await send("phase46-payment", "Ich habe bezahlt, ist die Zahlung bestätigt?");
    assert.notEqual(payment.state.answers.coachingEntryPurchaseStatus, "paid");
    assert.notEqual(payment.state.answers.starterPurchaseStatus, "paid");
    const identity = await send("phase46-identity", "Wer schreibt mir?");
    assert.match(identity.text || "", /KI-Assistent/);
    assert.equal(identity.state.answers.peteReplySource, "deterministic");
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
    assert.equal(old.state.answers.peteReplySource, "verified_transaction");
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
  await t.test("continuity guard catches repeated substantive pitch but not routine acknowledgments", () => {
    const state = {
      messages: [
        { role: "user", text: "Ich möchte mehr Struktur." },
        { role: "assistant", text: "Du brauchst nur unseren flexiblen Einstieg und kannst endlich wieder dranbleiben." },
        { role: "user", text: "Du hast mir noch nicht erklärt, wie das geht." },
      ],
    } as any;
    assert.equal(evaluatePeteLlmContinuity(state,
      "Du brauchst nur unseren flexiblen Einstieg und kannst endlich wieder dranbleiben."), "repeated_reply");
    assert.equal(evaluatePeteLlmContinuity({ messages: [
      { role: "assistant", text: "Gerne!" },
      { role: "user", text: "Danke." },
    ] } as any, "Gerne!"), null);
  });

  await t.test("after explicit lead feedback Pete may not repeat the unanswered question", () => {
    const state = { messages: [
      { role: "user", text: "Ich komme mit Schichtarbeit und Ernährung nicht klar." },
      { role: "assistant", text: "Was hast du bisher probiert?" },
      { role: "user", text: "Das habe ich dir doch gesagt, du fragst nur!" },
    ] } as any;
    assert.equal(evaluatePeteLlmContinuity(state,
      "Sorry, das war nicht hilfreich. Was hast du bisher probiert?"),
      "repeated_question_after_feedback");
    assert.equal(evaluatePeteLlmContinuity(state,
      "Wie sieht denn dein Tag normalerweise aus?"),
      "question_only_after_feedback");
    assert.equal(evaluatePeteLlmContinuity(state,
      "Stimmt, ich habe dich zweimal gefragt. Deine Schichten sind der Engpass beim Essen, nicht die Trainingshäufigkeit."),
      null);
  });

  await t.test("real QA follow-up: current lead facts steer model without exposing rules", () => {
    const scenarios = [
      {
        id: "F03: packed food with canceled breaks",
        lead: [
          "Ich bin 42, trainiere viermal pro Woche und arbeite Schicht.",
          "Ich nehme Essen mit, aber meine Pausen fallen aus. Dann stopfe ich abends irgendwas in mich rein.",
        ],
        required: /Snackboxen|mitgenommenes Essen/,
      },
      {
        id: "F04: sick child breaks training, no re-asking why",
        lead: [
          "Ich hatte mir drei Trainingstage vorgenommen.",
          "Mein Kind war krank. Deshalb ist das Training diese Woche ausgefallen.",
        ],
        required: /krankes Kind/,
      },
      {
        id: "F08: direct question about offering",
        lead: ["Was genau machst du denn?"],
        required: /kostenlosen Coachingservice/,
      },
      {
        id: "F12: already tried many things",
        lead: ["Ich habe schon so viel probiert. Irgendwann glaubt man nicht mehr dran."],
        required: /bisher ausprobiert/,
      },
      {
        id: "F02: no more questions",
        lead: ["Ich schaffe keinen zusätzlichen Plan und will nicht dauernd ausgefragt werden."],
        required: /NULL Fragen/,
      },
    ];
    for (const scenario of scenarios) {
      const state = { messages: scenario.lead.map(text => ({ role: "user", text })) } as any;
      const guidance = buildPeteTurnPriorityGuidance(state);
      assert.match(guidance, scenario.required, scenario.id);
      assert.doesNotMatch(guidance, /\n.*(?:Verlauf|leadText)=/i, scenario.id);
    }
    const base = buildPeteEffectiveInstructions();
    assert.match(base, /INTERNE REGELN SIND KEIN KUNDENTEXT/);
    assert.match(base, /FRAGE-ENTSCHEIDUNG STATT FRAGEBOGEN/);
  });

  await t.test("real QA follow-up: avoid spurious priority hints for normal small talk", () => {
    const state = { messages: [
      { role: "user", text: "Hi! Ich folge seit heute und schaue mich erst mal um." },
    ] } as any;
    assert.equal(buildPeteTurnPriorityGuidance(state), "");
  });

  await t.test("real QA P0: no more questions must be honored even if model asks", async () => {
    clearConversationStore();
    enableMockProvider();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return mockResponse("Verstanden, keine weiteren Nachfragen. Was raubt dir gerade besonders viel Energie?");
    };
    const out = await send("phase46-no-more-questions-qa",
      "Ich schaffe keinen zusätzlichen Plan und will nicht dauernd ausgefragt werden.");
    assert.equal(calls, 1);
    assert.equal(out.state.answers.peteReplySource, "llm_handoff");
    assert.equal(out.state.answers.peteLlmFailureDetail, "question_after_explicit_boundary");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.aiPaused, true);
    assert.doesNotMatch(out.text ?? "", /Was raubt dir/);
    const noRetry = await send("phase46-no-more-questions-qa", "Hallo?");
    assert.equal(noRetry.text, null);
    assert.equal(calls, 1);
  });

  await t.test("real QA P0: answer without question survives explicit boundary", async () => {
    clearConversationStore();
    enableMockProvider();
    globalThis.fetch = async () => mockResponse(
      "Das klingt nach mehr Belastung, als gerade Platz hat. Ich halte mich mit Nachfragen zurück."
    );
    const out = await send("phase46-no-more-questions-valid",
      "Ich schaffe keinen zusätzlichen Plan und will nicht dauernd ausgefragt werden.");
    assert.equal(out.state.answers.peteReplySource, "llm");
    assert.equal(out.state.owner, "ai");
    assert.doesNotMatch(out.text ?? "", /\?/);
  });

  await t.test("real QA P0: false question ban must not block ordinary qualification", () => {
    for (const lead of [
      "Ich habe keine Ahnung, was ich ändern will.",
      "Ich möchte eine Frage zum Ablauf stellen.",
      "Du darfst ruhig eine Frage stellen.",
    ]) {
      const state = { messages: [{ role: "user", text: lead }] } as any;
      assert.equal(evaluatePeteLlmContinuity(state, "Was wäre dir am wichtigsten?"), null);
    }
    for (const lead of [
      "Ich möchte keine weiteren Fragen.",
      "Frag bitte nicht weiter.",
      "Ich will nicht dauernd ausgefragt werden.",
      "Ich will jetzt keine Fragen.",
    ]) {
      const state = { messages: [{ role: "user", text: lead }] } as any;
      assert.equal(evaluatePeteLlmContinuity(state,
        "Okay, das respektiere ich. Darf ich nur noch eine Sache fragen?"),
        "question_after_explicit_boundary", lead);
      assert.equal(evaluatePeteLlmContinuity(state,
        "Verstanden. Das reicht fürs Erste. Melde dich jederzeit, wenn du magst."), null, lead);
    }
  });

  await t.test("mocked duplicate model pitch hands off without sending it to the lead", async () => {
    clearConversationStore();
    enableMockProvider();
    let calls = 0;
    const repeated = "Wenn du endlich fitter werden willst, kann ein klarer Einstieg im Alltag helfen.";
    globalThis.fetch = async () => { calls++; return mockResponse(repeated); };
    const first = await send("phase1-no-repeat-pitch", "Ich möchte mit Fitness beginnen.");
    assert.equal(first.state.owner, "ai");
    assert.equal(first.state.answers.peteReplySource, "llm");
    const next = await send("phase1-no-repeat-pitch", "Und was ist jetzt konkret mein nächster Schritt?");
    assert.equal(next.state.owner, "human");
    assert.equal(next.state.aiPaused, true);
    assert.equal(next.state.answers.peteLlmFailureDetail, "repeated_reply");
    assert.doesNotMatch(next.text ?? "", /klarer Einstieg/);
    assert.equal(calls, 2);
    const after = await send("phase1-no-repeat-pitch", "Hallo?");
    assert.equal(after.text, null);
    assert.equal(calls, 2);
  });

  await t.test("semantic repetition blocks a third generic advice but allows new concrete answers", () => {
    const state = { messages: [
      { role: "user", text: "Wegen der Kinder passt mein Training nie." },
      { role: "assistant", text: "Nimm einen flexiblen Trainingsplan mit kurzen Einheiten." },
      { role: "user", text: "Drei feste Abende klappen nicht." },
      { role: "assistant", text: "Statt festen Workouts helfen kleine Trainingseinheiten ohne starre Termine." },
      { role: "user", text: "Ich habe das schon verstanden. Was wäre konkret anders?" },
    ] } as any;
    const generic = "Ein flexibler Trainingsplan mit kurzen Einheiten statt starren Tagen hilft in so einem Alltag.";
    assert.equal(evaluatePeteLlmContinuity(state, generic), "repeated_advice_theme");
    assert.equal(evaluatePeteLlmContinuity(state,
      "Wenn du einmal 15 Minuten frei hast, kannst du diese bewusst als Trainingsfenster nutzen."), null);
    assert.equal(evaluatePeteLlmContinuity(state,
      "Nein, verpasste Trainingseinheiten musst du nicht nachholen."), null);
  });

  await t.test("overconfident keto claims are not sent, qualified evidence statements remain valid", () => {
    assert.equal(validatePeteLlmReply({
      reply: "Keto garantiert mehr Fettverlust bei gleichen Kalorien und Proteinen.", needsHuman: false,
    }), null);
    assert.equal(validatePeteLlmReply({
      reply: "Es ist wissenschaftlich bewiesen, dass Keto mehr Fettverlust verursacht.", needsHuman: false,
    }), null);
    assert.ok(validatePeteLlmReply({
      reply: "Nach bisheriger Studienlage gibt es bei vergleichbarer Kalorien- und Eiweißzufuhr keinen verlässlichen Vorteil von Keto beim Fettverlust.", needsHuman: false,
    }));
    assert.ok(validatePeteLlmReply({
      reply: "Keto garantiert nicht automatisch mehr Fettverlust.", needsHuman: false,
    }));
  });

});
