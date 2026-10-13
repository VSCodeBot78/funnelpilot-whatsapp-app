import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-natural-chat-review-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
delete process.env.OPENAI_API_KEY;
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");

const scenarios: Array<{name: string; lead: string[]}> = [
  { name: "01 Mama Zeitmangel", lead: [
    "Ich habe keine Zeit für Sport",
    "10 Minuten ein paarmal die Woche gehen",
    "Habe mit YouTube mal angefangen",
    "Nach 2 Wochen war es immer zu stressig",
    "Ich möchte es erst selbst versuchen",
  ] },
  { name: "02 Papa Erschöpfung", lead: [
    "Ich bin Papa von zwei Kindern und abends immer platt",
    "Der Job und wenig Schlaf",
    "Ich habe nur phasenweise trainiert",
    "Mit den Kindern ist es immer wieder eingeschlafen",
    "Eine Begleitung wäre mir lieber",
  ] },
  { name: "03 Preis 5 Wochen", lead: [
    "Was kostet das?",
    "Die Begleitung",
  ] },
  { name: "04 Echtes Budgetproblem", lead: [
    "Das kann ich mir nicht leisten",
    "Das Geld ist gerade knapp",
  ] },
  { name: "05 Unsicherheit nach Fehlversuchen", lead: [
    "Ich habe schon alles versucht und wieder aufgehört",
    "Der Plan war zu streng",
    "Ich hätte gern jemanden, der mit mir dranbleibt",
  ] },
  { name: "06 Noch überlegen", lead: [
    "Ich muss überlegen",
    "Es passt gerade nicht",
  ] },
  { name: "07 Keto als persönliche Begleitung", lead: [
    "Ich möchte Keto-Coaching mit Unterstützung",
    "Ich fange immer an und breche beim Familienessen ab",
    "Die Familie isst anders",
    "Ich möchte Begleitung und jemanden der dranbleibt",
    "Mehr Energie und Keto alltagstauglich umsetzen",
    "Ich möchte direkt starten",
  ] },
  { name: "08 Kostenloser Keto Guide", lead: [
    "Schick mir bitte den Keto Guide",
  ] },
  { name: "09 Mit Jochen im Chat", lead: [
    "Ich möchte direkt mit Jochen sprechen",
    "Hier im Chat",
    "Danke, ich warte.",
  ] },
  { name: "10 Strategiegespräch", lead: [
    "Ich möchte ein Strategiegespräch buchen",
  ] },
  { name: "11 Verdacht auf ernste Erkrankung", lead: [
    "Ich habe Epilepsie und möchte mit Keto anfangen",
    "Ich nehme Medikamente, welche soll ich weglassen?",
  ] },
  { name: "12 Schwangerschaft und Keto", lead: [
    "Ich bin schwanger und möchte Keto umsetzen",
  ] },
  { name: "13 6-Monats-Preis unklar", lead: [
    "Was kostet die 6-Monats-Begleitung?",
  ] },
  { name: "14 Explizit kaufen", lead: [
    "Ich möchte die 5-Wochen-Begleitung buchen",
    "Ich möchte direkt loslegen",
  ] },
  { name: "15 STOP", lead: [
    "Bitte nicht mehr schreiben",
    "Wieso antwortest du?",
  ] },
];

test("15 complete deterministic chat previews for founder/manual DM voice review", async (t) => {
  t.after(() => { clearConversationStore(); fs.rmSync(dir, { recursive: true, force: true }); });
  for (const [index, scenario] of scenarios.entries()) {
    clearConversationStore();
    const conversation: Array<{lead: string; pete: string | null; nextStep: string; owner?: string}> = [];
    for (const messageText of scenario.lead) {
      const answer = await processIncomingMessage({
        leadId: "voice-review-" + index,
        campaignId: DEFAULT_CAMPAIGN_ID,
        conversationMode: "natural",
        messageText,
      });
      conversation.push({
        lead: messageText, pete: answer.text, nextStep: answer.nextStep,
        owner: answer.state.owner,
      });
      if (answer.text) {
        assert.doesNotMatch(answer.text, /(?:^|\n)[abcd]\)\s/im);
      }
    }
    console.log("FP_NATURAL_CHAT " + JSON.stringify({
      scenario: scenario.name,
      mode: "deterministic, not real OpenAI/Meta",
      conversation,
    }));
    assert.equal(conversation.length, scenario.lead.length);
  }
});


test("Pete Test 4: deterministic answers use actual parent context instead of repeating a generic question", async () => {
  process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
  process.env.PETE_LLM_API_CALLS_APPROVED = "false";
  delete process.env.OPENAI_API_KEY;
  const { appendHumanMessage, getOrCreateConversationState, persistConversationState, releaseToAi } =
    await import("../core/state-manager.js");
  const send = async (leadId: string, messageText: string) =>
    processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
      conversationMode: "natural", messageText });
  try {
    clearConversationStore();
    const intro = await send("test4-direct-follower",
      "Hey Jochen, bin neu auf deiner Seite. Was machst du so?");
    assert.equal(intro.state.answers.peteReplySource, "deterministic");
    assert.match(intro.text ?? "", /Pete.*KI-Assistent.*Jochen/s);
    assert.match(intro.text ?? "", /Fitness|fitter/i);
    assert.doesNotMatch(intro.text ?? "", /was möchtest du gerade|größte Knackpunkt/i);

    const money = await send("test4-money-offtopic", "Ich will mehr Geld auf dem Konto");
    assert.match(money.text ?? "", /Finanzfragen|anderes Thema/);
    assert.doesNotMatch(money.text ?? "", /Knackpunkt|Sportprogramm|Beratung.*Invest/);

    // Same state transition as the real synthetic follower_handoff lab.
    const id = "test4-manual-follower-handoff";
    const state = getOrCreateConversationState(id, DEFAULT_CAMPAIGN_ID);
    appendHumanMessage(state,
      "Hi, herzlich willkommen! Was beschäftigt dich am meisten: mehr Energie, abnehmen oder fitter werden?");
    releaseToAi(state);
    persistConversationState(state);
    const shift = await send(id, "Sowohl als auch. Wegen Schichtarbeit habe ich kaum Zeit.");
    assert.equal(shift.state.owner, "ai");
    assert.match(shift.text ?? "", /Schichtarbeit/);
    assert.doesNotMatch(shift.text ?? "", /größte Knackpunkt/);
    const complaint = await send(id, "Die Schichtarbeit sagte ich ja bereits");
    assert.match(complaint.text ?? "", /schon genannt|schon erwähnt|schon gesagt/);
    assert.match(complaint.text ?? "", /Rückfrage war unnötig/);
    assert.doesNotMatch(complaint.text ?? "", /größte Knackpunkt|Was ist für dich/);
    assert.notEqual(shift.text, complaint.text);

    const unknown = await send("test4-unknown-hello", "Etwas anderes.");
    assert.doesNotMatch(unknown.text ?? "", /größte Knackpunkt/);
    const next = await send("test4-unknown-hello", "Das habe ich doch gesagt.");
    assert.doesNotMatch(next.text ?? "", /größte Knackpunkt/);
  } finally {
    clearConversationStore();
  }
});
