import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationState } from "../types/types.js";
import {
  buildDoneReply, buildPauseReply, buildResumeReply,
  buildPlayfulNameReply, buildMultiplePeopleReply,
  buildLowScoreReply, buildAvailabilitySuggestionReply,
  buildBookingGuardReply, buildCoachingEntryDirectBuyLeadReply,
  buildProviderBookingPendingReply, buildProviderBookingSimpleAckReply,
} from "./response-builder.js";

const campaign = "eltern-vital-fit";
test("extracted response builders keep their legacy texts and branches", async t => {
  await t.test("done with and without an appointment reference", () => {
    assert.equal(buildDoneReply({ answers: {} } as ConversationState), "Sehr gern 👍");
    assert.equal(buildDoneReply({ answers: { pendingBookingText: "Freitag um 19 Uhr" } } as ConversationState),
      "Sehr gern 👍 Dann bis Freitag um 19 Uhr.");
  });
  await t.test("pause and resume preserve line breaks and supplied question", () => {
    assert.match(buildPauseReply(), /Melde dich einfach wieder/);
    assert.equal(buildResumeReply("Wie sieht dein Alltag aus?"),
      "Willkommen zurück 😊\nWir waren gerade hier:\nWie sieht dein Alltag aus?");
  });
  await t.test("name and multiple-people replies stay unchanged", () => {
    assert.match(buildPlayfulNameReply(), /Nobody/);
    assert.match(buildMultiplePeopleReply(), /WhatsApp Nummer/);
  });
  await t.test("both low-score branches contain the same trusted info fallback", () => {
    const low = buildLowScoreReply(campaign, 5);
    const warm = buildLowScoreReply(campaign, 6);
    assert.match(low, /wenig Sinn/);
    assert.match(warm, /noch nicht so klar/);
    assert.match(low, /Infos/);
    assert.match(warm, /Infos/);
  });
  await t.test("availability offers at most 3 real suggestions; none invents a slot", () => {
    assert.match(buildAvailabilitySuggestionReply([]), /keinen freien Termin/);
    const text = buildAvailabilitySuggestionReply(
      ["Freitag 19 Uhr", "Samstag 10 Uhr", "Samstag 11 Uhr", "Sonntag 8 Uhr"]
        .map(label => ({ label })));
    assert.match(text, /Freitag 19 Uhr/);
    assert.match(text, /Samstag 11 Uhr/);
    assert.doesNotMatch(text, /Sonntag 8 Uhr/);
  });
  await t.test("booking guard only asks for courtesy confirmation", () => {
    assert.match(buildBookingGuardReply("Freitag, 19 Uhr"), /blocke ich dir Freitag, 19 Uhr/);
    assert.match(buildBookingGuardReply("Freitag, 19 Uhr"), /rechtzeitig Bescheid/);
  });
  await t.test("direct-buy handoff keeps the existing campaign reply", () => {
    assert.match(buildCoachingEntryDirectBuyLeadReply(campaign), /Danke für dein Vertrauen/);
  });
  await t.test("provider pending and acknowledgement contain no confirmation", () => {
    const pending = buildProviderBookingPendingReply();
    const ack = buildProviderBookingSimpleAckReply();
    assert.match(pending, /final eingetragen/);
    assert.match(ack, /final ein/);
    assert.doesNotMatch(pending + ack, /(?:Termin|Buchung) ist bestätigt/i);
  });
});
