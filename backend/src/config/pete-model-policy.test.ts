import test from "node:test";
import assert from "node:assert/strict";
import { PETE_PRODUCT_MODEL, isPeteProductModel, normalizePersistedPeteModel, getPeteEffectiveRuntimeModel } from "./pete-model-policy.js";

test("Pete product accepts only Sol", () => {
  assert.equal(PETE_PRODUCT_MODEL, "gpt-6.1-sol");
  assert.equal(isPeteProductModel("gpt-6.1-sol"), true);
  assert.equal(isPeteProductModel("gpt-4.1-mini"), false);
  assert.equal(isPeteProductModel("gpt-5.4"), false);
  assert.equal(isPeteProductModel("arbitrary-model"), false);
});

test("previous Mini selections migrate to Sol without enabling AI", () => {
  for (const previous of [undefined, "", "gpt-4.1-mini", "gpt-5.4", "unrecognized"]) {
    assert.equal(normalizePersistedPeteModel(previous), PETE_PRODUCT_MODEL);
  }
});

test("Production Pete ignores legacy Mini environment variables", () => {
  const beforeEnv = process.env.NODE_ENV;
  const beforeModel = process.env.OPENAI_MODEL;
  try {
    process.env.NODE_ENV = "production";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    assert.equal(getPeteEffectiveRuntimeModel("gpt-6.1-sol"), "gpt-6.1-sol");
    assert.equal(getPeteEffectiveRuntimeModel("gpt-4.1-mini"), "gpt-6.1-sol");
    process.env.NODE_ENV = "test";
    assert.equal(getPeteEffectiveRuntimeModel("gpt-6.1-sol"), "gpt-4.1-mini",
      "historical Mini is permitted only inside explicit offline test fixtures");
  } finally {
    if (beforeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = beforeEnv;
    if (beforeModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = beforeModel;
  }
});
