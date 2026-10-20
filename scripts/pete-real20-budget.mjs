/**
 * One-time owner-approved Pete REAL AI 20-case QA.
 * Reserve $2 in the SHARED immutable $8 phase-3 ledger BEFORE any provider call.
 * A crash or unconfirmed push retains full $2. No refunds without a trustworthy
 * local ledger. Run ID (without attempt) prevents reruns from spending again.
 * Never logs the OpenAI key, never grants permission for Meta sends.
 */
import fs from "node:fs";
import path from "node:path";

const [action] = process.argv.slice(2);
if (!["reserve", "settle"].includes(action) ||
    process.env.GITHUB_ACTIONS !== "true" ||
    !process.env.GITHUB_RUN_ID ||
    process.env.PETE_REAL20_APPROVAL !== "USER_APPROVED_2026_10_20_2USD" ||
    process.env.PETE_REAL20_MAX_MICRO_USD !== "2000000") {
  throw Error("pete_real20_invalid_authorization");
}

const file = path.resolve("budget-ledger", "phase3-budget-ledger.json");
const cap = 8_000_000;
const reservation = 2_000_000;
const key = "pete-real20-" + process.env.GITHUB_RUN_ID; // No attempt: reruns denied.

let data;
try { data = JSON.parse(fs.readFileSync(file, "utf8")); }
catch { throw Error("pete_real20_budget_missing"); }

const validWhole = n => Number.isSafeInteger(n) && n >= 0;
if (data.version !== 1 || data.capMicroUsd !== cap ||
    !validWhole(data.spentMicroUsd) || !validWhole(data.reservedMicroUsd) ||
    !data.activeReservations || typeof data.activeReservations !== "object" ||
    Array.isArray(data.activeReservations) || !Array.isArray(data.completedBatches)) {
  throw Error("pete_real20_budget_invalid");
}
const held = Object.values(data.activeReservations).reduce((sum, entry) => {
  if (!entry || !validWhole(entry.heldMicroUsd)) throw Error("pete_real20_invalid_hold");
  return sum + entry.heldMicroUsd;
}, 0);
if (held !== data.reservedMicroUsd ||
    data.spentMicroUsd + data.reservedMicroUsd > cap) {
  throw Error("pete_real20_budget_invariant");
}

if (action === "reserve") {
  if (data.activeReservations[key] ||
      data.completedBatches.some(entry => entry.id === key)) {
    throw Error("pete_real20_run_replay_denied");
  }
  if (data.spentMicroUsd + data.reservedMicroUsd + reservation > cap) {
    throw Error("pete_real20_project_cap_exceeded");
  }
  data.activeReservations[key] = {
    heldMicroUsd: reservation, createdAt: new Date().toISOString(),
  };
  data.reservedMicroUsd += reservation;
} else {
  if (data.activeReservations[key]?.heldMicroUsd !== reservation) {
    throw Error("pete_real20_reservation_missing");
  }
  const localFile = path.resolve("backend", ".real20-data", "pete-api-budget.json");
  let counted = reservation; // Fail closed on missing/malformed/partial usage.
  try {
    const local = JSON.parse(fs.readFileSync(localFile, "utf8"));
    if (local.version === 1 &&
        local.capMicroUsd === cap &&
        validWhole(local.committedMicroUsd) &&
        local.committedMicroUsd <= reservation &&
        validWhole(local.requestsStarted) &&
        validWhole(local.requestsMetered) &&
        local.requestsMetered <= local.requestsStarted) {
      counted = local.committedMicroUsd;
    }
  } catch { /* retain the entire authorization if uncertain */ }
  data.spentMicroUsd += counted;
  data.reservedMicroUsd -= reservation;
  delete data.activeReservations[key];
  data.completedBatches.push({
    id: key, costMicroUsd: counted, completedAt: new Date().toISOString(),
  });
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n",
  { encoding: "utf8", mode: 0o600 });
console.log("REAL20 authorization ledger: " + action +
  " | project committed+held USD " +
  ((data.spentMicroUsd + data.reservedMicroUsd) / 1_000_000).toFixed(6) +
  " / 8.000000; run " + process.env.GITHUB_RUN_ID);
