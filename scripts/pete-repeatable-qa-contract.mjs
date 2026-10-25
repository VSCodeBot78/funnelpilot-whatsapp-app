/**
 * Reusable, offline-only Pete QA approval ledger contract.
 * Does not make OpenAI calls or grant consent by itself.
 * A human must approve each run budget, and the caller must persist
 * the reservation to the shared ledger before any API request.
 */
import crypto from "node:crypto";

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
  if (request?.version === 2) return checkGrantAdmission(env, ledger, request);
  assertSafeEnvironment(env);
  if (!request || request.version !== 1 ||
      !["sales20", "sales32", "focus15"].includes(request.testSet) ||
      typeof request.ownerApprovalRef !== "string" ||
      !/^owner:[a-z0-9-]{8,80}$/.test(request.ownerApprovalRef))
    throw Error("qa_approval_required");
  const micro = parseQaBudgetMicros(request.budgetUsd);
  const extra = validateLedger(ledger);
  const id = "pete-qa-" + env.GITHUB_RUN_ID;
  if (ledger.qaOwnerGrantsV1 !== undefined) {
    const { registry, runs } = validateGrantRegistry(ledger);
    if (runs.has(env.GITHUB_RUN_ID) || Object.values(registry).some(g => g.reservedMicroUsd !== 0))
      throw Error("qa_spending_or_duplicate_denied");
  }
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
  if (request?.version === 2) {
    const ticket = checkGrantAdmission(env, ledger, request);
    const next = structuredClone(ledger), grant = next.qaOwnerGrantsV1[ticket.ownerGrantId];
    appendGrantEvent(grant, { kind: "reserve", ticket });
    return { ledger: next, ticket };
  }
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
  if (Object.values(ledger?.qaOwnerGrantsV1 ?? {}).some(g =>
    Object.hasOwn(g?.reservations ?? {}, "pete-qa-" + env.GITHUB_RUN_ID)))
    return settleGrantReservation(env, ledger, localReceipt);
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

// V2 is an additive, separate owner-QA account. V1 and its historical
// authorization amounts above remain unchanged. Only the reviewed git ledger
// supplies a grant; request/env/lead text cannot create or enlarge one.
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
  return JSON.stringify(value);
}
export const peteQaDigest = value => crypto.createHash("sha256").update(canonical(value)).digest("hex");
const whole = n => Number.isSafeInteger(n) && n >= 0;
const object = o => o && typeof o === "object" && !Array.isArray(o);
const sha = s => typeof s === "string" && /^[0-9a-f]{40}$/.test(s);
const digest = s => typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
const grantIdValid = s => typeof s === "string" && /^qa-[a-z0-9-]{8,80}$/.test(s);
const approvalValid = s => typeof s === "string" && /^owner:[a-z0-9-]{8,80}$/.test(s);
const suites = ["sales20", "sales32", "focus15"];

function grantAuthorization(g) {
  return { grantId: g.grantId, ownerApprovalRef: g.ownerApprovalRef,
    approvalEvidenceUrl: g.approvalEvidenceUrl, capMicroUsd: g.capMicroUsd,
    purpose: g.purpose, model: g.model, repository: g.repository };
}
/** Pure preparation, NOT authorization. Caller must verify the actual owner
 * approval and publish this record with the normal reviewed ledger write. */
