import test from "node:test";
import assert from "node:assert/strict";
import { PETE_PRODUCT_MODEL, isPeteProductModel, normalizePersistedPeteModel } from "./pete-model-policy.js";

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
