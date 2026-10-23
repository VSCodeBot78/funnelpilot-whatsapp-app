/**
 * Reusable, offline-only Pete QA approval ledger contract.
 * Does not make OpenAI calls or grant consent by itself.
 * A human must approve each run budget, and the caller must persist
 * the reservation to the shared ledger before any API request.
 */
const MICRO = 1_000_000;
const MAX_RUN_MICROS = 2_000_000;
const APPROVED_REF = "refs/heads/feat/pete-policy-v4-20261022";
const APPROVED_REPO = "VSCodeBot78/funnelpilot-whatsapp-app";
const MODEL = "gpt-6.1-sol";

export function parseQaBudgetMicros(value) {
  if (typeof value !== "string" || !/^(?:0\.[0-9]{2}|1\.[0-9]{2}|2\.00)$/.test(value))
    throw Error("qa_amount_format_invalid");
  const micros = Math.round(Number(value) * MICRO);
  if (micros < 10_000 || micros > MAX_RUN_MICROS) throw Error("qa_budget_out_of_range");
  return micros;
}

function assertSafeEnvironment(env) {
  if (env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_REPOSITORY !== APPROVED_REPO ||
      env.GITHUB_REF !== APPROVED_REF ||
      !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) ||
      env.GITHUB_RUN_ATTEMPT !== "1" ||
      !/^[0-9]{5,}$/.test(env.GITHUB_RUN_ID ?? "") ||
      env.NODE_ENV !== "test" || env.OPENAI_MODEL !== MODEL ||
      env.INSTAGRAM_SEND_ENABLED !== "false" ||
      env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
      env.WHATSAPP_SEND_ENABLED !== "false" ||
      env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
      env.PETE_MOBILE_LAB_ENABLED !== "false" ||
      env.PETE_LLM_CONVERSATION_ENABLED !== "true" ||
      env.PETE_LLM_API_CALLS_APPROVED !== "true") throw Error("qa_environment_not_safe");
}
function validateLedger(ledger) {
  if (!ledger || ledger.version !== 1 ||
      ledger.capMicroUsd !== 8_000_000 ||
      ledger.spentMicroUsd !== 7_817_830 ||
      ledger.reservedMicroUsd !== 0 ||
      Object.keys(ledger.activeReservations ?? {}).length !== 0) throw Error("qa_original_budget_modified");
  const extra = ledger.extraOwnerQa20261022;
  if (!extra || extra.authorizedEur !== 5 ||
      extra.conservativeUsdCapMicro !== 5_000_000 ||
      extra.oldProjectCapMicroUsd !== 8_000_000 ||
      extra.oldProjectSpendAtApprovalMicroUsd !== ledger.spentMicroUsd ||
      !Number.isSafeInteger(extra.usedMicroUsd) || extra.usedMicroUsd < 0 ||
      !Number.isSafeInteger(extra.reservedMicroUsd) || extra.reservedMicroUsd < 0 ||
      !extra.reservations || Array.isArray(extra.reservations) ||
      !Array.isArray(extra.batches)) throw Error("qa_extra_ledger_invalid");
  const sum = Object.values(extra.reservations).reduce((a,r) =>
    a + (Number.isSafeInteger(r?.holdMicroUsd) ? r.holdMicroUsd : Number.NaN), 0);
  if (sum !== extra.reservedMicroUsd ||
      extra.usedMicroUsd + extra.reservedMicroUsd > extra.conservativeUsdCapMicro)
    throw Error("qa_extra_ledger_inconsistent");
  return extra;
}
/** Does not mutate the ledger. Approval text is a separately recorded owner consent. */
export function checkPeteQaAdmission(env, ledger, request) {
  assertSafeEnvironment(env);
  if (!request || request.version !== 1 ||
      !["sales20", "sales32", "focus15"].includes(request.testSet) ||
      typeof request.ownerApprovalRef !== "string" ||
      !/^owner:[a-z0-9-]{8,80}$/.test(request.ownerApprovalRef))
    throw Error("qa_approval_required");
  const micro = parseQaBudgetMicros(request.budgetUsd);
  const extra = validateLedger(ledger);
  const id = "pete-qa-" + env.GITHUB_RUN_ID;
  if (extra.reservedMicroUsd !== 0 ||
      extra.usedMicroUsd + micro > extra.conservativeUsdCapMicro ||
      extra.reservations[id] ||
      Object.values(extra.reservations).some(r => r?.ownerApprovalRef === request.ownerApprovalRef) ||
      extra.batches.some(b => b?.id === id || b?.runId === env.GITHUB_RUN_ID ||
        b?.ownerApprovalRef === request.ownerApprovalRef))
    throw Error("qa_spending_or_duplicate_denied");
  return { id, micro, runId: env.GITHUB_RUN_ID, testSet: request.testSet };
}
/** Caller MUST confirm remote push of this ledger before allowing any paid call. */
export function preparePeteQaReservation(env, ledger, request) {
  const ticket = checkPeteQaAdmission(env, ledger, request);
  const next = structuredClone(ledger);
  const e = next.extraOwnerQa20261022;
  e.reservations[ticket.id] = {
    runId: ticket.runId, holdMicroUsd: ticket.micro, testSet: ticket.testSet,
    ownerApprovalRef: request.ownerApprovalRef,
  };
  e.reservedMicroUsd += ticket.micro;
  return { ledger: next, ticket };
}
/** Never silently refund unknown usage; uncertain calls consume the whole hold. */
export function settlePeteQaReservation(env, ledger, localReceipt) {
  if (env.GITHUB_RUN_ATTEMPT !== "1") throw Error("qa_attempt_reuse_denied");
  const id = "pete-qa-" + env.GITHUB_RUN_ID;
  const e = validateLedger(ledger);
  const held = e.reservations[id];
  if (!held || held.runId !== env.GITHUB_RUN_ID ||
      !Number.isSafeInteger(held.holdMicroUsd) ||
      held.holdMicroUsd <= 0 ||
      e.batches.some(b=>b?.id === id)) throw Error("qa_settle_unreserved");
  let charge = held.holdMicroUsd;
  if (localReceipt?.version === 1 &&
      Number.isSafeInteger(localReceipt.committedMicroUsd) &&
      localReceipt.committedMicroUsd >= 0 &&
      localReceipt.committedMicroUsd <= held.holdMicroUsd &&
      Number.isSafeInteger(localReceipt.requestsStarted) &&
      localReceipt.requestsStarted > 0) charge = localReceipt.committedMicroUsd;
  const next = structuredClone(ledger), extra = next.extraOwnerQa20261022;
  extra.usedMicroUsd += charge;
  extra.reservedMicroUsd -= held.holdMicroUsd;
  delete extra.reservations[id];
  extra.batches.push({
    id, runId: env.GITHUB_RUN_ID, chargeMicroUsd: charge,
    ownerApprovalRef: held.ownerApprovalRef, testSet: held.testSet,
  });
  return { ledger: next, chargeMicroUsd: charge };
}
