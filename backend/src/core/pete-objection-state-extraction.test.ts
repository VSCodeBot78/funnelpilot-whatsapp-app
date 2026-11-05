import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationState } from "../types/types.js";
import {
  getPeteObjectionCount,
  buildPeteObjectionStatePatch,
  type PeteObjectionResult,
} from "./pete-objection-handler.js";

const prior = (intent: unknown, count: unknown) =>
  ({ answers: { objectionIntent: intent, objectionCount: count } } as unknown as ConversationState);

test("objection state extraction preserves original count and handoff metadata", async t => {
  await t.test("same intent increments; changed or missing intent resets", () => {
    assert.equal(getPeteObjectionCount(prior("price", 2), "price"), 3);
    assert.equal(getPeteObjectionCount(prior("price", 2), "info"), 1);
    assert.equal(getPeteObjectionCount(prior("price", "2"), "price"), 1);
    assert.equal(getPeteObjectionCount(prior(undefined, undefined), "trust"), 1);
  });
  await t.test("patch preserves all original fields and timestamp", () => {
    const source = { intent: "price", action: "handoff",
      objectionCount: 3, templateId: "template-test",
      matchedKeyword: "teuer", shouldHandoffToJochen: true,
      reason: "test_handoff" } as PeteObjectionResult;
    const result = buildPeteObjectionStatePatch(source);
    assert.equal(result.objectionIntent, source.intent);
    assert.equal(result.objectionAction, source.action);
    assert.equal(result.objectionCount, 3);
    assert.equal(result.objectionTemplateId, "template-test");
    assert.equal(result.objectionMatchedKeyword, "teuer");
    assert.equal(result.handoffReason, "test_handoff");
    assert.ok(Number.isFinite(Date.parse(result.objectionLastAt)));
    const noHandoff = buildPeteObjectionStatePatch({
      ...source, shouldHandoffToJochen: false,
    });
    assert.equal(noHandoff.handoffReason, undefined);
  });
});
