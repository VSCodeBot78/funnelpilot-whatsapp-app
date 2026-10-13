import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Phase 58: 20 different multi-turn setter/closer cases.
// Simulated provider responses only. These are NOT model-quality scores.
// No network, real Instagram, WhatsApp or paid API usage.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-setter-matrix-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_MOBILE_LAB_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
process.env.PETE_LLM_API_CALLS_APPROVED = "true";
process.env.OPENAI_MODEL = "gpt-4.1-mini";
process.env.OPENAI_API_KEY = "offline-test-key-not-real";

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { OFFER_TRUTH } = await import("./offer-truth.js");

writeSettings({ aiEnabled: true });
type Journey = { id: string; turns: string[] };
const journeys: Journey[] = [
  { id: "f01-first-impression", turns: [
    "Ich bin neu hier und habe zwei Kinder. Worum geht es auf deinem Profil?",
    "Ich habe schon so viel Werbung für Fitness gesehen.",
    "Was macht Jochen anders als die vielen Diätaccounts?",
  ] },
  { id: "f02-low-energy", turns: [
    "Ich habe drei Kinder und bin jeden Abend müde.",
    "Die Nacht ist oft unterbrochen und morgens muss ich gleich los.",
    "Ich hätte einfach gerne wieder mehr Energie im Alltag.",
  ] },
  { id: "f03-impatient-parent", turns: [
    "Ich möchte wieder abnehmen und bin gerade sehr beschäftigt.",
    "Bitte keine langen Texte. Ich bin gerade unterwegs.",
    "Was ist denn hier überhaupt der nächste sinnvolle Schritt?",
  ] },
  { id: "f04-skeptical", turns: [
    "Ich finde Fitnesswerbung meistens ziemlich übertrieben.",
    "Versprichst du mir auch wieder schnelle Wunder?",
    "Ich möchte vor allem wissen, wie deine Begleitung funktioniert.",
  ] },
  { id: "l01-shift-and-meals", turns: [
    "Ich trainiere viermal die Woche. Mein Essen ist wegen Schichtarbeit schwierig.",
    "Vorbereiten kann ich gut, aber meine Pausen sind nicht planbar.",
    "Ich hätte dabei gerne etwas persönliche Unterstützung.",
  ] },
  { id: "l02-night-shifts", turns: [
    "Ich bin Vater von zwei Kindern und habe regelmäßig Nachtschicht.",
    "Wegen der wechselnden Zeiten ist mein Schlaf ziemlich unregelmäßig.",
    "Ich möchte mehr Struktur, ohne ständig wieder von vorne anzufangen.",
  ] },
  { id: "l03-start-stop", turns: [
    "Ich habe schon mehrere Fitnessprogramme abgebrochen.",
    "Sobald ein Kind krank wird, fange ich wieder bei null an.",
    "Ein fester Plan passt einfach nicht zu unserem Familienalltag.",
  ] },
  { id: "l04-family-food", turns: [
    "Ich möchte abnehmen, aber meine Kinder essen nicht alles.",
    "Für alle separat zu kochen kommt für mich nicht infrage.",
    "Die Umsetzung zuhause wäre mir bei einer Begleitung besonders wichtig.",
  ] },
  { id: "l05-keto-curious", turns: [
    "Ich habe ein paar Videos zu Keto gesehen.",
    "Ist Keto grundsätzlich sinnvoll oder kann ich auch normal essen?",
    "Ich möchte etwas, das ich mit der Familie umsetzen kann.",
  ] },
  { id: "l06-parent-worried", turns: [
    "Ich bin Mama und habe das Gefühl, dass ich nie Zeit für mich habe.",
    "Mein Job und die Kinder lassen kaum Spielraum.",
    "Ich will nicht wieder mit einem perfekten Wochenplan anfangen.",
  ] },
  { id: "s01-warm-interest", turns: [
    "Ich komme alleine nicht so richtig vorwärts.",
    "Ich habe einiges probiert, aber mir fehlt jemand, der mitdenkt.",
    "Eine persönliche Begleitung könnte ich mir gut vorstellen.",
  ] },
  { id: "s02-budget-concern", turns: [
    "Ich will fitter werden, aber wir müssen gerade aufs Geld achten.",
    "Wir haben hohe Kita-Ausgaben und müssen genau überlegen.",
    "Vielleicht schaue ich mir erst mal an, was Jochen anbietet.",
  ] },
];

function simulatedResponse(reply: string): Response {
  return new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text",
      text: JSON.stringify({ reply, needsHuman: false }) }] }],
    usage: { input_tokens: 450, output_tokens: 95 },
  }), { status: 200 });
}
const send = (leadId: string, messageText: string) =>
  processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural", messageText });

