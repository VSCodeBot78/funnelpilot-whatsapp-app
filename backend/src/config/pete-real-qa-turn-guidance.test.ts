import assert from "node:assert/strict";
import test from "node:test";
import { buildPeteContext, buildPeteTurnPriorityGuidance, evaluatePeteLlmContinuity } from "../core/pete-llm-conversation.js";

function guide(...turns: string[]): string {
  const conversation = {
    messages: turns.map(text => ({ role: "user", text })),
  } as unknown as Parameters<typeof buildPeteTurnPriorityGuidance>[0];
  return buildPeteTurnPriorityGuidance(conversation);
}

test("real QA F02: do not ask an exhausted parent who explicitly declines questions", () => {
  const result = guide(
    "Ich bin Mama von zwei Kindern, arbeite Vollzeit und bin abends völlig platt.",
    "Ich bin manchmal so müde, dass ich mit den Kindern einschlafe.",
    "Ich schaffe keinen zusätzlichen Plan und will nicht dauernd ausgefragt werden.");
  assert.match(result, /NULL Fragen/);
  assert.match(result, /ohne CTA/);
});

test("real QA F20: 'keine weiteren Fragen' is a direct no-question boundary", () => {
  const result = guide(
    "Ich bin ständig erschöpft und will nicht noch mehr Pflichten.",
    "Du stellst aber schon wieder eine Frage. Ich will jetzt keine weiteren Fragen.");
  assert.match(result, /NULL Fragen/);
});

test("QA: a no-question boundary survives an unrelated later user message", () => {
  const text = guide(
    "Bitte keine weiteren Fragen, ich möchte gerade nicht ausgefragt werden.",
    "Ich arbeite im Schichtdienst und meine Pausen fallen aus.");
  assert.match(text, /NULL Fragen/);
});

test("QA: explicit invitation reopens questions without overriding other safety rules", () => {
  const text = guide(
    "Bitte keine weiteren Fragen.",
    "Du darfst mich jetzt wieder fragen.",
    "Ich arbeite im Schichtdienst.");
  assert.doesNotMatch(text, /NULL Fragen/);
});

test("QA: a user's own question does not silently invite Pete to interrogate them", () => {
  const text = guide(
    "Ich will nicht dauernd ausgefragt werden.",
    "Wie funktioniert eure Methode?");
  assert.match(text, /NULL Fragen/);
});

test("QA: neutral messages about questions are not treated as a no-question order", () => {
  const text = guide(
    "Meine Tochter hat Fragen zum Schwimmen.",
    "Ich will wieder mehr Energie.");
  assert.doesNotMatch(text, /NULL Fragen/);
});

test("QA: colloquial no-more-questions requests remain respected across turns", () => {
  for (const lead of [
    "Bitte keine Fragen mehr.",
    "Keine Fragen mehr bitte.",
    "Hör bitte auf mich auszufragen.",
  ]) {
    assert.match(guide(lead, "Ich arbeite Vollzeit und die Kinder sind krank."),
      /NULL Fragen/, lead);
  }
});

test("QA: a person with no questions of their own did not prohibit Pete's questions", () => {
  assert.doesNotMatch(guide("Ich habe keine Fragen mehr.",
    "Mich beschäftigt aber mein Schlafrhythmus."), /NULL Fragen/);
});

test("real QA F03: the food is ALREADY packed; breaks are the problem", () => {
  const result = guide(
    "Ich trainiere viermal die Woche und nehme Essen mit. Meine Schicht ist chaotisch.",
    "Die Pausen fallen oft aus. Dann stopfe ich abends irgendwas rein.");
  assert.match(result, /bereits mitgenommen/);
  assert.match(result, /Snackboxen/);
});

test("real QA F12: do not ask if failed attempts occurred when disclosed", () => {
  const result = guide(
    "Ich fange immer montags an und lasse es am Donnerstag wieder sein.",
    "Ich habe schon so viel probiert.");
  assert.match(result, /(?:bereits|ausdrücklich) genannt/);
  assert.match(result, /(?:Weder erneut fragen|Frage NICHT nochmal)/);
});

test("real QA F04: child disruption/frustration is not another probing invitation", () => {
  const result = guide(
    "Mein Kind war die ganze Woche krank.",
    "Ich habe Angst, dass ich nie dranbleibe. Jetzt habe ich wieder aufgehört.");
  assert.match(result, /Sorge\/Scham/);
});

