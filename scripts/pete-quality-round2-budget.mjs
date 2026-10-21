/**
 * Third and LAST paid QA attempt for Pete on 21 October. No new spending grant.
 * This runner can reserve at most USD 0.40 for one round after the original
 * USD 2 authorization, with previous attempts permanently charged.
 *
 * Reserve must be remotely confirmed BEFORE any OpenAI Responses API call.
 * Crashes/unknown usage consume the entire held amount. No replay permitted.
 */
import fs from "node:fs";
import path from "node:path";

const [operation] = process.argv.slice(2);
const branch = "refs/heads/pete-quality-real-round2-20261021";
const key = "approved-pete-qa-20261021-round2-from-residual";
const originalCap = 2_000_000;
const firstCharge = 245_788;
const secondCharge = 79_279;
const heldAmount = 400_000;
const file = path.resolve("budget-ledger", "phase3-budget-ledger.json");

if (!["reserve", "settle"].includes(operation) ||
    process.argv.length !== 3 ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== branch ||
    !/^[0-9]{5,}$/.test(process.env.GITHUB_RUN_ID ?? "") ||
    process.env.PETE_QUALITY_QA_20261021 !== "true" ||
    process.env.PETE_QUALITY_QA_ROUND2_20261021 !== "true" ||
    process.env.PETE_QUALITY_QA_APPROVAL !== "single-run-20261021") {
  throw Error("qa_round2_unauthorized");
}
let ledger;
try { ledger = JSON.parse(fs.readFileSync(file, "utf8")); }
catch { throw Error("qa_round2_ledger_missing"); }

if (ledger.version !== 1 ||
    ledger.capMicroUsd !== 8_000_000 ||
    !Number.isSafeInteger(ledger.spentMicroUsd) ||
    !Number.isSafeInteger(ledger.reservedMicroUsd) ||
    ledger.spentMicroUsd < 0 || ledger.reservedMicroUsd < 0 ||
    !ledger.activeReservations ||
    Array.isArray(ledger.activeReservations) ||
    !Array.isArray(ledger.completedBatches) ||
    ledger.qualityRun20261021?.status !== "settled" ||
    ledger.qualityRun20261021?.chargedMicroUsd !== firstCharge ||
    ledger.qualityResume20261021?.status !== "settled" ||
    ledger.qualityResume20261021?.chargedMicroUsd !== secondCharge ||
    ledger.qualityResume20261021?.previouslyChargedMicroUsd !== firstCharge ||
    !ledger.completedBatches.some(row =>
      row.id === "approved-real-pete-quality-20261021-usd2" &&
      row.costMicroUsd === firstCharge) ||
    !ledger.completedBatches.some(row =>
      row.id === "approved-pete-qa-20261021-resume-remaining" &&
      row.costMicroUsd === secondCharge)) {
  throw Error("qa_round2_history_not_verified");
}
const held = Object.values(ledger.activeReservations)
  .reduce((sum, item) => sum + Number(item.heldMicroUsd), 0);
if (!Number.isSafeInteger(held) ||
    held !== ledger.reservedMicroUsd ||
    ledger.spentMicroUsd + held > ledger.capMicroUsd ||
    firstCharge + secondCharge + heldAmount > originalCap) {
  throw Error("qa_round2_ledger_invariant");
}

if (operation === "reserve") {
  if (ledger.qualityRound2_20261021 ||
      ledger.activeReservations[key] ||
      ledger.completedBatches.some(row => row.id === key) ||
      ledger.reservedMicroUsd !== 0 ||
      ledger.spentMicroUsd + heldAmount > ledger.capMicroUsd) {
    throw Error("qa_round2_reservation_denied");
  }
  ledger.activeReservations[key] = {
    heldMicroUsd: heldAmount, createdAt: new Date().toISOString(),
  };
  ledger.reservedMicroUsd += heldAmount;
  ledger.qualityRound2_20261021 = {
    runId: process.env.GITHUB_RUN_ID,
    previousSpendMicroUsd: firstCharge + secondCharge,
    reserveMicroUsd: heldAmount, status: "reserved",
  };
} else {
  const qa = ledger.qualityRound2_20261021;
  if (!qa || qa.status !== "reserved" ||
      qa.runId !== process.env.GITHUB_RUN_ID ||
      qa.reserveMicroUsd !== heldAmount ||
      qa.previousSpendMicroUsd !== firstCharge + secondCharge ||
      ledger.activeReservations[key]?.heldMicroUsd !== heldAmount) {
    throw Error("qa_round2_settle_invalid");
  }
  const local = path.resolve("backend", ".pete-quality-20261021-round2",
    "pete-api-budget.json");
  let charge = heldAmount;
  try {
    const d = JSON.parse(fs.readFileSync(local, "utf8"));
    if (d.version === 1 &&
        Number.isSafeInteger(d.committedMicroUsd) &&
        d.committedMicroUsd >= 0 &&
        d.committedMicroUsd <= heldAmount &&
        Number.isSafeInteger(d.requestsStarted) &&
        d.requestsStarted > 0) charge = d.committedMicroUsd;
  } catch { /* Unknown usage is charged at the full $0.40 reservation. */ }
  ledger.spentMicroUsd += charge;
  ledger.reservedMicroUsd -= heldAmount;
  delete ledger.activeReservations[key];
  ledger.completedBatches.push({
    id: key, costMicroUsd: charge, completedAt: new Date().toISOString(),
  });
  qa.status = "settled";
  qa.chargedMicroUsd = charge;
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + "\n", {
  encoding: "utf8", mode: 0o600,
});
console.log("Pete QA round2 " + operation +
  ": total original authorization USD 2.00; previous charged USD " +
  ((firstCharge + secondCharge) / 1e6).toFixed(6) +
  "; third attempt reserve at most USD " + (heldAmount / 1e6).toFixed(2));
