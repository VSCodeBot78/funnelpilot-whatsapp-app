import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationState } from "../types/types.js";
import {
  getPendingAiFollowUpQuestion, getPendingAiReturnStep,
  getPendingAiSource, resetPriceFlowState,
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
