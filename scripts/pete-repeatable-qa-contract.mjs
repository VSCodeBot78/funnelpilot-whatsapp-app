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

/** Variable per-run costs are limited by a separately recorded founder grant.
 * The grant is added to the git-backed budget register on founder approval;
 * future approvals never require a code change. Legacy approvals stay intact.
 */
function parseGrantRunMicros(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,4})\.[0-9]{2}$/.test(value))
    throw Error("qa_grant_amount_format_invalid");
  const micros = Math.round(Number(value) * MICRO);
  if (!Number.isSafeInteger(micros) || micros < 10_000)
    throw Error("qa_grant_amount_out_of_range");
  return micros;
}

function getOwnerQaGrant(ledger, id) {
  if (typeof id !== "string" || !/^qa-[a-z0-9-]{8,80}$/.test(id))
    throw Error("qa_grant_id_invalid");
  const grants = ledger.qaOwnerGrantsV1;
  if (!grants || typeof grants !== "object" || Array.isArray(grants)) throw Error("qa_grants_missing");
  const grant = Object.hasOwn(grants, id) ? grants[id] : null;
  if (!grant || typeof grant !== "object" || Array.isArray(grant) ||
      !/^owner:[a-z0-9-]{8,80}$/.test(grant.ownerApprovalRef ?? "") ||
      !Number.isSafeInteger(grant.capMicroUsd) || grant.capMicroUsd <= 0 ||
      !Number.isSafeInteger(grant.usedMicroUsd) || grant.usedMicroUsd < 0 ||
      !Number.isSafeInteger(grant.reservedMicroUsd) || grant.reservedMicroUsd < 0 ||
      !grant.reservations || typeof grant.reservations !== "object" ||
      Array.isArray(grant.reservations) || !Array.isArray(grant.batches))
    throw Error("qa_grant_invalid");
  const totalHeld = Object.values(grant.reservations).reduce((sum, hold) =>
    sum + (Number.isSafeInteger(hold?.holdMicroUsd) && hold.holdMicroUsd > 0
      ? hold.holdMicroUsd : Number.NaN), 0);
  if (totalHeld !== grant.reservedMicroUsd ||
      grant.usedMicroUsd + grant.reservedMicroUsd > grant.capMicroUsd ||
      new Set(grant.batches.map(b => b?.id)).size !== grant.batches.length)
    throw Error("qa_grant_ledger_inconsistent");
  return grant;
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
  const extra = validateLedger(ledger);
  const id = "pete-qa-" + env.GITHUB_RUN_ID;
  if (request.ownerGrantId !== undefined) {
    const grant = getOwnerQaGrant(ledger, request.ownerGrantId);
    const micro = parseGrantRunMicros(request.budgetUsd);
    if (grant.ownerApprovalRef !== request.ownerApprovalRef ||
        grant.reservedMicroUsd !== 0 ||
        grant.usedMicroUsd + micro > grant.capMicroUsd ||
        grant.reservations[id] ||
        grant.batches.some(b => b?.id === id || b?.runId === env.GITHUB_RUN_ID) ||
        extra.reservations[id] || extra.batches.some(b => b?.id === id || b?.runId === env.GITHUB_RUN_ID))
      throw Error("qa_grant_spending_or_duplicate_denied");
    return { id, micro, runId: env.GITHUB_RUN_ID, testSet: request.testSet,
      ownerGrantId: request.ownerGrantId };
  }
  const micro = parseQaBudgetMicros(request.budgetUsd);
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
  const e = ticket.ownerGrantId
    ? getOwnerQaGrant(next, ticket.ownerGrantId)
    : next.extraOwnerQa20261022;
  e.reservations[ticket.id] = {
    runId: ticket.runId, holdMicroUsd: ticket.micro, testSet: ticket.testSet,
    ownerApprovalRef: request.ownerApprovalRef,
    ...(ticket.ownerGrantId ? { ownerGrantId: ticket.ownerGrantId } : {}),
  };
  e.reservedMicroUsd += ticket.micro;
  return { ledger: next, ticket };
}
/** Never silently refund unknown usage; uncertain calls consume the whole hold. */
export function settlePeteQaReservation(env, ledger, localReceipt) {
  if (env.GITHUB_RUN_ATTEMPT !== "1") throw Error("qa_attempt_reuse_denied");
  const id = "pete-qa-" + env.GITHUB_RUN_ID;
  const old = validateLedger(ledger);
  const grantIds = Object.keys(ledger.qaOwnerGrantsV1 ?? {}).filter(g =>
    ledger.qaOwnerGrantsV1[g]?.reservations?.[id]);
  if (grantIds.length > 1 || (grantIds.length === 1 && old.reservations[id]))
    throw Error("qa_multiple_budget_sources");
  const grantId = grantIds[0];
  const e = grantId ? getOwnerQaGrant(ledger, grantId) : old;
  const held = e.reservations[id];
  if (!held || held.runId !== env.GITHUB_RUN_ID ||
      !Number.isSafeInteger(held.holdMicroUsd) ||
      held.holdMicroUsd <= 0 ||
      (grantId && held.ownerGrantId !== grantId) ||
      e.batches.some(b=>b?.id === id)) throw Error("qa_settle_unreserved");
  let charge = held.holdMicroUsd;
  if (localReceipt?.version === 1 &&
      Number.isSafeInteger(localReceipt.committedMicroUsd) &&
      localReceipt.committedMicroUsd >= 0 &&
      localReceipt.committedMicroUsd <= held.holdMicroUsd &&
      Number.isSafeInteger(localReceipt.requestsStarted) &&
      localReceipt.requestsStarted > 0) charge = localReceipt.committedMicroUsd;
  const next = structuredClone(ledger);
  const extra = grantId ? getOwnerQaGrant(next, grantId) : next.extraOwnerQa20261022;
  extra.usedMicroUsd += charge;
  extra.reservedMicroUsd -= held.holdMicroUsd;
  delete extra.reservations[id];
  extra.batches.push({
    id, runId: env.GITHUB_RUN_ID, chargeMicroUsd: charge,
    ownerApprovalRef: held.ownerApprovalRef, testSet: held.testSet,
    ...(grantId ? { ownerGrantId: grantId } : {}),
  });
  return { ledger: next, chargeMicroUsd: charge };
}