export function createPeteQaOwnerGrant(approval) {
  const grant = { ...approval, purpose: "pete-synthetic-sol-qa", model: MODEL,
    repository: APPROVED_REPO, usedMicroUsd: 0, reservedMicroUsd: 0,
    reservations: {}, batches: [], history: [] };
  grant.approvalSha256 = peteQaDigest(grantAuthorization(grant));
  grant.historySha256 = grant.approvalSha256;
  validateGrant(grant, grant.grantId);
  return grant;
}
function parseGrantBudget(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,8})\.[0-9]{2}$/.test(value))
    throw Error("qa_grant_amount_invalid");
  const [dollars, cents] = value.split(".");
  const micro = Number(dollars) * MICRO + Number(cents) * 10_000;
  if (!whole(micro) || micro < 10_000) throw Error("qa_grant_amount_invalid");
  return micro;
}
function assertGrantEnvironment(env) {
  assertSafeEnvironment(env);
  if (env.GITHUB_EVENT_NAME !== "push" || !sha(env.GITHUB_SHA) ||
      env.INSTAGRAM_AUTO_ENABLE_NEW_LEADS !== "false" ||
      env.WHATSAPP_ALLOW_ALL_RECIPIENTS !== "false" ||
      env.INSTAGRAM_ALLOW_ALL_SENDERS !== "false" ||
      env.DISABLE_DESTRUCTIVE_ROUTES !== "true") throw Error("qa_grant_environment_unsafe");
}
function ticketBinding(ticket) {
  const { bindingSha256, ...rest } = ticket;
  return peteQaDigest(rest);
}
function validateGrant(g, id) {
  if (!object(g) || !grantIdValid(id) || g.grantId !== id ||
      !approvalValid(g.ownerApprovalRef) ||
      typeof g.approvalEvidenceUrl !== "string" ||
      !/^https:\/\/github\.com\/VSCodeBot78\/funnelpilot-whatsapp-app\/pull\/191#issuecomment-[0-9]+$/.test(g.approvalEvidenceUrl) ||
      !whole(g.capMicroUsd) || g.capMicroUsd <= 0 ||
      g.purpose !== "pete-synthetic-sol-qa" || g.model !== MODEL ||
      g.repository !== APPROVED_REPO ||
      !whole(g.usedMicroUsd) || !whole(g.reservedMicroUsd) ||
      !object(g.reservations) || !Array.isArray(g.batches) || !Array.isArray(g.history) ||
      !digest(g.approvalSha256) || g.approvalSha256 !== peteQaDigest(grantAuthorization(g)))
    throw Error("qa_grant_invalid");
  const reservations = {}, batches = [], seen = new Set();
  let used = 0, reserved = 0, previousSha256 = g.approvalSha256;
  for (const event of g.history) {
    if (!object(event)) throw Error("qa_grant_history_invalid");
    const { sha256, ...body } = event;
    if (event.previousSha256 !== previousSha256 || sha256 !== peteQaDigest(body))
      throw Error("qa_grant_history_invalid");
    previousSha256 = sha256;
    if (event.kind === "reserve") {
      const ticket = event.ticket;
      if (!object(ticket) || ticket.id !== "pete-qa-" + ticket.runId ||
          !/^[0-9]{5,}$/.test(ticket.runId ?? "") || seen.has(ticket.runId) ||
          ticket.ownerGrantId !== id || ticket.ownerApprovalRef !== g.ownerApprovalRef ||
          ticket.approvalSha256 !== g.approvalSha256 ||
          !sha(ticket.sourceSha) || !suites.includes(ticket.testSet) ||
          !whole(ticket.micro) || ticket.micro <= 0 ||
          ticket.previousHistorySha256 !== event.previousSha256 ||
          ticket.bindingSha256 !== ticketBinding(ticket) ||
          reserved !== 0 || used + ticket.micro > g.capMicroUsd)
        throw Error("qa_grant_history_invalid");
      seen.add(ticket.runId);
      reservations[ticket.id] = { ...ticket, status: "reserved" };
      reserved += ticket.micro;
    } else {
      const held = reservations[event.id];
      if (!held || held.status !== "reserved" ||
          event.bindingSha256 !== held.bindingSha256) throw Error("qa_grant_history_invalid");
      if (event.kind === "uncertain") {
        reservations[event.id] = { ...held, status: "uncertain" };
      } else if (event.kind === "settle" && whole(event.chargeMicroUsd) &&
          event.chargeMicroUsd <= held.micro && digest(event.receiptSha256)) {
        used += event.chargeMicroUsd;
        reserved -= held.micro;
        delete reservations[event.id];
        batches.push({ ...held, status: "settled", chargeMicroUsd: event.chargeMicroUsd,
          receiptSha256: event.receiptSha256 });
      } else throw Error("qa_grant_history_invalid");
    }
  }
  if (g.historySha256 !== previousSha256 || used !== g.usedMicroUsd ||
      reserved !== g.reservedMicroUsd || used + reserved > g.capMicroUsd ||
      canonical(reservations) !== canonical(g.reservations) ||
      canonical(batches) !== canonical(g.batches)) throw Error("qa_grant_history_inconsistent");
  return g;
}
function appendGrantEvent(g, event) {
  // Keep one deterministic, hash-linked audit trail. Reconstruct all counters
  // from the events rather than trusting a lower user-supplied "used" value.
  const body = { ...event, previousSha256: g.historySha256 };
  const item = { ...body, sha256: peteQaDigest(body) };
  if (event.kind === "reserve") {
    const ticket = event.ticket;
    g.reservations[ticket.id] = { ...ticket, status: "reserved" };
    g.reservedMicroUsd += ticket.micro;
  } else {
    const held = g.reservations[event.id];
    if (event.kind === "uncertain") held.status = "uncertain";
    else {
      g.usedMicroUsd += event.chargeMicroUsd;
      g.reservedMicroUsd -= held.micro;
      delete g.reservations[event.id];
      g.batches.push({ ...held, status: "settled", chargeMicroUsd: event.chargeMicroUsd,
        receiptSha256: event.receiptSha256 });
    }
  }
  g.history.push(item);
  g.historySha256 = item.sha256;
  validateGrant(g, g.grantId);
}
function validateGrantRegistry(ledger) {
  const extra = validateLedger(ledger);
  if (extra.batches.some(b => !whole(b?.chargeMicroUsd)) ||
      extra.batches.reduce((sum, b) => sum + b.chargeMicroUsd, 0) !== extra.usedMicroUsd)
    throw Error("qa_legacy_history_inconsistent");
  const registry = ledger.qaOwnerGrantsV1;
  if (!object(registry)) throw Error("qa_grants_missing");
  const runs = new Set(), approvals = new Set();
  for (const record of [...extra.batches, ...Object.values(extra.reservations)])
    if (record.runId) runs.add(record.runId);
  for (const [id, value] of Object.entries(registry)) {
    const g = validateGrant(value, id);
    if (approvals.has(g.ownerApprovalRef)) throw Error("qa_duplicate_grant_approval");
    approvals.add(g.ownerApprovalRef);
    for (const event of g.history.filter(e => e.kind === "reserve")) {
      if (runs.has(event.ticket.runId)) throw Error("qa_duplicate_run");
      runs.add(event.ticket.runId);
    }
  }
  return { registry, extra, runs };
}
function selectedGrant(env, ledger, request) {
  assertGrantEnvironment(env);
  const { registry, extra, runs } = validateGrantRegistry(ledger);
  if (!object(request) || request.version !== 2 || !grantIdValid(request.ownerGrantId) ||
      !approvalValid(request.ownerApprovalRef) || !suites.includes(request.testSet) ||
      !digest(request.grantApprovalSha256) || !Object.hasOwn(registry, request.ownerGrantId))
    throw Error("qa_grant_approval_required");
  const g = registry[request.ownerGrantId], micro = parseGrantBudget(request.budgetUsd);
  if (g.ownerApprovalRef !== request.ownerApprovalRef ||
      g.approvalSha256 !== request.grantApprovalSha256 || micro > g.capMicroUsd)
    throw Error("qa_grant_approval_mismatch");
  return { g, micro, registry, extra, runs };
}
function checkGrantAdmission(env, ledger, request) {
  const { g, micro, registry, extra, runs } = selectedGrant(env, ledger, request);
  if (extra.reservedMicroUsd !== 0 ||
      Object.values(registry).some(grant => grant.reservedMicroUsd !== 0) ||
      runs.has(env.GITHUB_RUN_ID) || g.usedMicroUsd + micro > g.capMicroUsd)
    throw Error("qa_grant_spending_or_duplicate_denied");
  const ticket = { id: "pete-qa-" + env.GITHUB_RUN_ID, micro, runId: env.GITHUB_RUN_ID,
    testSet: request.testSet, ownerGrantId: g.grantId, ownerApprovalRef: g.ownerApprovalRef,
    approvalSha256: g.approvalSha256, sourceSha: env.GITHUB_SHA,
    previousHistorySha256: g.historySha256 };
  return { ...ticket, bindingSha256: ticketBinding(ticket) };
}
/** Only useful after the adapter has proved the exact ledger is remotely
 * committed. This function alone is never a provider authorization. */
