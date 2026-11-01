import test from "node:test";
import assert from "node:assert/strict";
import { isRetryableDesktopTechnicalFailure as retry } from "./pete-desktop-error-policy.js";

for (const reason of ["not_authorized", "provider_unavailable", "budget_unavailable", "budget_exhausted"]) {
  test("synthetic desktop " + reason + " can retry after an upstream fix", () => {
    assert.equal(retry(reason, true), true);
  });
  test("real leads retain protected ownership after " + reason, () => {
    assert.equal(retry(reason, false), false);
  });
}
for (const reason of ["model_handoff", "invalid_output", "medical_critical", "unknown"]) {
  test(reason + " never bypasses human ownership", () => {
    assert.equal(retry(reason, true), false);
  });
}