test("real QA F14: an explicit first-step request must be answered first", () => {
  const result = guide(
    "Meine Pausen fallen oft aus.",
    "Was könnte ich als allererstes tun?");
  assert.match(result, /ZUERST sachlich beantworten/);
});

test("no invented classification of a simple follower greeting", () => {
  assert.equal(guide("Hi, ich folge dir seit heute."), "");
});

test("lead text and private details are not copied into priority instructions", () => {
  const result = guide("Bitte keine weiteren Fragen. Das geheime Passwort ist XYZ-SENSITIVE-STRING.");
  assert.match(result, /NULL Fragen/);
  assert.doesNotMatch(result, /XYZ-SENSITIVE-STRING/);
  assert.doesNotMatch(result, /Passwort/);
});

test("QA: output guard enforces earlier no-question instruction", () => {
  const state = { messages: [
    { role: "user", text: "Ich möchte keine weiteren Fragen." },
    { role: "assistant", text: "Okay, ich frage nicht weiter." },
    { role: "user", text: "Die Arbeit und Kinder kosten mich viel Energie." },
  ] } as any;
  assert.equal(evaluatePeteLlmContinuity(state,
    "Was würdest du denn am liebsten ändern?"), "question_after_explicit_boundary");
  assert.equal(evaluatePeteLlmContinuity(state,
    "Da kommt bei dir gerade sehr viel zusammen."), null);
});

test("QA: output guard allows questions after invitation and rejects renewed stop", () => {
  const base = [
    { role: "user", text: "Keine weiteren Fragen bitte." },
    { role: "assistant", text: "Alles klar." },
    { role: "user", text: "Du darfst mich jetzt wieder fragen." },
  ];
  const state = { messages: base } as any;
  assert.equal(evaluatePeteLlmContinuity(state,
    "Was wäre dir aktuell besonders wichtig?"), null);
  state.messages.push({ role: "user", text: "Frag bitte nicht mehr weiter." });
  assert.equal(evaluatePeteLlmContinuity(state,
    "Was wäre dir aktuell besonders wichtig?"), "question_after_explicit_boundary");
});

test("QA: after a substantive answer, Pete must not reflexively ask another question", () => {
  const state = { messages: [
    { role: "user", text: "Ich schaffe meine Mahlzeiten auf Arbeit kaum." },
    { role: "assistant", text: "Was passiert denn während der Schicht?" },
    { role: "user", text: "Ich nehme mir Essen mit, aber die Pausen fallen oft aus. Am Abend habe ich großen Hunger." },
  ] } as any;
  assert.match(buildPeteTurnPriorityGuidance(state), /zweite automatische Bedarfserhebung/);
});

test("QA: answering a buyer's new direct question is not blocked", () => {
  const state = { messages: [
    { role: "assistant", text: "Was möchtest du verändern?" },
    { role: "user", text: "Was unterscheidet euer Konzept von einem klassischen Ernährungsplan?" },
  ] } as any;
  const guidance = buildPeteTurnPriorityGuidance(state);
  assert.doesNotMatch(guidance, /zweite automatische Bedarfserhebung/);
  assert.match(guidance, /ZUERST sachlich beantworten/);
});

test("QA: short leads are not forced into a fixed response", () => {
  const state = { messages: [
    { role: "assistant", text: "Was beschäftigt dich?" },
    { role: "user", text: "Stress." },
  ] } as any;
  assert.doesNotMatch(buildPeteTurnPriorityGuidance(state), /zweite automatische Bedarfserhebung/);
});


test("strong setter: in active purchase talk, first sleep-on-it objection invites exactly one clarification", () => {
  const guidance = guide(
    "Ich interessiere mich für den Selbststarter und überlege zu kaufen.",
    "Ich muss erst noch eine Nacht drüber schlafen.");
  assert.match(guidance, /Kaufgespraech mit erstem offenen Bedenkzeit-Einwand/);
  assert.match(guidance, /Genau EINE kurze Frage/);
  assert.match(guidance, /Bedenkzeit ohne weitere Verkaufsschleife respektieren/);
});

test("strong setter: hesitating outside a purchasing conversation is not assumed to be an objection", () => {
  assert.doesNotMatch(guide("Ich muss erst noch eine Nacht drüber schlafen."), /Kaufgespraech/);
  assert.doesNotMatch(guide(
    "Ich wollte bloß die Reels anschauen.",
    "Ich denke darüber nach."), /Kaufgespraech/);
});