export function checkPeteQaGrantHeld(env, ledger, request) {
  const { g, micro, registry, extra } = selectedGrant(env, ledger, request);
  const held = g.reservations["pete-qa-" + env.GITHUB_RUN_ID];
  if (!held || held.status !== "reserved" || held.micro !== micro ||
      held.sourceSha !== env.GITHUB_SHA || held.testSet !== request.testSet ||
      extra.reservedMicroUsd !== 0 ||
      Object.values(registry).reduce((sum, grant) => sum + grant.reservedMicroUsd, 0) !== micro)
    throw Error("qa_grant_remote_hold_required");
  return held;
}
function authenticGrantReceipt(receipt, held) {
  if (!object(receipt) || receipt.version !== 1 || receipt.capMicroUsd !== held.micro ||
      receipt.priorSpentMicroUsd !== 0 || receipt.accountingError !== undefined ||
      canonical(receipt.qaGrant) !== canonical(held) ||
      !whole(receipt.requestsStarted) || receipt.requestsStarted < 1 ||
      receipt.requestsMetered !== receipt.requestsStarted ||
      !whole(receipt.confirmedMicroUsd) || receipt.confirmedMicroUsd > held.micro ||
      receipt.committedMicroUsd !== receipt.confirmedMicroUsd ||
      receipt.reservedMicroUsd !== 0 || !object(receipt.pending) ||
      Object.keys(receipt.pending).length !== 0 ||
      !whole(receipt.billedInputTokens) || !whole(receipt.billedOutputTokens) ||
      receipt.confirmedMicroUsd !== receipt.billedInputTokens * 2 + receipt.billedOutputTokens * 10)
    return false;
  return true;
}
function settleGrantReservation(env, ledger, receipt) {
  assertGrantEnvironment(env);
  const { registry } = validateGrantRegistry(ledger);
  const id = "pete-qa-" + env.GITHUB_RUN_ID;
  const matches = Object.values(registry).filter(g => Object.hasOwn(g.reservations, id));
  if (matches.length !== 1) throw Error("qa_grant_settle_unreserved");
  const g = matches[0], held = g.reservations[id];
  if (held.status !== "reserved" || held.sourceSha !== env.GITHUB_SHA)
    throw Error("qa_grant_settle_replay_or_source_mismatch");
  const verified = authenticGrantReceipt(receipt, held);
  const next = structuredClone(ledger), grant = next.qaOwnerGrantsV1[g.grantId];
  appendGrantEvent(grant, verified
    ? { kind: "settle", id, bindingSha256: held.bindingSha256,
      chargeMicroUsd: receipt.committedMicroUsd, receiptSha256: peteQaDigest(receipt) }
    : { kind: "uncertain", id, bindingSha256: held.bindingSha256 });
  return { ledger: next, chargeMicroUsd: verified ? receipt.committedMicroUsd : null,
    settlement: verified ? "settled" : "uncertain_reservation_retained" };
}

