import test from "node:test";
import assert from "node:assert/strict";
import { decidePeteTurnV4, explainPeteTurnV4 } from "../core/pete-turn-policy-v4.js";

const state = (...lines: string[]) => ({
  messages: lines.map(text => ({ role: "user", text })),
}) as any;
const plan = (...lines: string[]) => decidePeteTurnV4(state(...lines));

test("Policy v4: direct questions get answers before another qualification", () => {
  for (const [first, second] of [
    ["Training läuft. Abends esse ich wegen Stress durcheinander.", "Was wäre bei euch anders als ein Ernährungsplan?"],
    ["Drei Coaches haben mir viel versprochen.", "Sag mir konkret, wie ihr die Umsetzung im Familienalltag angeht."],
    ["499 Euro finde ich teuer.", "Ich kann bezahlen. Wie unterscheidet sich euer Mehrwert?"],
    ["Abends bin ich komplett erledigt.", "Ich will keinen Pflichtplan. Was wäre realistisch?"],
    ["Du hast meine Frage nicht beantwortet.", "Wie funktioniert eure Methode bei krankem Kind?"],
    ["Ich suche Bodybuilding für Wettkämpfe.", "Passt das überhaupt zu euch?"],
    ["Ich möchte Begleitung statt PDF.", "Wie läuft der Einstieg ab?"],
  ]) {
    assert.equal(plan(first, second).action, "direct_answer", second);
  }
});

test("Policy v4: shift with dropped breaks needs concrete help, not a new question", () => {
  const p = plan("Bei Schichtarbeit fallen meine Pausen aus, abends esse ich irgendwas.",
    "Bitte nicht wieder Training empfehlen. Das ist nicht mein Problem.");
  assert.equal(p.action, "concrete_help");
  assert.equal(p.reason, "irregular_breaks");
  assert.equal(p.noNewQuestion, true);
  assert.equal(p.avoidTraining, true);
  const prompt = explainPeteTurnV4(p);
  assert.match(prompt, /konkreten|greifbaren/i);
  assert.match(prompt, /KEINE Workout-Empfehlung/);
  assert.match(prompt, /NULL Rueckfragen/);
});

test("Policy v4: never prescribe packed snacks twice if breaks are the issue", () => {
  const p = plan("Mein Essen habe ich schon vorbereitet und dabei, aber meine Pausen fallen aus.",
    "Training ist nicht mein Problem.");
  assert.equal(p.action, "concrete_help");
  assert.equal(p.alreadyHasPackedFood, true);
  assert.match(explainPeteTurnV4(p), /NICHT nochmal Essen mitnehmen/);
});

test("Policy v4: exhausted person should get a helpful response instead of a workout", () => {
  const p = plan("Ich bin Mama und abends komplett erledigt.",
    "Ich möchte nicht noch einen Pflichtplan.");
  assert.equal(p.action, "concrete_help");
  assert.equal(p.noNewQuestion, true);
});

test("Policy v4: explicit no-question boundary beats commercial interest", () => {
  const p = plan("Ich bin erschöpft und will keine weiteren Fragen.", "Bitte hör auf zu fragen.");
  assert.equal(p.action, "respect_boundary");
  assert.equal(p.noNewQuestion, true);
  assert.match(explainPeteTurnV4(p), /Keine Fragen/);
});

test("Policy v4: respect plain decline and do not pitch", () => {
  const p = plan("Ich schaue mich nur um, bitte kein Verkauf.");
  assert.equal(p.action, "acknowledge");
  assert.equal(p.noNewQuestion, true);
});

test("Policy v4: short context can be qualified with at most one question", () => {
  const p = plan("Stress.", "Arbeit, Kinder, Schlaf.");
  assert.equal(p.action, "clarify");
  assert.equal(p.noNewQuestion, false);
});

test("Policy v4: user content never enters system plan unquoted or verbatim", () => {
  const p = plan("Der geheimnisvolle Passcode ist XYZ-HIDDEN-773. Warum ist das anders?");
  const instructions = explainPeteTurnV4(p);
  assert.equal(p.action, "direct_answer");
  assert.doesNotMatch(instructions, /XYZ-HIDDEN-773|geheimnisvoll|Passcode/);
});

test("Policy v4: harmless skepticism alone cannot justify automatic handover", () => {
  const p = plan("Drei Coaches haben mich enttäuscht.",
    "Sag mir konkret, wie ihr den Elternalltag berücksichtigt.");
  assert.equal(p.action, "direct_answer");
  assert.match(explainPeteTurnV4(p), /skeptischer Einwand/);
});

test("Policy v4 prioritizes four proven business-case fixes", () => {
  const checks = [
    ["value_proposition", ["499 Euro ist teuer.", "Ich könnte es bezahlen, aber den Mehrwert sehe ich nicht."]],
    ["offer_scope", ["Ich muss darüber schlafen.", "Mir fehlt Klarheit, was ich konkret bekomme."]],
    ["coaching_entry", ["Ich will persönliche Begleitung statt PDF.", "Wie läuft der Einstieg bei euch ab?"]],
    ["practical_difference", ["Training läuft, beim Essen gibt es Abendstress.", "Was wäre bei euch anders als ein Ernährungsplan?"]],
  ] as const;
  for (const [expected, lead] of checks) {
    const result = plan(...lead);
    assert.equal(result.action, "direct_answer");
    assert.equal(result.reason, expected);
    assert.match(explainPeteTurnV4(result), /Antwort|Einstieg|Bei stressbedingtem Abendessen/);
  }
});

test("Policy v4 value and entry cases cannot silently become a fresh budget or sales quiz", () => {
  for (const latest of [
    "Ich könnte es bezahlen, aber den Mehrwert sehe ich nicht.",
    "Wie läuft der Einstieg bei euch ab?",
  ]) {
    const result = plan("Ich interessiere mich für Begleitung.", latest);
    assert.equal(result.noNewQuestion, true);
    assert.match(explainPeteTurnV4(result), /NULL Rueckfragen/);
  }
});
