import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationState } from "../types/types.js";
import {
  getPendingAiFollowUpQuestion, getPendingAiReturnStep,
  getPendingAiSource, resetPriceFlowState,
  getStoredAnswerString, getStoredAnswerNumber,
} from "./state-manager.js";

const stateWith = (answers: Record<string, unknown>): ConversationState =>
  ({ answers: { ...answers }, updatedAt: "2020-01-01T00:00:00.000Z",
    flags: { stopped: true }, owner: "human" } as unknown as ConversationState);

test("extracted pending-AI selectors retain exact legacy trim and missing-value behavior", async t => {
  for (const [key, fn] of [
    ["pendingAiFollowUpQuestion", getPendingAiFollowUpQuestion],
    ["pendingAiReturnStep", getPendingAiReturnStep],
    ["pendingAiSource", getPendingAiSource],
  ] as const) {
    await t.test(key + " trims a nonempty string", () => {
      assert.equal(fn(stateWith({ [key]: "  booking  " })), "booking");
    });
    await t.test(key + " treats blank or nonstring values as absent", () => {
      for (const value of [undefined, null, "", "   ", 42, false]) {
        assert.equal(fn(stateWith({ [key]: value })), undefined);
      }
    });
  }
  await t.test("price-flow reset clears only existing seven price fields", () => {
    const s = stateWith({
      priceObjectionOpen: true, priceObjectionCategory: "price",
      priceObjectionFollowUpText: "text", priceObjectionExecutionDetail: "time",
      priceObjectionExecutionText: "detail", priceExecutionChoice: "a",
      priceExecutionBinaryChoice: "b", pendingAiSource: "provider",
      name: "Synthetic Test",
    });
    resetPriceFlowState(s);
    for (const key of [
      "priceObjectionOpen", "priceObjectionCategory", "priceObjectionFollowUpText",
      "priceObjectionExecutionDetail", "priceObjectionExecutionText",
      "priceExecutionChoice", "priceExecutionBinaryChoice",
    ]) assert.equal((s.answers as Record<string, unknown>)[key], undefined, key);
    assert.equal(s.answers.pendingAiSource, "provider");
    assert.equal(s.answers.name, "Synthetic Test");
    assert.equal(s.owner, "human");
    assert.equal(s.flags.stopped, true);
    assert.notEqual(s.updatedAt, "2020-01-01T00:00:00.000Z");
  });
});

test("stored answer selectors preserve trimmed-string and number-only access", async t => {
  const s = stateWith({
    name: "  Alex  ", score: 7, empty: "   ",
    numericText: "42", boolFlag: true, zero: 0, nan: Number.NaN,
  });
  await t.test("trim string without changing saved state", () => {
    assert.equal(getStoredAnswerString(s, "name"), "Alex");
    assert.equal(s.answers.name, "  Alex  ");
    assert.equal(getStoredAnswerString(s, "empty"), undefined);
    assert.equal(getStoredAnswerString(s, "score"), undefined);
    assert.equal(getStoredAnswerString(s, "missing"), undefined);
  });
  await t.test("number includes zero and prior NaN behavior, but not numeric strings", () => {
    assert.equal(getStoredAnswerNumber(s, "score"), 7);
    assert.equal(getStoredAnswerNumber(s, "zero"), 0);
    assert.ok(Number.isNaN(getStoredAnswerNumber(s, "nan")));
    assert.equal(getStoredAnswerNumber(s, "numericText"), undefined);
    assert.equal(getStoredAnswerNumber(s, "boolFlag"), undefined);
    assert.equal(getStoredAnswerNumber(s, "missing"), undefined);
  });
});
