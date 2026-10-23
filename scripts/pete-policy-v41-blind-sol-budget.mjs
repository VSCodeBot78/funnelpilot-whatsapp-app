import fs from "node:fs";
import path from "node:path";

/**
 * Owner-approved one-shot GPT-6.1 Sol Policy v4 synthetic QA.
 * A shared, cumulative USD 8 hard cap is NEVER raised or reset.
 * This batch's one-time reservation is at most USD 0.45.
 */
const operation = process.argv[2];
const ref = "refs/heads/feat/pete-policy-v4-20261022";
const id = "pete-policy-v41-blind-sol-20261022-usd0p45";
const hold = 450_000;
const ledgerFile = path.resolve("budget-ledger/phase3-budget-ledger.json");
if (process.argv.length !== 3 || !["reserve", "settle"].includes(operation) ||
    process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== ref ||
    process.env.PETE_POLICY_V41_BLIND_QA_20261022 !== "true" ||
    process.env.PETE_POLICY_V41_BLIND_APPROVAL !== "once-sol-v41-blind-20261022-usd0p45" ||
    process.env.NODE_ENV !== "test" ||
    process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
    process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
    process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
    process.env.WHATSAPP_SEND_ENABLED !== "false" ||
    process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
    !/^[0-9]{5,}$/.test(process.env.GITHUB_RUN_ID ?? "")) {
  throw Error("policy_v4_unauthorized");
}
const ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
if (ledger.version !== 1 || ledger.capMicroUsd !== 8_000_000 ||
    !Number.isSafeInteger(ledger.spentMicroUsd) || ledger.spentMicroUsd < 0 ||
    !Number.isSafeInteger(ledger.reservedMicroUsd) || ledger.reservedMicroUsd < 0 ||
    !ledger.activeReservations || Array.isArray(ledger.activeReservations) ||
    !Array.isArray(ledger.completedBatches) ||
    ledger.solSmoke_20261022?.status !== "settled" ||
    ledger.solSmoke_20261022?.chargedMicroUsd !== 228_132 ||
    ledger.policyV4Sol_20261022?.status !== "settled" ||
    ledger.policyV4Sol_20261022?.chargedMicroUsd !== 584_400 ||
    ledger.policyV4bSol_20261022?.status !== "settled" ||
    ledger.policyV4bSol_20261022?.chargedMicroUsd !== 569_802 ||
    ledger.policyV4HoldoutSol_20261022?.status !== "settled" ||
    ledger.policyV4HoldoutSol_20261022?.chargedMicroUsd !== 325_596 ||
    ledger.policyV41FinalSol_20261022?.status !== "settled" ||
    ledger.policyV41FinalSol_20261022?.chargedMicroUsd !== 586_530 ||
    Object.values(ledger.activeReservations)
      .reduce((sum, entry) => sum + Number(entry.heldMicroUsd), 0) !== ledger.reservedMicroUsd ||
    ledger.spentMicroUsd + ledger.reservedMicroUsd > ledger.capMicroUsd) {
  throw Error("policy_v4_ledger_invalid");
}
if (operation === "reserve") {
  if (ledger.policyV41BlindSol_20261022 || ledger.activeReservations[id] ||
      ledger.completedBatches.some(batch => batch.id === id) ||
      ledger.reservedMicroUsd !== 0 ||
      ledger.spentMicroUsd + hold > ledger.capMicroUsd) {
    throw Error("policy_v4_reservation_denied");
  }
  ledger.activeReservations[id] = { heldMicroUsd: hold, createdAt: new Date().toISOString() };
  ledger.reservedMicroUsd += hold;
  ledger.policyV41BlindSol_20261022 = {
    runId: process.env.GITHUB_RUN_ID,
    reserveMicroUsd: hold, status: "reserved",
  };
} else {
  const reservation = ledger.policyV41BlindSol_20261022;
  if (reservation?.status !== "reserved" ||
      reservation.runId !== process.env.GITHUB_RUN_ID ||
      reservation.reserveMicroUsd !== hold ||
      ledger.activeReservations[id]?.heldMicroUsd !== hold) {
    throw Error("policy_v4_settle_denied");
  }
  let charge = hold; // Unknown provider usage cannot create free unmetered credits.
  try {
    const local = JSON.parse(fs.readFileSync(
      "backend/.pete-policy-v41-blind-sol-20261022/pete-api-budget.json", "utf8"));
    if (local.version === 1 &&
        Number.isSafeInteger(local.committedMicroUsd) &&
        local.committedMicroUsd >= 0 && local.committedMicroUsd <= hold &&
        Number.isSafeInteger(local.requestsStarted) && local.requestsStarted > 0) {
      charge = local.committedMicroUsd;
    }
  } catch { /* Retain worst-case full authorization when uncertain. */ }
  ledger.spentMicroUsd += charge;
  ledger.reservedMicroUsd -= hold;
  delete ledger.activeReservations[id];
  ledger.completedBatches.push({ id, costMicroUsd: charge, completedAt: new Date().toISOString() });
  reservation.status = "settled";
  reservation.chargedMicroUsd = charge;
}
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + "\n", { mode: 0o600 });
console.log("Policy v4", operation, "one-time 0.45 USD maximum, within global 8 USD cap");
