import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pete-wc-verified-offers-"));
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { OFFER_TRUTH, VERIFIED_SMALL_SUPPORT } = await import("./offer-truth.js");
const { getPeteVerifiedTransactionAnswer } = await import("../core/pete-conversation-quality.js");
const { getPeteVerifiedSmallSupportAnswer } = await import("../core/pete-smaller-coaching-offers.js");

const state = { messages: [], flags: {} } as any;

test("verified WooCommerce ladder matches 3 published product prices and exact product links", () => {
  assert.equal(OFFER_TRUTH.selfstarter.priceEur, 14.95);
  assert.equal(VERIFIED_SMALL_SUPPORT.appStarter.upgradePriceEur, 84.05);
  assert.equal(VERIFIED_SMALL_SUPPORT.appStarter.totalWithSelfstarterEur, 99);
  assert.equal(VERIFIED_SMALL_SUPPORT.implementation.upgradePriceEur, 100);
  assert.equal(VERIFIED_SMALL_SUPPORT.implementation.totalWithSelfstarterEur, 199);
  assert.equal(14.95 + 84.05, 99);
  assert.equal(14.95 + 84.05 + 100, 199);
  assert.match(VERIFIED_SMALL_SUPPORT.appStarter.productUrl, /no-bullshit-elternfitness_app-starter/);
  assert.match(VERIFIED_SMALL_SUPPORT.implementation.productUrl, /umsetzung-upgrade/);
});

test("previously failed DM: lighter personal support has a precise, helpful response", () => {
  const text = "na schon was mit begleitung nur nicht so intensiv wie dass was du vorhin beschrieben hast";
  const reply = getPeteVerifiedTransactionAnswer(text, state)?.text ?? "";
  assert.match(reply, /99 €/);
  assert.match(reply, /199 €/);
  assert.match(reply, /84,05 €/);
  assert.match(reply, /100 €/);
  assert.match(reply, /45-Minuten-Coaching/);
  assert.match(reply, /3 Monate App/);
  assert.match(reply, /Chat-Support/);
  assert.match(reply, /no-bullshit-elternfitness-selbststarter/);
  assert.equal((reply.match(/\?/g) ?? []).length, 1);
  assert.doesNotMatch(reply, /2\.499|109,90|129 €|259 €|kostenlose Testphase|gekauft hast du bereits/);
});

test("explicit tryout without strategy call is offered the paid low-intensity route, not a free trial", () => {
  const result = getPeteVerifiedTransactionAnswer(
    "hast du was wo ich direkt testen kann ohne strategiegespräch?", state);
  assert.match(result?.text ?? "", /kostenlose Probephase ist nicht bestätigt/);
  assert.match(result?.text ?? "", /App-Starter-Upgrade/);
  assert.match(result?.text ?? "", /99 €/);
});

test("named App-Starter shows upgrade URL and distinguishes total from additional cost", () => {
  const reply = getPeteVerifiedSmallSupportAnswer(
    "Ich interessiere mich für den App-Starter, wie teuer ist das?", state) ?? "";
  assert.match(reply, /84,05 €.*99 € insgesamt/);
  assert.match(reply, /no-bullshit-elternfitness_app-starter/);
});

test("3-month bundle shows total, duration and no automatic renewal", () => {
  const reply = getPeteVerifiedTransactionAnswer(
    "Und die Umsetzung Upgrade für 3 Monate App und Coaching?", state)?.text ?? "";
  assert.match(reply, /100 €.*199 €/);
  assert.match(reply, /insgesamt 3 Monate App/);
  assert.match(reply, /zwei persönliche 45-Minuten-Coachings/);
  assert.match(reply, /endet nach 3 Monaten automatisch/);
  assert.match(reply, /produkt\/umsetzung-upgrade/);
});

test("App renewal is optional, separate, with 14 days notice", () => {
  const reply = getPeteVerifiedTransactionAnswer(
    "Was kostet die App nach einem Monat, wenn ich sie weiter nutzen will?", state)?.text ?? "";
  assert.match(reply, /19,95 € pro Monat/);
  assert.match(reply, /separat eingerichtet/);
  assert.match(reply, /14 Tage/);
});

test("question stop, billing dispute and explicit sales refusal preserve safety", () => {
  const stoppedState = { messages: [
    { role: "user", text: "Bitte keine weiteren Fragen mehr." },
  ] } as any;
  const reply = getPeteVerifiedSmallSupportAnswer(
    "Ich will etwas weniger intensive Begleitung", stoppedState) ?? "";
  assert.equal((reply.match(/\?/g) ?? []).length, 0);
  assert.equal(getPeteVerifiedSmallSupportAnswer("STOP - ich will keine Begleitung", state), null);
  assert.equal(getPeteVerifiedSmallSupportAnswer(
    "Mein App-Starter wurde doppelt abgebucht, ich will das klären", state), null);
  assert.equal(getPeteVerifiedSmallSupportAnswer(
    "Ich will kein Coaching, nur den kostenlosen Keto Guide", state), null);
  const noOffer = getPeteVerifiedTransactionAnswer(
    "Ich will bitte keine Kaufangebote. Nur den Keto Guide.", state)?.text ?? "";
  assert.doesNotMatch(noOffer, /99 €|199 €|App-Starter/);
});

test("the five-week coaching remains separate and its purchase path is unchanged", () => {
  const result = getPeteVerifiedTransactionAnswer(
    "Was beinhaltet das 5-Wochen-Coaching für 499 Euro?", state)?.text ?? "";
  assert.match(result, /499 €/);
  assert.doesNotMatch(result, /(?:^|[^\d])(?:99|199) €|App-Starter/);
});

