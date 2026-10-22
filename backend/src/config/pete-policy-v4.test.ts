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

test("Policy v4.3: no unpaid shift nutrition plan, qualify the parent-day instead", () => {
  const p = plan("Bei Schichtarbeit fallen meine Pausen aus, abends esse ich irgendwas.",
    "Bitte nicht wieder Training empfehlen. Das ist nicht mein Problem.");
  assert.equal(p.action, "clarify");
  assert.equal(p.reason, "shift_day_discovery");
  assert.equal(p.noNewQuestion, false);
  assert.equal(p.avoidTraining, true);
  const prompt = explainPeteTurnV4(p);
  assert.match(prompt, /SETTER-FOKUS SCHICHT/);
  assert.match(prompt, /nach der Schicht/);
  assert.match(prompt, /KEINE Workout-Empfehlung/);
  assert.match(prompt, /Maximal EINE/);
  assert.doesNotMatch(prompt, /transportable Essensidee|Snackliste/);
});

test("Policy v4: never prescribe packed snacks twice if breaks are the issue", () => {
  const p = plan("Mein Essen habe ich schon vorbereitet und dabei, aber meine Pausen fallen aus.",
    "Training ist nicht mein Problem.");
  assert.equal(p.action, "clarify");
  assert.equal(p.reason, "shift_day_discovery");
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
    assert.match(explainPeteTurnV4(result), /Antwort|Einstieg|Bei stressbedingtem Abendessen/i);
  }
});

test("Policy v4.3: value stays direct, coaching entry may clarify once and set a call", () => {
  const value = plan("Ich interessiere mich für Begleitung.",
    "Ich könnte es bezahlen, aber den Mehrwert sehe ich nicht.");
  assert.equal(value.reason, "value_proposition");
  assert.equal(value.noNewQuestion, true);
  const entry = plan("Ich interessiere mich für Begleitung.",
    "Wie läuft der Einstieg bei euch ab?");
  assert.equal(entry.reason, "coaching_entry");
  assert.equal(entry.noNewQuestion, false);
  assert.match(explainPeteTurnV4(entry), /Telefonat/);
  assert.match(explainPeteTurnV4(entry), /Pflicht/);
});

test("Policy v4.3: concrete scope requires factual answer plus non-guaranteed customer goal", () => {
  const p = plan("Ich bin interessiert, aber ich muss darüber schlafen.",
    "Was bekomme ich konkret?");
  assert.equal(p.reason, "offer_scope");
  assert.equal(p.noNewQuestion, false);
  assert.match(explainPeteTurnV4(p), /ZIELBILD/);
  assert.match(explainPeteTurnV4(p), /sechs Monaten/);
  assert.match(explainPeteTurnV4(p), /NICHT als Garantie/);
});

test("Policy v4.3: shift discovery never overrides explicit no-question boundary", () => {
  const p = plan("Bei Schichtarbeit fallen meine Pausen aus.",
    "Ich will dazu jetzt keine Fragen mehr.");
  assert.equal(p.action, "respect_boundary");
  assert.equal(p.noNewQuestion, true);
});

// Owner 22.10.: uncommon lost-link phrasings are observed later in controlled
// pilot traffic, not a current private QA gate. Direct purchase remains P0.
test("Policy v4.4: latest checkout and repeat-link request override older shift discovery", () => {
  const shift = "Ich arbeite Schicht und meine Pausen fallen aus. Mein Essen ist schon vorbereitet.";
  for (const [latest, noNewQuestion] of [
    ["Ich will direkt kaufen.", false],
    ["Ich möchte den Selbststarter direkt kaufen.", true],
    ["Schick mir bitte den Link nochmal, ich finde ihn nicht mehr.", true],
  ] as const) {
    const decision = plan(shift, latest);
    assert.equal(decision.action, "offer_navigation", latest);
    assert.equal(decision.reason, "explicit_purchase_or_link", latest);
    assert.equal(decision.noNewQuestion, noNewQuestion, latest);
  }
  assert.equal(plan(shift, "Ich möchte keinen Link und nichts kaufen.").reason, "shift_day_discovery");
  assert.equal(plan(shift, "Ich will dazu keine Fragen mehr.").action, "respect_boundary");
});

