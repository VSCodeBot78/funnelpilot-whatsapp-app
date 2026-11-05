import assert from "node:assert/strict";
import test from "node:test";
import {
  isIntroAckAccepted,
  isPostDoneThanks,
  isPauseRequest,
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
