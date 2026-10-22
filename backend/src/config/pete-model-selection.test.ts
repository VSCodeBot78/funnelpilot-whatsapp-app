import test from "node:test";
import assert from "node:assert/strict";
import {
  PETE_PRODUCT_MODEL, normalizePeteProductModel, resolvePeteRuntimeModel,
} from "./pete-model-selection.js";

test("only Sol is a product model; old persisted mini is migrated", () => {
  assert.equal(PETE_PRODUCT_MODEL, "gpt-6.1-sol");
  for (const old of ["gpt-4.1-mini", "gpt-5.4", "", undefined, "unknown"]) {
    assert.equal(normalizePeteProductModel(old), "gpt-6.1-sol");
  }
});

test("production defaults to Sol and refuses stale mini environment", () => {
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "production" }), "gpt-6.1-sol");
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "production", envModel: "gpt-6.1-sol" }), "gpt-6.1-sol");
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "production", envModel: "gpt-4.1-mini" }), null);
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "development", envModel: "gpt-4.1-mini" }), null);
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "production", envModel: "random-unknown-model" }), null);
});

test("historical models remain available only in isolated tests or approved older lab", () => {
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "test", envModel: "gpt-4.1-mini" }), "gpt-4.1-mini");
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "test" }), "gpt-4.1-mini");
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "test", envModel: "gpt-5.4" }), "gpt-5.4");
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "test", envModel: "gpt-5.4", labGpt54Approved: true }), "gpt-5.4");
  assert.equal(resolvePeteRuntimeModel({ nodeEnv: "production", envModel: "gpt-5.4", labGpt54Approved: false }), null);
});
