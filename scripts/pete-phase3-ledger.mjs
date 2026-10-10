/**
 * GitHub Actions-only durable budget envelope.
 * A reservation is pushed to the dedicated ledger branch BEFORE API calls.
 * Workflow concurrency serializes batches and commit/push is mandatory.
 * A crashed run leaves the preauthorization consumed instead of resetting it.
 *
 * This file never reads or logs OPENAI_API_KEY.
 */
import fs from "node:fs";
import path from "node:path";
const [action, rawBatch] = process.argv.slice(2);
const batch = Number(rawBatch);
if (!["reserve", "settle"].includes(action) ||
    !Number.isInteger(batch) || batch < 0 || batch > 4 ||
    process.env.GITHUB_ACTIONS !== "true" ||
    !process.env.GITHUB_RUN_ID || !process.env.GITHUB_RUN_ATTEMPT) {
  throw Error("phase3_budget_invalid_execution");
}
const root = path.resolve("budget-ledger");
const file = path.join(root, "phase3-budget-ledger.json");
const cap = 8_000_000;
const reservedPerBatch = 1_500_000;
const key = process.env.GITHUB_RUN_ID + "-" +
  process.env.GITHUB_RUN_ATTEMPT + "-batch-" + batch;

let ledger;
try { ledger = JSON.parse(fs.readFileSync(file, "utf8")); }
catch { throw Error("phase3_ledger_not_found_or_invalid"); }
if (ledger.version !== 1 || ledger.capMicroUsd !== cap ||
    !Number.isSafeInteger(ledger.spentMicroUsd) ||
    !Number.isSafeInteger(ledger.reservedMicroUsd) ||
    ledger.spentMicroUsd < 0 || ledger.reservedMicroUsd < 0 ||
    !ledger.activeReservations ||
    typeof ledger.activeReservations !== "object" ||
    !Array.isArray(ledger.completedBatches)) {
  throw Error("phase3_ledger_invalid_stop");
}
const sumHeld = Object.values(ledger.activeReservations)
  .reduce((total, item) => total + item.heldMicroUsd, 0);
if (sumHeld !== ledger.reservedMicroUsd ||
    ledger.spentMicroUsd + ledger.reservedMicroUsd > cap) {
  throw Error("phase3_ledger_invariant_stop");
}
if (action === "reserve") {
  if (ledger.activeReservations[key] ||
      ledger.completedBatches.some(entry => entry.id === key)) {
    throw Error("phase3_batch_replay_denied");
  }
  if (ledger.spentMicroUsd + ledger.reservedMicroUsd + reservedPerBatch > cap) {
    throw Error("phase3_cumulative_budget_exhausted");
  }
  ledger.activeReservations[key] = {
    heldMicroUsd: reservedPerBatch, createdAt: new Date().toISOString(),
  };
  ledger.reservedMicroUsd += reservedPerBatch;
} else {
  const pending = ledger.activeReservations[key];
  if (!pending || pending.heldMicroUsd !== reservedPerBatch) {
    throw Error("phase3_settle_missing_reservation");
  }
  const local = path.resolve("backend", ".phase3-data", "batch-" + batch,
    "pete-api-budget.json");
  // Inability to read usage means charge the FULL preauthorization, never zero.
  let committed = reservedPerBatch;
  try {
    const usage = JSON.parse(fs.readFileSync(local, "utf8"));
    if (usage.version === 1 &&
        Number.isSafeInteger(usage.committedMicroUsd) &&
        usage.committedMicroUsd >= 0 &&
        usage.committedMicroUsd <= reservedPerBatch) {
      committed = usage.committedMicroUsd;
    }
  } catch { /* charged full reserve; manual reconciliation only */ }
  ledger.spentMicroUsd += committed;
  ledger.reservedMicroUsd -= pending.heldMicroUsd;
  delete ledger.activeReservations[key];
  ledger.completedBatches.push({
    id: key, costMicroUsd: committed,
    completedAt: new Date().toISOString(),
  });
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + "\n",
  { encoding: "utf8", mode: 0o600 });
console.log("Phase 3 cumulative Pete budget in USD: " +
  ((ledger.spentMicroUsd + ledger.reservedMicroUsd) / 1e6).toFixed(4) +
  " / 8.0000, batch " + batch + " " + action + " completed");
