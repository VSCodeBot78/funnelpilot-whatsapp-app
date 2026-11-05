import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// A synthetic local-only store; this test must not inherit the owner's data.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-guard-integration-"));
Object.assign(process.env, {
  DATA_DIR: dir, NODE_ENV: "test",
  INSTAGRAM_SEND_ENABLED: "false", WHATSAPP_SEND_ENABLED: "false",
  PETE_LLM_CONVERSATION_ENABLED: "false", PETE_LLM_API_CALLS_APPROVED: "false",
  OPENAI_API_KEY: "",
});
const { getPeteGuardedNextStep } = await import("../core/pete-conversation-quality.js");
const { guardPeteNextStep, proposePeteNextStep } = await import("../core/pete-semantic-action-guard.js");
const { getOrCreateConversationState, appendUserMessage, persistConversationState, takeOverByHuman } =
  await import("../core/state-manager.js");
const { OFFER_TRUTH } = await import("./offer-truth.js");
const bookingUrl = "https://calendly.com/eltern-fitundvital/strategiegespraech";
const ctx = (text: string, extra: Record<string, unknown> = {}) => ({
  lastUserText: text, owner: "ai" as const, bookingUrl,
  offerInfoUrl: OFFER_TRUTH.coachingEntry.infoUrl,
  bookingHosts: ["calendly.com"], offerInfoHosts: ["jochen-kammerer.de"], ...extra,
});
const lead = (id: string, message: string) => {
  const state = getOrCreateConversationState(id, "eltern-vital-fit");
  appendUserMessage(state, message);
  persistConversationState(state);
  return state;
};
test("integrated semantic next-step guard never grants send or booking authority", async t => {
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await t.test("explicit booking request yields verified link but not confirmed booking", () => {
    const text = "Ich möchte jetzt einen Termin buchen. Wo finde ich den Kalender?";
    const out = getPeteGuardedNextStep(text, lead("next-step-active", text), bookingUrl);
    assert.equal(out?.nextStep, "booking");
    assert.equal(out?.nextPhase, "booking_offered");
    assert.equal(out?.outboundAuthorized, false);
    assert.match(out!.text, /erst nach der Buchungsbestätigung/);
  });
  await t.test("passive calendar browsing never creates booking follow-up state", () => {
    const text = "Bitte schick mir den Buchungslink zum Anschauen, nicht zum Buchen.";
    const out = getPeteGuardedNextStep(text, lead("next-step-passive", text), bookingUrl);
    assert.equal(out?.nextStep, "booking");
    assert.equal(out?.nextPhase, undefined);
    assert.equal(out?.outboundAuthorized, false);
  });
  await t.test("incidental, cancelled and declined appointments cannot authorize a booking", () => {
    for (const [i, text] of [
      "Wo ist mein Kinderarzttermin?",
      "Ich will keinen Termin mit Jochen.",
      "Bitte nimm meinen bestehenden Termin zurück.",
      "Wo wäre der Buchungslink? Nur theoretisch, bitte nicht zuschicken.",
    ].entries()) {
      const state = lead("next-step-denied-" + i, text);
      assert.equal(getPeteGuardedNextStep(text, state, bookingUrl)?.nextStep === "booking", false, text);
    }
  });
  await t.test("model evidence must be an exact quote of the latest actual lead turn", () => {
    const text = "Bitte schick mir den Buchungslink.";
    const proposal = { nextStep: "booking" as const, evidenceQuote: "Vorheriger Terminwunsch" };
    assert.equal(guardPeteNextStep(proposal, ctx(text)), null);
    assert.equal(guardPeteNextStep({ nextStep: "booking", evidenceQuote: text }, ctx(text, { owner: "human" })), null);
    assert.equal(guardPeteNextStep({ nextStep: "booking", evidenceQuote: text }, ctx(text, { stopped: true })), null);
    assert.equal(guardPeteNextStep({ nextStep: "booking", evidenceQuote: text }, ctx(text, { aiPaused: true })), null);
  });
  await t.test("no untrusted URLs or foreign destinations can become booking links", () => {
    const text = "Bitte schick mir den Buchungslink.";
    const proposal = proposePeteNextStep(text);
    for (const unsafe of ["http://calendly.com/test", "https://calendly.com.evil.test/book",
      "https://calendly.com@evil.test/book", "javascript:alert(1)"]) {
      assert.equal(guardPeteNextStep(proposal, ctx(text, { bookingUrl: unsafe })), null);
    }
  });
  await t.test("actual persisted STOP or human ownership blocks a new action", () => {
    const text = "Bitte schick mir den Buchungslink.";
    const stopped = lead("next-step-stopped", text);
    stopped.flags.stopped = true;
    persistConversationState(stopped);
    assert.equal(getPeteGuardedNextStep(text, stopped, bookingUrl), null);
    const human = lead("next-step-human", text);
    takeOverByHuman(human);
    persistConversationState(human);
    assert.equal(getPeteGuardedNextStep(text, human, bookingUrl), null);
  });
  await t.test("requested offer information remains non-sending", () => {
    const text = "Kannst du mir bitte die Methode zum Nachlesen zeigen?";
    const result = getPeteGuardedNextStep(text, lead("next-step-info", text), bookingUrl);
    assert.equal(result?.nextStep, "offer_info");
    assert.equal(result?.outboundAuthorized, false);
    assert.match(result!.text, /https:\/\//);
  });
});