test("Verified transaction: repeat only the last previously sent approved checkout link", async () => {
  const { getPeteVerifiedTransactionAnswer } = await import("../core/pete-conversation-quality.js");
  const { OFFER_TRUTH } = await import("../config/offer-truth.js");
  const repeat = "Schick mir bitte den Link nochmal, ich finde ihn nicht mehr.";
  const check = (link: string, message = repeat) => getPeteVerifiedTransactionAnswer(message, {
    messages: [
      { role: "user", text: "Ich interessiere mich für den Einstieg." },
      { role: "assistant", text: "Hier ist der Link: " + link },
      { role: "user", text: message },
    ],
  } as any);
  assert.match(check(OFFER_TRUTH.selfstarter.productUrl)?.text ?? "", /selbststarter/i);
  assert.ok(check(OFFER_TRUTH.selfstarter.productUrl)?.text.includes(OFFER_TRUTH.selfstarter.productUrl));
  assert.ok(check(OFFER_TRUTH.coachingEntry.checkoutUrl)?.text.includes(OFFER_TRUTH.coachingEntry.checkoutUrl));
  assert.equal(check(OFFER_TRUTH.coachingEntry.checkoutUrl)?.text.includes(OFFER_TRUTH.selfstarter.productUrl), false);
  assert.equal(check("https://unverified.example/checkout"), null);
  assert.equal(check(OFFER_TRUTH.selfstarter.productUrl, "Schick mir den Link nicht nochmal."), null);
  assert.equal(check(OFFER_TRUTH.coachingEntry.checkoutUrl, "Schick mir den Selbststarter-Link nochmal."), null);
});

test("Verified five-week buyer gets checkout directly without forced strategy call", async () => {
  const { getPeteVerifiedTransactionAnswer } = await import("../core/pete-conversation-quality.js");
  const { OFFER_TRUTH } = await import("../config/offer-truth.js");
  const answer = (text: string) => getPeteVerifiedTransactionAnswer(text,
    { messages: [{ role: "user", text }] } as any);
  for (const lead of [
    "Ich möchte die 5-Wochen-Startphase direkt kaufen.",
    "Wo kann ich das 5-Wochen-Coaching kaufen?",
    "Schick mir den Kauf-Link zur 5-Wochen-Begleitung.",
    "Mein Mann ist einverstanden, ich will die 5-Wochen-Startphase kaufen.",
  ]) {
    const result = answer(lead);
    assert.ok(result?.text.includes(OFFER_TRUTH.coachingEntry.checkoutUrl), lead);
    assert.doesNotMatch(result?.text ?? "", /Pflichttermin|Pflichtcall|zuerst ein Gespräch/i);
  }
  for (const lead of [
    "Ich überlege, die 5-Wochen-Startphase zu kaufen.",
    "Ich möchte die 5-Wochen-Startphase nicht kaufen.",
    "Ich möchte das 6-Monats-Coaching kaufen.",
    "Ich möchte das Coaching kaufen.",
    "Ich möchte die 5-Wochen-Startphase kaufen, aber kann sie mir nicht leisten.",
    "Ich möchte die 5-Wochen-Startphase kaufen, aber das Geld reicht nicht.",
    "Ich möchte die 5-Wochen-Startphase kaufen, aber ich muss erst meine Frau fragen.",
    "Ich möchte die 5-Wochen-Startphase kaufen, aber erst mit meinem Mann besprechen.",
    "Ich möchte die 5-Wochen-Startphase kaufen, aber ich muss noch drüber schlafen.",
    "Ich möchte die 5-Wochen-Startphase kaufen, ohne meine Frau zu fragen.",
  ]) {
    const result = answer(lead);
    assert.equal(result?.text.includes(OFFER_TRUTH.coachingEntry.checkoutUrl) ?? false, false, lead);
  }
});

// The current lead explicitly says training is not the bottleneck. The next
// step is a single contextual question, never an unsolicited full workout plan.
test("Policy v4.3: packed food and known training should trigger contextual setting", () => {
  const p = plan("Ich trainiere drei Mal pro Woche und mein Essen ist schon dabei, aber die Pausen fallen aus.",
    "Ich brauche keine weiteren Trainingspläne.");
  assert.equal(p.action, "clarify");
  assert.equal(p.reason, "shift_day_discovery");
  assert.equal(p.alreadyHasPackedFood, true);
  assert.match(explainPeteTurnV4(p), /NICHT nochmal Essen mitnehmen/);
});


