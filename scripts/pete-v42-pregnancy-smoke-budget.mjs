import fs from "node:fs";
import path from "node:path";

/**
 * October 22, 2026: owner authorizes additional EUR 5 for Pete QA.
 * USD 5.00 is a conservative lower USD-denominated spending ceiling,
 * NOT a replacement or reset of the original USD 8 project ledger.
 *
 * This reserve/settle script can run only once for 20 synthetic chats.
 * No customer messages or live Meta/WhatsApp actions are involved.
 */
const action = process.argv[2];
const testId = "pete-v42-pregnancy-smoke-20261022-usd0p25";
const holdMicroUsd = 250_000;
const newUsdCap = 5_000_000;
const ledgerFile = path.resolve("budget-ledger/phase3-budget-ledger.json");
const guard = process.env;
if (process.argv.length !== 3 || !["reserve", "settle"].includes(action) ||
    guard.GITHUB_ACTIONS !== "true" ||
    guard.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
    guard.PETE_V42_PREGNANCY_QA_APPROVAL !== "once-20261022-eur5-usd0p25-pregnancy" ||
    guard.PETE_V42_PREGNANCY_QA_ENABLED !== "true" ||
    guard.OPENAI_MODEL !== "gpt-6.1-sol" || guard.NODE_ENV !== "test" ||
    guard.INSTAGRAM_SEND_ENABLED !== "false" ||
    guard.INSTAGRAM_ENGINE_ENABLED !== "false" ||
    guard.WHATSAPP_SEND_ENABLED !== "false" ||
    guard.ENABLE_GENERIC_WEBHOOKS !== "false" ||
    guard.PETE_MOBILE_LAB_ENABLED !== "false" ||
    !/^[0-9]{5,}$/.test(guard.GITHUB_RUN_ID ?? "")) {
  throw Error("qa_not_authorized");
}
const data = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
if (data.version !== 1 || data.capMicroUsd !== 8_000_000 ||
    !Number.isSafeInteger(data.spentMicroUsd) ||
    !Number.isSafeInteger(data.reservedMicroUsd) ||
    data.spentMicroUsd < 0 || data.reservedMicroUsd !== 0 ||
    data.spentMicroUsd + data.reservedMicroUsd > data.capMicroUsd ||
    data.policyV41FinalSol_20261022?.status !== "settled" ||
    data.policyV41BlindSol_20261022?.status !== "settled" ||
    data.policyV41BlindSol_20261022?.chargedMicroUsd !== 295_224 ||
    data.policyV41FinalSol_20261022?.chargedMicroUsd !== 586_530 ||
    Object.keys(data.activeReservations ?? {}).length !== 0) {
  throw Error("old_ledger_not_settled");
}
if (action === "reserve" && !data.extraOwnerQa20261022) {
  data.extraOwnerQa20261022 = {
    reason: "explicit owner authorization of EUR 5 on 2026-10-22",
    authorizedEur: 5,
    conservativeUsdCapMicro: newUsdCap,
    oldProjectCapMicroUsd: data.capMicroUsd,
    oldProjectSpendAtApprovalMicroUsd: data.spentMicroUsd,
    usedMicroUsd: 0,
    reservedMicroUsd: 0,
    reservations: {},
    batches: [],
  };
}
const extra = data.extraOwnerQa20261022;
if (!extra?.batches?.some(b => b.id === "pete-v42-remainder-holdout-20261022-usd0p70" &&
    b.runId === "39770672140" && b.chargeMicroUsd === 138106)) {
  throw Error("prior_remainder_batch_not_settled");
}
if (!extra?.batches?.some(b => b.id === "pete-v42-fresh-holdout-20261022-usd0p75" &&
   b.runId === "39769626385" && b.chargeMicroUsd === 77514)) {
  throw Error("holdout_failure_not_settled");
}
if (!extra || !extra.batches?.some(b => b.id === "pete-v42-sol-20-cases-20261022-usd1" && b.runId === "39768222168" && b.chargeMicroUsd === 585326)) {
  throw Error("first_qa_batch_not_settled");
}
if (!extra || extra.authorizedEur !== 5 ||
    extra.conservativeUsdCapMicro !== newUsdCap ||
    extra.oldProjectCapMicroUsd !== 8_000_000 ||
    !Number.isSafeInteger(extra.oldProjectSpendAtApprovalMicroUsd) ||
    data.spentMicroUsd !== extra.oldProjectSpendAtApprovalMicroUsd ||
    !Number.isSafeInteger(extra.usedMicroUsd) || extra.usedMicroUsd < 0 ||
    !Number.isSafeInteger(extra.reservedMicroUsd) || extra.reservedMicroUsd < 0 ||
    !extra.reservations || !Array.isArray(extra.batches) ||
    Object.values(extra.reservations).reduce((sum, r) => sum + Number(r.holdMicroUsd), 0) !== extra.reservedMicroUsd ||
    extra.usedMicroUsd + extra.reservedMicroUsd > newUsdCap) {
  throw Error("extra_approval_ledger_invalid");
}
if (action === "reserve") {
  if (extra.reservedMicroUsd !== 0 || extra.reservations[testId] ||
      extra.batches.some(b => b.id === testId) ||
      extra.usedMicroUsd + holdMicroUsd > newUsdCap) {
    throw Error("one_time_reservation_denied");
  }
  extra.reservations[testId] = {
    runId: guard.GITHUB_RUN_ID,
    holdMicroUsd,
    createdAt: new Date().toISOString(),
  };
  extra.reservedMicroUsd += holdMicroUsd;
} else {
  const reservation = extra.reservations[testId];
  if (!reservation || reservation.runId !== guard.GITHUB_RUN_ID ||
      reservation.holdMicroUsd !== holdMicroUsd ||
      extra.reservedMicroUsd < holdMicroUsd) {
    throw Error("settle_without_valid_reservation");
  }
  let chargeMicroUsd = holdMicroUsd;
  try {
    const local = JSON.parse(fs.readFileSync(
      "backend/.pete-v42-pregnancy-sol-20261022/pete-api-budget.json", "utf8"));
    if (local.version === 1 && Number.isSafeInteger(local.committedMicroUsd) &&
        local.committedMicroUsd >= 0 && local.committedMicroUsd <= holdMicroUsd &&
        Number.isSafeInteger(local.requestsStarted) && local.requestsStarted > 0) {
      chargeMicroUsd = local.committedMicroUsd;
    }
  } catch { /* Uncertain usage burns entire held allowance. */ }
  extra.usedMicroUsd += chargeMicroUsd;
  extra.reservedMicroUsd -= holdMicroUsd;
  delete extra.reservations[testId];
  extra.batches.push({
    id: testId,
    runId: guard.GITHUB_RUN_ID,
    chargeMicroUsd,
    completedAt: new Date().toISOString(),
  });
}
fs.writeFileSync(ledgerFile, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
console.log(action, "new owner EUR5 QA allowance, bounded to USD5 total; hold max USD0.25");
