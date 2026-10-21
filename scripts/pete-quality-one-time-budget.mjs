/**
 * Durable one-time $2 reservation for Pete real-model QA (owner approved).
 * Always push the ledger commit before starting paid requests.
 * A crash leaves the reservation in place; a rerun cannot spend again.
 */
import fs from "node:fs";
import path from "node:path";
const [operation] = process.argv.slice(2);
const branch = "refs/heads/pete-quality-real-approved-20261021";
const key = "approved-real-pete-quality-20261021-usd2";
const amount = 2_000_000;
const ledgerFile = path.resolve("budget-ledger", "phase3-budget-ledger.json");
if (!["reserve", "settle"].includes(operation) ||
    process.argv.length !== 3 ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== branch ||
    !process.env.GITHUB_RUN_ID ||
    process.env.PETE_QUALITY_QA_20261021 !== "true" ||
    process.env.PETE_QUALITY_QA_APPROVAL !== "single-run-20261021") {
  throw new Error("qa_ledger_unauthorized");
}

let ledger;
try { ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8")); }
catch { throw new Error("qa_ledger_missing_fail_closed"); }
if (ledger.version !== 1 || ledger.capMicroUsd !== 8_000_000 ||
    !Number.isSafeInteger(ledger.spentMicroUsd) ||
    !Number.isSafeInteger(ledger.reservedMicroUsd) ||
    ledger.spentMicroUsd < 0 || ledger.reservedMicroUsd < 0 ||
    !ledger.activeReservations || Array.isArray(ledger.activeReservations) ||
    !Array.isArray(ledger.completedBatches)) {
  throw new Error("qa_ledger_corrupt_fail_closed");
}
const held = Object.values(ledger.activeReservations).reduce((sum, item) =>
  sum + Number(item.heldMicroUsd), 0);
if (!Number.isSafeInteger(held) || held !== ledger.reservedMicroUsd ||
    ledger.spentMicroUsd + ledger.reservedMicroUsd > ledger.capMicroUsd) {
  throw new Error("qa_ledger_invariant_fail_closed");
}

if (operation === "reserve") {
  if (ledger.qualityRun20261021 || ledger.activeReservations[key] ||
      ledger.completedBatches.some(x => x.id === key)) {
    throw new Error("qa_budget_already_reserved_or_spent");
  }
  if (ledger.spentMicroUsd + ledger.reservedMicroUsd + amount > ledger.capMicroUsd) {
    throw new Error("qa_lifetime_budget_exhausted");
  }
  ledger.activeReservations[key] = { heldMicroUsd: amount, createdAt: new Date().toISOString() };
  ledger.reservedMicroUsd += amount;
  ledger.qualityRun20261021 = {
    runId: process.env.GITHUB_RUN_ID,
    authorizedMicroUsd: amount,
    status: "reserved",
  };
} else {
  const info = ledger.qualityRun20261021;
  if (!info || info.status !== "reserved" ||
      info.runId !== process.env.GITHUB_RUN_ID ||
      info.authorizedMicroUsd !== amount ||
      ledger.activeReservations[key]?.heldMicroUsd !== amount) {
    throw new Error("qa_settle_missing_reservation");
  }
  // Missing/invalid usage means FULL $2 remain consumed, never zero.
  const localFile = path.resolve("backend", ".pete-quality-20261021",
    "pete-api-budget.json");
  let committed = amount;
  try {
    const actual = JSON.parse(fs.readFileSync(localFile, "utf8"));
    if (actual.version === 1 && Number.isSafeInteger(actual.committedMicroUsd) &&
        actual.committedMicroUsd >= 0 && actual.committedMicroUsd <= amount &&
        Number.isSafeInteger(actual.requestsStarted) &&
        actual.requestsStarted > 0) committed = actual.committedMicroUsd;
  } catch { /* Reserve stays fully charged without reliable usage evidence. */ }
  ledger.spentMicroUsd += committed;
  ledger.reservedMicroUsd -= amount;
  delete ledger.activeReservations[key];
  ledger.completedBatches.push({ id: key, costMicroUsd: committed,
    completedAt: new Date().toISOString() });
  info.status = "settled";
  info.chargedMicroUsd = committed;
}

fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + "\n", {
  encoding: "utf8", mode: 0o600,
});
console.log("One-time QA " + operation + " persisted; total project committed " +
  ((ledger.spentMicroUsd + ledger.reservedMicroUsd) / 1e6).toFixed(4) + " USD");