test("Founder-verified 5-week services are explained without inventing a guarantee", async () => {
  const { getPeteVerifiedTransactionAnswer } = await import("../core/pete-conversation-quality.js");
  const { OFFER_TRUTH } = await import("../config/offer-truth.js");
  const answer = (text: string) => getPeteVerifiedTransactionAnswer(text,
    { messages: [{ role: "user", text }] } as any)?.text ?? "";
  for (const question of [
    "Was bekomme ich konkret in der 5-Wochen-Startphase für 499 €?",
    "Was ist in der 5-Wochen-Startphase alles enthalten?",
    "Welche Leistungen bekomme ich für 499 Euro?",
  ]) {
    const reply = answer(question);
    assert.match(reply, /499 €/);
    assert.match(reply, /wöchentlich 45 Minuten 1:1-Coaching per Zoom/i);
    assert.match(reply, /Chat-Support/i);
    assert.match(reply, /Power Walk & Call/i);
    assert.match(reply, /nicht garantiert/i);
    assert.doesNotMatch(reply, /unbekannt|nicht hinterlegt/i);
  }
  const calls = answer("Wie viele Videoanrufe pro Woche sind in der 5-Wochen-Startphase enthalten?");
  assert.match(calls, /wöchentlich 45 Minuten 1:1-Coaching per Zoom/i);
  assert.match(calls, /einmal pro Woche den Power Walk & Call/i);
  assert.doesNotMatch(calls, /nicht hinterlegt/i);
  const zoom = answer("Wie oft Zoom-Call pro Woche in der Startphase?");
  assert.match(zoom, /wöchentlich 45 Minuten/i);
  const time = answer("Wie viel Zeit muss ich für die 5-Wochen-Startphase einplanen?");
  assert.match(time, /wöchentlich 45 Minuten/i);
  assert.match(time, /Gesamtzeitaufwand.*nicht verbindlich/i);
  assert.doesNotMatch(answer("Was bekomme ich beim Selbststarter?"), /45 Minuten 1:1-Coaching/);
  assert.doesNotMatch(answer("Was kostet die 6-Monats-Begleitung?"), /45 Minuten 1:1-Coaching/);
  assert.equal(OFFER_TRUTH.coachingEntry.startSelectableWithinDays, 14);
  assert.equal(OFFER_TRUTH.coachingEntry.includedServices.length, 5);
});


test("Verified multi-turn founder service boundary regression", async () => {
  const { getPeteVerifiedTransactionAnswer } = await import("../core/pete-conversation-quality.js");
  const reply = (previous: string, current: string) =>
    getPeteVerifiedTransactionAnswer(current, {
      messages: [{ role: "user", text: previous }, { role: "user", text: current }],
    } as any)?.text ?? "";

  const zoom = reply("Mich interessiert die persönliche Startphase.",
    "Wie oft telefoniere ich mit dir über Zoom und ist ein Walk-Call dabei?");
  assert.match(zoom, /wöchentlich 45 Minuten 1:1-Coaching/i);
  assert.match(zoom, /Power Walk & Call/i);
  assert.doesNotMatch(zoom, /insgesamt fünf|genau fünf/i);

  const starter = reply("Vielleicht reicht mir der Selbststarter.",
    "Sind da die persönlichen Zoom-Termine auch enthalten?");
  assert.match(starter, /nicht im Selbststarter/i);
  assert.match(starter, /persönlichen 5-Wochen-Startphase/i);

  const start = reply("Ich interessiere mich für die 499-Euro-Begleitung.",
    "Kann ich garantiert morgen anfangen?");
  assert.match(start, /innerhalb von 14 Tagen wählen/i);
  assert.match(start, /morgen kann ich dir hier nicht garantieren/i);

  const credit = reply("Nach den fünf Wochen könnte ich sechs Monate weitermachen.",
    "Werden die 499 Euro dann garantiert komplett angerechnet?");
  assert.match(credit, /verbindlichen Upgrade- und Anrechnungsbedingungen/i);
  assert.doesNotMatch(credit, /werden garantiert|vollständig gutgeschrieben/i);
});
