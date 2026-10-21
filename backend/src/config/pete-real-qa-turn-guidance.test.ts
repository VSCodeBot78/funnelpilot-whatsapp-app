import assert from "node:assert/strict";
import test from "node:test";
import { buildPeteTurnPriorityGuidance, evaluatePeteLlmContinuity } from "../core/pete-llm-conversation.js";

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