/** The adapter supplies the complete, remote-confirmed git history, oldest
 * first. A hash alone is not an authenticity proof: resets/rehashed rewrites,
 * removed grants and changes to an approved cap are rejected against git. */
export function verifyPeteQaGrantHistory(snapshots) {
  let previous = {}, legacySha256 = null;
  for (const ledger of snapshots) {
    const { qaOwnerGrantsV1, ...legacy } = ledger;
    const historicalSha = peteQaDigest(legacy);
    if (legacySha256 !== null && historicalSha !== legacySha256)
      throw Error("qa_legacy_budget_rewritten");
    legacySha256 = historicalSha;
    if (!ledger.qaOwnerGrantsV1) {
      if (Object.keys(previous).length) throw Error("qa_grant_history_removed");
      continue;
    }
    const { registry } = validateGrantRegistry(ledger);
    for (const id of Object.keys(previous)) {
      const before = previous[id], after = registry[id];
      if (!after || after.approvalSha256 !== before.approvalSha256 ||
          canonical(after.history.slice(0, before.history.length)) !== canonical(before.history))
        throw Error("qa_grant_history_rewritten");
    }
    for (const [id, grant] of Object.entries(registry)) {
      if (!Object.hasOwn(previous, id) &&
          (grant.history.length !== 0 || grant.usedMicroUsd !== 0 || grant.reservedMicroUsd !== 0))
        throw Error("qa_grant_must_start_unused");
    }
    previous = registry;
  }
}
