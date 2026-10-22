import test from "node:test";
import assert from "node:assert/strict";
import { PETE_MODEL_OPTIONS, PETE_PRODUCT_MODEL, normalizePeteDashboardModel } from "./peteModelOptions.js";

test("Dashboard offers only GPT-6.1 Sol as a Pete product model", () => {
  assert.deepEqual(PETE_MODEL_OPTIONS.map(x => x.value), ["gpt-6.1-sol"]);
  assert.match(PETE_MODEL_OPTIONS[0].label, /Sol/);
});
test("Older Mini selection renders and saves as Sol", () => {
  assert.equal(normalizePeteDashboardModel("gpt-4.1-mini"), PETE_PRODUCT_MODEL);
  assert.equal(normalizePeteDashboardModel(undefined), PETE_PRODUCT_MODEL);
});
