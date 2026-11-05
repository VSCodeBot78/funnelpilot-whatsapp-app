import assert from "node:assert/strict";
import test from "node:test";
import {
  mapPeteDecisionToIntent, mapPeteSafetyCategoryToIntent,
  shouldLetObjectionModuleHandlePeteSafety, mapPeteObjectionIntentToLeadIntent,
  type PeteDecision, type PeteDecisionType,
} from "./pete-decision-layer.js";
import type { PeteRuntimeSafetyResult } from "./pete-runtime-safety.js";
import type { PeteObjectionResult } from "./pete-objection-handler.js";

test("engine decision-intent mappings retain their existing priority and fallback", async t => {
  for (const [decisionType, target, expected] of [
    ["hard_stop", undefined, "stop"],
    ["human_request", undefined, "booking_intent"],
    ["booking_request", undefined, "booking_intent"],
    ["link_request", "booking", "booking_intent"],
    ["link_request", "info", "info_link_only"],
    ["link_request", "unexpected", "info_link_only"],
    ["price_question", undefined, "price_question"],
    ["price_objection", undefined, "price_question"],
    ["offer_info", undefined, "info_only"],
    ["frustration_previous_attempts", undefined, "info_only"],
    ["question_intro_confirmed", undefined, "flow_answer"],
    ["normal_funnel", undefined, "unknown"],
    ["fallback", undefined, "unknown"],
    ["legal_privacy", undefined, "unknown"],
  ] as const) await t.test("decision " + decisionType + "/" + target, () => {
    const decision = { decisionType: decisionType as PeteDecisionType,
      action: "continue_funnel", priority: 10,
      ...(target ? { metadata: { linkTarget: target } } : {}),
    } as PeteDecision;
    assert.equal(mapPeteDecisionToIntent(decision), expected);
  });
  for (const [category, expected] of [
    ["price", "price_question"], ["human_request", "booking_intent"],
    ["booking_link", "booking_intent"], ["info_link", "info_link_only"],
    ["unclear", "unknown"], ["medical_critical", "unknown"],
  ] as const) await t.test("safety " + category, () => {
    assert.equal(mapPeteSafetyCategoryToIntent(
      category as PeteRuntimeSafetyResult["category"]), expected);
  });
  for (const [category, expected] of [
    ["price", true], ["distrust_aggression", true],
    ["medical_critical", false], ["legal_privacy", false],
    ["hard_stop", false],
  ] as const) await t.test("safety objection priority " + category, () => {
    assert.equal(shouldLetObjectionModuleHandlePeteSafety(
      { category } as PeteRuntimeSafetyResult), expected);
  });
  for (const [intent, action, shouldSendInfoLink, expected] of [
    ["hard_stop", "close", false, "stop"],
    ["price", "answer", false, "price_question"],
    ["info", "answer", true, "info_link_only"],
    ["info", "answer", false, "info_only"],
    ["other", "offer_booking", false, "booking_intent"],
    ["other", "answer", false, "unknown"],
  ] as const) await t.test("objection " + intent + "/" + action, () => {
    const result = { intent, action, shouldSendInfoLink, objectionCount: 1 } as unknown as PeteObjectionResult;
    assert.equal(mapPeteObjectionIntentToLeadIntent(result), expected);
  });
});
