import assert from "node:assert/strict";
import test from "node:test";
import { OFFER_TRUTH } from "./offer-truth.js";
import {
  getPeteStrategyCallFollowUp,
  getPeteVerifiedBookingFeeRepair,
} from "../core/pete-strategy-call-followup.js";
import { validatePeteLlmReply } from "../core/pete-llm-conversation.js";

const invitation = "Wäre ein Strategiegespräch mit Jochen passend? Möchtest du einen Termin buchen?";
const makeState = (lastReply: string, replySource = "verified_transaction") => ({
  leadId: "synthetic-cost-continuity",
  campaignId: "eltern-vital-fit",
  owner: "ai",
  aiPaused: false,
  flags: {},
  answers: { peteReplySource: replySource },
  messages: [
    { role: "assistant", text: invitation },
    { role: "user", text: "klar, kostet das was?" },
    { role: "assistant", text: lastReply },
    { role: "user", text: "hallo???" },
  ],
}) as any;

test("Original PL28 replay: verified booking-payment fact takes precedence over later model uncertainty", () => {
  const initial = {
    flags: {},
    messages: [{ role: "assistant", text: invitation }],
  } as any;
  const verified = getPeteStrategyCallFollowUp(
    "klar, kostet das was?", initial, OFFER_TRUTH.strategyCall.schedulingUrl,
  );
  assert.ok(verified);
  assert.match(verified.text, /Terminbuchung kostet nichts/i);
  const state = makeState(verified.text);
  const originalModelReply =
    "Ob für das Strategiegespräch Kosten anfallen, ist hier nicht verlässlich bestätigt.";
  assert.ok(validatePeteLlmReply({ reply: originalModelReply, needsHuman: false }));
  const replacement = getPeteVerifiedBookingFeeRepair(state, originalModelReply);
  assert.match(replacement ?? "", /Terminbuchung.*keine Zahlung nötig/);
  assert.doesNotMatch(replacement ?? "", /Gespräch ist kostenlos|Coaching ist kostenlos/);
  assert.doesNotMatch(replacement ?? "", /https?:/);
});

test("Contradictory booking-cost speculation is rejected regardless of lead's latest wording", () => {
  const s = makeState("Klar. Die Terminbuchung kostet nichts und ist noch keine Coaching-Buchung.");
  const variants = [
    "Ob der Termin Kosten verursacht, ist leider unklar.",
    "Die Kosten für das Strategiegespräch sind hier nicht sicher bestätigt.",
    "Vielleicht ist die Terminbuchung kostenpflichtig.",
    "Ob für das Gespräch eine Gebühr anfällt, ist unbekannt.",
    "Ob die Buchung Geld kostet, kann ich nicht bestätigen.",
  ];
  for (const candidate of variants) {
    const result = getPeteVerifiedBookingFeeRepair(s, candidate);
    assert.ok(result, candidate);
    assert.match(result, /keine Zahlung nötig/, candidate);
  }
});

test("Valid uncertainty about a different product and harmless contextual replies are preserved", () => {
  const state = makeState("Klar. Die Terminbuchung kostet nichts und ist noch keine Coaching-Buchung.");
  for (const candidate of [
    "Ja, ich bin da. Hast du noch eine konkrete Frage?",
    "Ob beim kostenpflichtigen Coaching Extras anfallen, kann nur Jochen klären.",
    "Die Terminbuchung kostet nichts, beim 5-Wochen-Coaching gelten separate Konditionen.",
    "Ob ein Termin verfügbar ist, kann ich nicht prüfen.",
  ]) assert.equal(getPeteVerifiedBookingFeeRepair(state, candidate), null, candidate);
});

test("No verified assistant provenance or booking payment fact means no invented correction", () => {
  const generated = "Ob die Terminbuchung kostet, ist nicht sicher bestätigt.";
  assert.equal(getPeteVerifiedBookingFeeRepair(makeState("Die Terminbuchung kostet nichts.", "llm"), generated), null);
  assert.equal(getPeteVerifiedBookingFeeRepair(makeState("Der Termin ist noch nicht gebucht."), generated), null);
  assert.equal(getPeteVerifiedBookingFeeRepair({
    ...makeState("Klar. Die Terminbuchung kostet nichts."),
    messages: [{ role: "user", text: "Ich glaube der Termin ist kostenlos" }, { role: "user", text: "hallo?" }],
  } as any, generated), null);
});
