import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// These tests check the REAL Pete backend through a simulated model provider.
// No requests may leave the process for OpenAI/Meta/WhatsApp.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-multi-persona-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { OFFER_TRUTH } = await import("./offer-truth.js");
const { validatePeteLlmReply } = await import("../core/pete-llm-conversation.js");

type PeteResult = Awaited<ReturnType<typeof processIncomingMessage>>;
async function send(id: string, text: string): Promise<PeteResult> {
  return processIncomingMessage({
    leadId: id, campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural", messageText: text,
  });
}
function on(): void {
  process.env.OPENAI_API_KEY = "offline-simulated-key";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  writeSettings({ aiEnabled: true });
}
const simulated = (reply: string, needsHuman = false): Response =>
  new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text",
      text: JSON.stringify({ reply, needsHuman }) }] }],
    usage: { input_tokens: 650, output_tokens: 80 },
  }), { status: 200 });

/** Returns the exact contexts actually sent to Pete's Responses request. */
function fakeModel(replies: readonly string[]): {
  requests: any[];
  count: () => number;
} {
  const requests: any[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses",
      "No traffic to any other host");
    const body = JSON.parse(String(init?.body ?? "{}"));
    requests.push(body);
    assert.equal(body.store, false);
    assert.match(body.instructions, /KI-DM-Setter/);
    assert.match(body.instructions, /KEIN DM-COACHING/);
    assert.match(body.instructions, /CLOSER-LOGIK/);
    assert.ok(Array.isArray(body.input));
    const reply = replies[requests.length - 1];
    assert.ok(reply, "Unexpected model request");
    return simulated(reply);
  };
  return { requests, count: () => requests.length };
}
function transcript(body: any) {
  const raw = String(body.input[0].content);
  const last = "\nBeantworte die letzte Lead-Nachricht.";
  return JSON.parse(raw.slice(raw.indexOf("\n") + 1, raw.lastIndexOf(last)));
}

