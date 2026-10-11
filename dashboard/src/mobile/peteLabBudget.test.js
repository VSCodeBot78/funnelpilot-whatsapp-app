import assert from "node:assert/strict";
import test from "node:test";
import { readPeteBudget, formatUsd, budgetCounterChange } from "./peteLabBudget.js";

const sample = { ok: true, hardCapUsd: 8, committedUsd: 4.32,
  confirmedUsd: 4.30, reservedUsd: 0.02, remainingUsd: 3.68,
  requestsStarted: 20, requestsMetered: 19, inputTokens: 1400,
  outputTokens: 200, blocked: false };

test("Pete laboratory renders only valid backend ledger, not assumed API credit", () => {
  const budget = readPeteBudget(sample);
  assert.equal(budget.cap, 8);
  assert.equal(budget.spent, 4.32);
  assert.equal(budget.left, 3.68);
  assert.equal(budget.low, false);
  assert.equal(budget.inputTokens, 1400);
  assert.equal(readPeteBudget({ ok: false, reason: "ledger_unavailable" }), null);
  assert.equal(readPeteBudget({ ...sample, confirmedUsd: 0 }), null);
  assert.equal(readPeteBudget({ ...sample, remainingUsd: -2 }), null);
  assert.equal(readPeteBudget({ ...sample, hardCapUsd: NaN }), null);
});
test("clearly shows tiny call charges and fail-closed threshold", () => {
  assert.equal(formatUsd(0.00028), "$0.0003");
  assert.equal(formatUsd(undefined), "nicht verfügbar");
  assert.equal(budgetCounterChange(readPeteBudget(sample),
    readPeteBudget({ ...sample, committedUsd: 4.32028, confirmedUsd: 4.30028,
      remainingUsd: 3.67972 })), 0.0002799999999991698);
  assert.equal(budgetCounterChange(readPeteBudget(sample), null), null);
  assert.equal(budgetCounterChange(readPeteBudget(sample),
    readPeteBudget({ ...sample, committedUsd: 3, confirmedUsd: 2.98,
      remainingUsd: 5 })), null);
  assert.equal(readPeteBudget({ ...sample, committedUsd: 7.4, confirmedUsd: 7.38,
    remainingUsd: .6 }).low, true);
  assert.equal(readPeteBudget({ ...sample, committedUsd: 8, confirmedUsd: 7.98,
    remainingUsd: 0, blocked: true }).blocked, true);
});