test("Phase 58: 20 diverse GPT-setting and guarded buyer/safety journeys", async t => {
  const realFetch = globalThis.fetch;
  let apiCalls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses",
      "a synthetic run must never call another network service");
    apiCalls++;
    const body = JSON.parse(String((options as RequestInit | undefined)?.body));
    assert.equal(body.model, "gpt-4.1-mini");
    assert.equal(body.store, false);
    assert.match(body.instructions, /KI-DM-Setter/);
    assert.match(body.instructions, /KEIN DM-COACHING/);
    assert.match(body.instructions, /CLOSER-LOGIK/);
    assert.doesNotMatch(body.instructions, /sk-proj-/i);
    return simulatedResponse(
      "Verstanden, danke für deine Einordnung. Wäre Unterstützung dabei für dich grundsätzlich interessant? (" +
      String(apiCalls) + ")"
    );
  };
  t.after(() => {
    globalThis.fetch = realFetch;
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    delete process.env.OPENAI_API_KEY;
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  for (const journey of journeys) {
    await t.test(journey.id + " keeps all stated facts across 3 turns", async () => {
      clearConversationStore();
      const id = "phase58-" + journey.id;
      for (let index = 0; index < journey.turns.length; index++) {
        const before = apiCalls;
        const output = await send(id, journey.turns[index]);
        assert.equal(apiCalls, before + 1, "one mocked provider call per turn");
        assert.equal(output.state.answers.peteReplySource, "llm");
        assert.equal(output.state.owner, "ai");
        assert.equal(output.state.aiPaused, false);
        const last = output.state.messages.at(-1);
        assert.equal(last?.role, "assistant");
        for (const spoken of journey.turns.slice(0, index + 1)) {
          assert.ok(output.state.messages.some(m => m.role === "user" && m.text === spoken),
            "parent statements must remain in transcript");
        }
        assert.doesNotMatch(output.text ?? "", /https?:\/\/|€|garantiert|2 bis 3 Snacks/i);
      }
    });
  }

  // Every guarded case must bypass the simulated provider entirely, either
  // with verified facts or genuine local human/STOP suppression.
  const guardCases = [
    { id: "c01-check", turns: ["CHECK"], source: "verified_transaction",
      pattern: /check\.jochen-kammerer\.de/ },
    { id: "k01-keto", turns: ["KETO"], source: "verified_transaction",
      pattern: /keto-guide/ },
    { id: "b01-bullshit", turns: ["BULLSHIT"], source: "verified_transaction",
      pattern: /no-bullshit-elternfitness/ },
    { id: "s03-price", turns: ["Was kostet der Selbststarter?"], source: "verified_transaction",
      pattern: /14,95/ },
    { id: "x01-human", turns: ["Jochen soll bitte hier übernehmen", "Und nun?"], source: "human_handoff",
      pattern: /Jochen/ },
    { id: "x02-stop", turns: ["Bitte nicht mehr schreiben", "Hallo?"], source: "guarded_safety",
      pattern: /(?:schreib|Nachricht|Kontakt|respekt)/i },
    { id: "x03-duplicates", turns: [
      "Auf Instagram und WhatsApp antworten eure Bots doppelt!",
      "Ich möchte keine Nachrichten von zwei Bots.",
    ], source: "verified_transaction", pattern: /Jochen/ },
    { id: "x04-payment", turns: [
      "Ich habe den Selbststarter gekauft, aber die Zugangs-Mail fehlt.",
      "Ist meine Bestellung jetzt bezahlt?",
    ], source: "verified_transaction", pattern: /Bestellprüfung|Zugangs-Mail|Jochen/i },
  ] as const;
  for (const scenario of guardCases) {
    await t.test(scenario.id + " respects trusted facts and handover", async () => {
      clearConversationStore();
      const before = apiCalls;
      let first: Awaited<ReturnType<typeof send>> | null = null;
      for (const [i, turn] of scenario.turns.entries()) {
        const out = await send("phase58-" + scenario.id, turn);
        if (i === 0) first = out;
        if (i > 0 && first?.state.owner === "human") {
          assert.equal(out.text, null, "Pete cannot reply after human takeover");
        }
      }
      assert.ok(first);
      assert.equal(first.state.answers.peteReplySource, scenario.source);
      assert.match(first.text ?? "", scenario.pattern);
      assert.equal(apiCalls, before, "guarded path must not contact provider");
      if (["x01-human","x03-duplicates","x04-payment"].includes(scenario.id)) {
        assert.equal(first.state.owner, "human");
        assert.equal(first.state.aiPaused, true);
      }
      if (scenario.id === "x02-stop") {
        assert.equal(first.state.flags.stopped, true);
      }
    });
  }
  assert.equal(journeys.length + guardCases.length, 20);
  assert.equal(apiCalls, journeys.length * 3);
});