test("Pete 20-case stress matrix: offline safety and multi-turn coverage", async t => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await t.test("F02: cold overloaded mother, three turns retain specific context", async () => {
    clearConversationStore(); on();
    const model = fakeModel([
      "Mit zwei Kindern und Job ist das verständlich. Geht es dir gerade eher um Energie oder ums Abnehmen?",
      "Du willst also im Alltag wieder mehr Energie. Was hast du bisher versucht?",
      "Wenn du schon mehrere Anläufe hattest, könnte Unterstützung sinnvoll sein. Wäre das für dich interessant?",
    ]);
    const id = "qa-f02-two-kids";
    for (const text of [
      "Ich bin Mama von zwei Kindern, berufstätig und ständig müde.",
      "Mehr Energie wäre mir wichtig. Ich will keine strenge Diät.",
      "Ich habe es schon oft allein versucht, aber bleibe nicht dran.",
    ]) {
      const r = await send(id, text);
      assert.equal(r.state.answers.peteReplySource, "llm");
      assert.equal(r.state.owner, "ai");
      assert.equal(r.replySuppressedReason, undefined);
    }
    assert.equal(model.count(), 3);
    const context = transcript(model.requests[2]);
    assert.ok(context.conversation.some((m: any) => m.text.includes("zwei Kindern")));
    assert.ok(context.conversation.some((m: any) => m.text.includes("strenge Diät")));
    assert.ok(context.conversation.some((m: any) => m.text.includes("allein versucht")));
    assert.ok(context.conversation.some((m: any) => m.text.includes("Mehr Energie")));
  });

  await t.test("F04: impatient dad keeps full context; user does not trigger default questionnaire", async () => {
    clearConversationStore(); on();
    const model = fakeModel([
      "Verstanden. Was hat dich bisher am meisten ausgebremst?",
      "Dann reden wir nicht um den heißen Brei. Wäre persönliche Begleitung für dich überhaupt eine Option?",
    ]);
    const id = "qa-f04-fast";
    const first = await send(id, "Will 8 Kilo abnehmen. Für lange Chats habe ich keine Zeit.");
    const second = await send(id, "Ich habe wenig Zeit. Komm bitte zum Punkt.");
    assert.equal(first.state.answers.peteReplySource, "llm");
    assert.equal(second.state.answers.peteReplySource, "llm");
    assert.equal(model.count(), 2);
    const ctx = transcript(model.requests[1]);
    assert.ok(ctx.conversation.some((m: any) => m.text.includes("8 Kilo")));
    assert.ok(ctx.conversation.some((m: any) => m.text.includes("zum Punkt")));
  });

  await t.test("L01: already training well; preserves meal-prep and unpredictable breaks", async () => {
    clearConversationStore(); on();
    const model = fakeModel([
      "Du trainierst schon regelmäßig. Beim Essen in der Schicht läuft es schwerer. Liegt es eher am Timing?",
      "Okay, Vorbereiten klappt bereits. Wäre Unterstützung bei der Umsetzung grundsätzlich interessant?",
      "Wenn dir Begleitung helfen könnte, wäre ein Gespräch mit Jochen sinnvoll. Möchtest du das?",
    ]);
    const id = "qa-l01-shifts";
    for (const text of [
      "Trainiere viermal pro Woche, aber mit Schichtdienst esse ich oft unregelmäßig.",
      "Vorkochen klappt gut. Ich weiß nur nie, wann ich Pause machen kann.",
      "Ja, für Unterstützung wäre ich grundsätzlich offen.",
    ]) {
      const result = await send(id, text);
      assert.equal(result.state.answers.peteReplySource, "llm");
    }
    assert.equal(model.count(), 3);
    const final = JSON.stringify(transcript(model.requests[2]));
    assert.match(final, /viermal pro Woche/);
    assert.match(final, /Vorkochen klappt/);
    assert.match(final, /Pause machen kann/);
    assert.match(final, /Unterstützung/);
  });

  await t.test("K01: exact guide request verified with no AI spend; follow-up is LLM", async () => {
    clearConversationStore(); on();
    const model = fakeModel([
      "Nein, Keto ist kein Muss. Entscheidend ist, was langfristig zu deinem Alltag passt.",
    ]);
    const first = await send("qa-k01-keto", "KETO");
    assert.equal(first.state.answers.peteReplySource, "verified_transaction");
    assert.ok(first.text?.includes(OFFER_TRUTH.resources.ketoGuide.url));
    assert.equal(model.count(), 0);
    const second = await send("qa-k01-keto", "Muss ich dauerhaft Keto machen?");
    assert.equal(second.state.answers.peteReplySource, "llm");
    assert.equal(model.count(), 1);
    assert.ok(transcript(model.requests[0]).conversation.some(
      (m: any) => m.text === "KETO"));
  });

  await t.test("B01: selfstarter keyword and purchase CTA are factual, never an invented offer", async () => {
    clearConversationStore(); on();
    const model = fakeModel([]);
    const first = await send("qa-b01-product", "BULLSHIT");
    assert.equal(first.state.answers.peteReplySource, "verified_transaction");
    assert.ok(first.text?.includes(OFFER_TRUTH.selfstarter.productUrl));
    const second = await send("qa-b01-product", "Zeig mir das Bundle");
    assert.equal(second.state.answers.peteReplySource, "verified_transaction");
    assert.ok(second.text?.includes(OFFER_TRUTH.selfstarter.productUrl));
    assert.equal(model.count(), 0);
    assert.doesNotMatch(String(second.text), /499|strategiegespräch/i);
  });

  await t.test("S02: explicit coaching price uses approved fact without paid AI calls", async () => {
    clearConversationStore(); on();
    const model = fakeModel([]);
    const reply = await send("qa-s02-price", "Was kostet die 5-Wochen-Begleitung?");
    assert.equal(reply.state.answers.peteReplySource, "verified_transaction");
    assert.ok(reply.text?.includes(OFFER_TRUTH.coachingEntry.priceText));
    assert.equal(model.count(), 0);
  });

  await t.test("S01/X01: explicit Jochen handover sticks across later messages", async () => {
    clearConversationStore(); on();
    const model = fakeModel([]);
    const first = await send("qa-s01-human", "Ich möchte, dass Jochen hier im Chat übernimmt.");
    assert.equal(first.state.owner, "human");
    assert.equal(first.state.aiPaused, true);
    const second = await send("qa-s01-human", "Hallo, liest Jochen schon mit?");
    assert.equal(second.text, null);
    assert.equal(second.replySuppressedReason, "human_owned");
    assert.equal(model.count(), 0);
  });

  await t.test("human takeover inflections are recognized without labeling coaching interest as takeover", async () => {
    const { isExplicitPeteHumanTakeoverRequest } = await import("../core/pete-llm-conversation.js");
    for (const utterance of [
      "Ich möchte, dass Jochen hier im Chat übernimmt.",
      "Jochen übernimmt bitte persönlich.",
      "Kann Jochen hier übernehmen?",
      "Jochen soll hier im Chat übernehmen.",
      "Bitte kein Bot mehr, ich will mit Jochen schreiben.",
    ]) {
      assert.equal(isExplicitPeteHumanTakeoverRequest(utterance), true, utterance);
    }
    for (const utterance of [
      "Ich könnte mir ein Coaching mit Jochen vorstellen.",
      "Ich wünsche mir mehr Unterstützung im Alltag.",
      "Was würde eine persönliche Begleitung bringen?",
    ]) {
      assert.equal(isExplicitPeteHumanTakeoverRequest(utterance), false, utterance);
    }
  });

  await t.test("X02: actual duplicate Instagram and WhatsApp bots must stop local AI", async () => {
    clearConversationStore(); on();
    const model = fakeModel([]);
    const first = await send("qa-x02-duplicate",
      "Ihr schreibt mir auf Instagram und WhatsApp gleichzeitig. Das nervt.");
    assert.equal(first.state.owner, "human");
    assert.equal(first.state.aiPaused, true);
    assert.ok(first.text);
    assert.doesNotMatch(first.text ?? "", /beide Kanäle sind pausiert|WhatsApp auch gestoppt/i);
    const second = await send("qa-x02-duplicate", "Hör auf, mich anzuschreiben!");
    assert.equal(second.text, null);
    assert.equal(model.count(), 0);
  });

  await t.test("X03: STOP never triggers model and blocks subsequent conversation", async () => {
    clearConversationStore(); on();
    const model = fakeModel([]);
    const first = await send("qa-x03-stop", "Bitte nicht mehr schreiben.");
    assert.equal(first.state.flags.stopped, true);
    const second = await send("qa-x03-stop", "Warum schreibst du noch?");
    assert.equal(second.text, null);
    assert.equal(model.count(), 0);
  });

  await t.test("S03: claimed paid order is NOT evidence of payment", async () => {
    clearConversationStore(); on();
    const model = fakeModel([]);
    const out = await send("qa-s03-payment",
      "Ich habe den Selbststarter gestern gekauft, die Zugangs-Mail ist nicht gekommen.");
    assert.notEqual(out.state.answers.starterPurchaseStatus, "paid");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.aiPaused, true);
    assert.notEqual(out.state.answers.peteReplySource, "llm");
    assert.equal(model.count(), 0);
  });

  await t.test("K02: medical risk stays away from sales LLM", async () => {
    clearConversationStore(); on();
    const model = fakeModel([]);
    const out = await send("qa-k02-medical",
      "Ich bin schwanger und nehme Medikamente. Ist Keto für mich sicher?");
    assert.equal(out.state.owner, "human");
    assert.equal(model.count(), 0);
  });

  await t.test("unverified model prices, transactions and links are rejected even at high lead intent", () => {
    for (const reply of [
      "Ich habe dir einen Termin gebucht.",
      "Deine Zahlung ist bestätigt.",
      "Das Coaching kostet nur 100 Euro.",
      "Buche direkt hier: https://invalid.example/test",
    ]) {
      assert.equal(validatePeteLlmReply({ reply, needsHuman: false }), null, reply);
    }
    assert.ok(validatePeteLlmReply({
      reply: "Wenn du persönlich schauen möchtest, ob Jochens Begleitung passt, können wir den nächsten Schritt klären.",
      needsHuman: false,
    }));
  });
});