test("strong setter: no-questions and explicit disinterest override an open sales context", () => {
  const boundary = guide(
    "Ich interessiere mich für den Selbststarter.",
    "Ich will nicht dauernd ausgefragt werden.",
    "Ich möchte noch eine Nacht drüber schlafen.");
  assert.match(boundary, /NULL Fragen/);
  assert.doesNotMatch(boundary, /Kaufgespraech mit erstem offenen Bedenkzeit-Einwand/);
  const decline = guide(
    "Ich interessiere mich für den Selbststarter.",
    "Nein danke, ich muss erst noch eine Nacht drüber schlafen.");
  assert.doesNotMatch(decline, /Kaufgespraech mit erstem offenen Bedenkzeit-Einwand/);
});

test("strong setter: partner's role is respected, never framed as an obstacle", () => {
  const guidance = guide(
    "Ich interessiere mich für das Coaching.",
    "Ich muss erst mit meiner Partnerin sprechen.");
  assert.match(guidance, /Legitime Partnerentscheidung/);
  assert.match(guidance, /keine Umgehung oder Abwertung/);
  assert.doesNotMatch(guide("Ich muss mit meiner Frau reden."), /Legitime Partnerentscheidung/);
});

/**
 * University research transfer (Princeton reliability, Microsoft state/memory):
 * Paired, deterministic long-context tests with no provider and no new tools.
 * A correction is recent user evidence, not an inferred personality profile.
 */
function longContext(old: string, latest: string, middle?: string) {
  const messages = [
    { role: "user", text: old },
    ...(middle ? [{ role: "user", text: middle }] : []),
    ...Array.from({ length: 37 }, () => ({ role: "assistant", text: "Okay." })),
    { role: "user", text: latest },
  ];
  return buildPeteContext({ campaignId: "research-memory", source: "ig-test", messages } as any);
}

test("research memory: explicit updated schedule supersedes stale old shift-work evidence", () => {
  const context = longContext("Ich arbeite im Schichtdienst und habe unregelmäßige Pausen.",
    "Ich arbeite inzwischen tagsüber und habe feste Pausen.");
  assert.equal(context.earlierLeadEvidence.find(item => item.topic === "work_and_schedule"), undefined);
  assert.match(context.conversation.at(-1)?.text ?? "", /inzwischen tagsüber/);
  assert.ok(JSON.stringify(context).length <= 12000);
});

test("research memory: no correction preserves the older literal lead statement", () => {
  const context = longContext("Meine Schichtarbeit lässt mir kaum feste Pausen.",
    "Ich wollte noch mal wegen deiner Methode fragen.");
  const older = context.earlierLeadEvidence.find(item => item.topic === "work_and_schedule");
  assert.match(older?.excerpt ?? "", /Schichtarbeit/);
});

test("research memory: a schedule correction does not erase unrelated nutrition evidence", () => {
  const context = longContext("Ich esse oft spät und habe abends Heißhunger.",
    "Ich arbeite mittlerweile nur noch tagsüber.", "Ich hatte früher viele Nachtschichten.");
  const nutrition = context.earlierLeadEvidence.find(item => item.topic === "nutrition");
  assert.match(nutrition?.excerpt ?? "", /Heißhunger/);
  assert.equal(context.earlierLeadEvidence.find(item => item.topic === "work_and_schedule"), undefined);
});

test("research memory: recent assistant wording cannot rewrite user-supplied facts", () => {
  const messages = [
    { role: "user", text: "Ich arbeite im Schichtdienst." },
    ...Array.from({ length: 37 }, () => ({ role: "assistant", text: "Okay." })),
    { role: "assistant", text: "Du arbeitest inzwischen tagsüber, oder?" },
    { role: "user", text: "Welche Angebote gibt es?" },
  ];
  const context = buildPeteContext({ campaignId: "research-memory", messages } as any);
  assert.match(context.earlierLeadEvidence.find(item => item.topic === "work_and_schedule")?.excerpt ?? "", /Schichtdienst/);
});

test("research memory: explicit revised goal wins but stored refusal is not a new consent", () => {
  const context = longContext("Ich möchte vor allem meinen Bauchumfang reduzieren.",
    "Inzwischen will ich erst mal mehr Energie im Alltag.");
  assert.equal(context.earlierLeadEvidence.find(item => item.topic === "goals"), undefined);
  assert.match(context.conversation.at(-1)?.text ?? "", /mehr Energie/);
  assert.ok(!("marketingConsent" in context));
});