test("real conversation engine routes the smaller support reply without any provider call", async () => {
  const { processIncomingMessage } = await import("../core/conversation-engine.js");
  const originalFetch = globalThis.fetch;
  let external = 0;
  globalThis.fetch = async () => { external++; throw new Error("NO_PROVIDER_REQUEST_ALLOWED"); };
  try {
    const r = await processIncomingMessage({
      leadId: "synthetic-small-support-engine",
      campaignId: "eltern-vital-fit",
      messageText: "na schon was mit begleitung nur nicht so intensiv wie dass was du vorhin beschrieben hast",
      conversationMode: "natural",
    });
    assert.equal(r.state.answers.peteReplySource, "verified_transaction");
    assert.match(r.text ?? "", /99 €/);
    assert.match(r.text ?? "", /199 €/);
    assert.equal(external, 0);
    assert.equal(r.state.flags.stopped, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buying signal: first one month and later three months gives the first checkout link, not a question", () => {
  const reply = getPeteVerifiedTransactionAnswer(
    "kann ich erst ein monat testen und dann erweitern auf 3 monate?", state)?.text ?? "";
  assert.match(reply, /^Ja, du kannst klein starten/);
  assert.ok(reply.includes(OFFER_TRUTH.selfstarter.productUrl));
  assert.match(reply, /14,95 €.*84,05 €.*99 €.*100 €.*199 €/);
  assert.match(reply, /1 Monat App.*45-Minuten-Coaching/);
  assert.match(reply, /3 Monate App.*2 Coachings/);
  assert.equal((reply.match(/\?/g) ?? []).length, 0);
  assert.doesNotMatch(reply, /bereits gekauft|bereits gebucht|kostenlose[r]? Probephase/);
});

test("clear purchase question after a smaller-support discussion gives the starter link immediately", () => {
  const context = { ...state, messages: [
    { role: "user", text: "bischen persönliche betreuung, aber nicht so intensiv, ich brauche Hilfe" },
    { role: "assistant", text: "Es gibt 1 Monat App mit Coaching oder insgesamt 3 Monate mit Chat-Support." },
  ] } as any;
  const reply = getPeteVerifiedTransactionAnswer(
    "klingt gut, wie kann ich das buchen", context)?.text ?? "";
  assert.ok(reply.includes(OFFER_TRUTH.selfstarter.productUrl));
  assert.match(reply, /99 €/);
  assert.equal((reply.match(/\?/g) ?? []).length, 0);
});

test("purchase-interest intent cannot override STOP or refund problems", () => {
  assert.equal(getPeteVerifiedSmallSupportAnswer(
    "STOP. Kann ich erst ein Monat testen und dann auf 3 Monate erweitern?", state), null);
  assert.equal(getPeteVerifiedSmallSupportAnswer(
    "Mein App-Starter ist doppelt abgebucht. Kann ich auf 3 Monate erweitern?", state), null);
  const refused = getPeteVerifiedTransactionAnswer(
    "Nein, ich will keine Begleitung, kann ich trotzdem den kostenlosen Check bekommen?", state)?.text ?? "";
  assert.doesNotMatch(refused, /14,95 €|99 €|199 €|app-starter/);
});

test("full conversation engine preserves staged-upgrade checkout CTA without paid LLM usage", async () => {
  const { processIncomingMessage } = await import("../core/conversation-engine.js");
  const oldFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error("NETWORK_DISABLED_IN_SYNTHETIC_TEST"); };
  try {
    const response = await processIncomingMessage({
      leadId: "staged-app-upgrade-buying-intent",
      campaignId: "eltern-vital-fit",
      messageText: "kann ich erst ein monat testen und dann erweitern auf 3 monate?",
      conversationMode: "natural",
    });
    assert.equal(response.state.answers.peteReplySource, "verified_transaction");
    assert.ok(response.text?.includes(OFFER_TRUTH.selfstarter.productUrl));
    assert.match(response.text ?? "", /99 €.*199 €/);
    assert.equal(providerCalls, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test("exact free-form parent message recognizes smaller coaching, not only DIY or 499 coaching", () => {
  const actual = "mmh bischen persönliche betreuung berauch ich schon sonst zieh ich das nicht durch, gibt es da was ohne gleich ein riesen coaching zu buchen?";
  const reply = getPeteVerifiedTransactionAnswer(actual, state)?.text ?? "";
  assert.match(reply, /99 €/);
  assert.match(reply, /199 €/);
  assert.ok(reply.includes(OFFER_TRUTH.selfstarter.productUrl));
});

test("exact owner dialogue 'klingt gut, wie kann ich das buchen' sends checkout first", () => {
  const context = { ...state, messages: [
    { role: "user", text: "mmh bischen persönliche betreuung berauch ich schon sonst zieh ich das nicht durch, gibt es da was ohne gleich ein riesen coaching zu buchen?" },
    { role: "assistant", text: "Ja, es gibt eine kleinere Begleitung: 1 Monat App mit einem Coaching oder 3 Monate mit zwei Coachings." },
  ] } as any;
  const reply = getPeteVerifiedTransactionAnswer("klingt gut, wie kann ich das buchen", context)?.text ?? "";
  assert.ok(reply.includes(OFFER_TRUTH.selfstarter.productUrl));
  assert.match(reply, /99 €.*199 €/);
  assert.equal((reply.match(/\?/g) ?? []).length, 0);
});
