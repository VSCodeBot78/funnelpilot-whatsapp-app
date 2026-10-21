/**
 * Single bounded retry of the 21 Oct Pete QA after GitHub's OpenAI key is
 * repaired. This is NOT a new $2 grant. It uses only the unconsumed balance
 * of the original $2 user authorization, with an immutable old-run charge.
 *
 * The QA runner must not make a paid request until the reservation commit
 * is acknowledged by GitHub on the existing project budget-ledger branch.
 * Another run ID or a second reserve after a crash always fails closed.
 */
import fs from "node:fs";
import path from "node:path";

const [action] = process.argv.slice(2);
const qaBranch = "refs/heads/pete-quality-real-resume-20261021";
const key = "approved-pete-qa-20261021-resume-remaining";
const originalCharge = 245_788;
const originalCap = 2_000_000;
const remainingAllowance = originalCap - originalCharge; // 1_754_212 micro-USD
const file = path.resolve("budget-ledger", "phase3-budget-ledger.json");

if (process.argv.length !== 3 ||
    !["reserve", "settle"].includes(action) ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== qaBranch ||
    !/^[0-9]{5,}$/.test(process.env.GITHUB_RUN_ID ?? "") ||
    process.env.PETE_QUALITY_QA_20261021 !== "true" ||
    process.env.PETE_QUALITY_QA_RESUME_20261021 !== "true" ||
    process.env.PETE_QUALITY_QA_APPROVAL !== "single-run-20261021") {
  throw new Error("pete_qa_resume_unauthorized");
}
let ledger;
try { ledger = JSON.parse(fs.readFileSync(file, "utf8")); }
catch { throw new Error("pete_qa_resume_ledger_unavailable"); }

if (ledger.version !== 1 ||
    ledger.capMicroUsd !== 8_000_000 ||
    !Number.isSafeInteger(ledger.spentMicroUsd) ||
    !Number.isSafeInteger(ledger.reservedMicroUsd) ||
    ledger.spentMicroUsd < 0 ||
    ledger.reservedMicroUsd < 0 ||
    !ledger.activeReservations ||
    Array.isArray(ledger.activeReservations) ||
    !Array.isArray(ledger.completedBatches) ||
    !ledger.qualityRun20261021 ||
    ledger.qualityRun20261021.status !== "settled" ||
    ledger.qualityRun20261021.authorizedMicroUsd !== originalCap ||
    ledger.qualityRun20261021.chargedMicroUsd !== originalCharge ||
    !ledger.completedBatches.some(batch =>
      batch.id === "approved-real-pete-quality-20261021-usd2" &&
      batch.costMicroUsd === originalCharge)) {
  throw new Error("pete_qa_resume_ledger_invariant");
}

const held = Object.values(ledger.activeReservations).reduce((sum, reservation) =>
  sum + Number(reservation.heldMicroUsd), 0);
if (!Number.isSafeInteger(held) ||
    held !== ledger.reservedMicroUsd ||
    ledger.spentMicroUsd + ledger.reservedMicroUsd > ledger.capMicroUsd) {
  throw new Error("pete_qa_resume_shared_budget_invariant");
}

if (action === "reserve") {
  // Never allow a second run: even an abandoned reservation stays consumed.
  if (ledger.qualityResume20261021 ||
      ledger.activeReservations[key] ||
      ledger.completedBatches.some(batch => batch.id === key) ||
      ledger.reservedMicroUsd !== 0 ||
      ledger.spentMicroUsd + remainingAllowance > ledger.capMicroUsd) {
    throw new Error("pete_qa_resume_not_available");
  }
  ledger.activeReservations[key] = {
    heldMicroUsd: remainingAllowance,
    createdAt: new Date().toISOString(),
  };
  ledger.reservedMicroUsd += remainingAllowance;
  ledger.qualityResume20261021 = {
    runId: process.env.GITHUB_RUN_ID,
    originalAuthorizationMicroUsd: originalCap,
    previouslyChargedMicroUsd: originalCharge,
    heldMicroUsd: remainingAllowance,
    status: "reserved",
  };
} else {
  const resumed = ledger.qualityResume20261021;
  if (!resumed || resumed.status !== "reserved" ||
      resumed.runId !== process.env.GITHUB_RUN_ID ||
      resumed.heldMicroUsd !== remainingAllowance ||
      resumed.previouslyChargedMicroUsd !== originalCharge ||
      ledger.activeReservations[key]?.heldMicroUsd !== remainingAllowance) {
    throw new Error("pete_qa_resume_settle_invalid");
  }
  const local = path.resolve("backend", ".pete-quality-20261021-resume",
    "pete-api-budget.json");
  // Missing/corrupt usage data consumes the entire held authorization.
  let charge = remainingAllowance;
  try {
    const usage = JSON.parse(fs.readFileSync(local, "utf8"));
    if (usage.version === 1 &&
        Number.isSafeInteger(usage.committedMicroUsd) &&
        Number.isSafeInteger(usage.requestsStarted) &&
        usage.requestsStarted > 0 &&
        usage.committedMicroUsd >= 0 &&
        usage.committedMicroUsd <= remainingAllowance) {
      charge = usage.committedMicroUsd;
    }
  } catch { /* The reservation remains fully charged without proof. */ }
  ledger.spentMicroUsd += charge;
  ledger.reservedMicroUsd -= remainingAllowance;
  delete ledger.activeReservations[key];
  ledger.completedBatches.push({
    id: key, costMicroUsd: charge, completedAt: new Date().toISOString(),
  });
  resumed.status = "settled";
  resumed.chargedMicroUsd = charge;
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + "\n", {
  encoding: "utf8", mode: 0o600,
});
console.log("Pete QA resume " + action + ": previous=" +
  (originalCharge / 1e6).toFixed(6) + " USD, new held/charged <=" +
  (remainingAllowance / 1e6).toFixed(6) + " USD");
