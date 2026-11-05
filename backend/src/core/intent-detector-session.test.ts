import assert from "node:assert/strict";
import test from "node:test";
import {
  isIntroAckAccepted,
  isPostDoneThanks,
  isPauseRequest,
  isSimpleAcknowledgement,
  isStrongCoachingEntryBuySignal,
} from "./intent-detector.js";

test("extracted legacy acknowledgement, thanks and pause detectors remain behavior-identical", async t => {
  for (const [message, expected] of [
    ["ja", true], ["  LEG LOS  ", true],
    ["Nein", false], ["", false],
    ["okay", true], ["Ich möchte weiter", true],
  ] as const) {
    await t.test("intro: " + JSON.stringify(message), () =>
      assert.equal(isIntroAckAccepted(message), expected));
  }
  for (const [message, expected] of [
    ["Danke", true], ["Super danke", true], ["vielen dank", true],
    ["Hallo", false], ["", false],
  ] as const) {
    await t.test("thanks: " + JSON.stringify(message), () =>
      assert.equal(isPostDoneThanks(message), expected));
  }
  for (const [message, expected] of [
    ["Ich muss jetzt los", true], ["Ich melde mich später", true],
    ["Bin gerade unterwegs", true], ["Heute geht es", false], ["", false],
  ] as const) {
    await t.test("pause: " + JSON.stringify(message), () =>
      assert.equal(isPauseRequest(message), expected));
  }
});

test("legacy simple acknowledgements and strong-entry buy signals retain original matching", async t => {
  for (const [text, expected] of [
    ["ok", true], ["OKAY", true], ["Alles klar", true],
    ["Alles verstanden", true], ["super", true], ["nein", false],
    ["", false], ["ich moechte nur schauen", false],
  ] as const) {
    await t.test("ack " + JSON.stringify(text), () =>
      assert.equal(isSimpleAcknowledgement(text), expected));
  }
  for (const [text, expected] of [
    ["gekauft", true], ["Kauf ich direkt", true],
    ["Ich will starten", true], ["Schick mir den Link", true],
    ["Wo kann ich bezahlen", false],
    ["Ich muss erst überlegen", false], ["", false],
  ] as const) {
    await t.test("buy " + JSON.stringify(text), () =>
      assert.equal(isStrongCoachingEntryBuySignal(text), expected));
  }
});
