import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  parseQaBudgetMicros, checkPeteQaAdmission,
  preparePeteQaReservation, settlePeteQaReservation,
  createPeteQaOwnerGrant, checkPeteQaGrantHeld, verifyPeteQaGrantHistory, peteQaDigest,
} from "./pete-repeatable-qa-contract.mjs";

const request = () => ({
  version: 1, budgetUsd: "2.00", testSet: "sales32",
  ownerApprovalRef: "owner:2026-10-23-test-go-2usd",
});

const grantId = "qa-20261025-owner-sol-separate-3usd";
const grantEnv = (runId = "710001") => ({ ...env(), GITHUB_RUN_ID: runId,
  GITHUB_SHA: "a".repeat(40), INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "false",
  WHATSAPP_ALLOW_ALL_RECIPIENTS: "false", INSTAGRAM_ALLOW_ALL_SENDERS: "false",
  DISABLE_DESTRUCTIVE_ROUTES: "true" });
function grantLedger() {
  const l = ledger();
  l.extraOwnerQa20261022.usedMicroUsd = 4_882_540;
  l.extraOwnerQa20261022.batches[0].chargeMicroUsd = 4_882_540;
  l.qaOwnerGrantsV1 = { [grantId]: createPeteQaOwnerGrant({
    grantId, ownerApprovalRef: "owner:2026-10-25-separate-sol-3usd",
    approvalEvidenceUrl: "https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/pull/191#issuecomment-6400728469",
    capMicroUsd: 3_000_000,
  }) };
  return l;
}
const grantRequest = (l, budgetUsd = "2.00") => ({ version: 2, budgetUsd,
  testSet: "sales20", ownerGrantId: grantId,
  ownerApprovalRef: l.qaOwnerGrantsV1[grantId].ownerApprovalRef,
  grantApprovalSha256: l.qaOwnerGrantsV1[grantId].approvalSha256 });
function receipt(l, runId, charge = 1_000_000) {
  const hold = l.qaOwnerGrantsV1[grantId].reservations["pete-qa-" + runId];
  return { version: 1, priorSpentMicroUsd: 0, capMicroUsd: hold.micro,
    committedMicroUsd: charge, confirmedMicroUsd: charge, reservedMicroUsd: 0,
    requestsStarted: 1, requestsMetered: 1, billedInputTokens: charge / 2,
    billedOutputTokens: 0, pending: {}, qaGrant: structuredClone(hold) };
}

test("Separate QA grant: USD2 then USD1 share one USD3 approval without a legacy reset", () => {
  const original = grantLedger(), r = grantRequest(original);
  const first = preparePeteQaReservation(grantEnv(), original, r).ledger;
  assert.deepEqual(first.extraOwnerQa20261022, original.extraOwnerQa20261022);
  assert.equal(first.spentMicroUsd, 7_817_830);
  assert.equal(checkPeteQaGrantHeld(grantEnv(), first, r).micro, 2_000_000);
  const settled = settlePeteQaReservation(grantEnv(), first, receipt(first, "710001", 2_000_000)).ledger;
  const secondEnv = grantEnv("710002");
  const second = preparePeteQaReservation(secondEnv, settled, grantRequest(settled, "1.00")).ledger;
  const completed = settlePeteQaReservation(secondEnv, second, receipt(second, "710002")).ledger;
  assert.equal(completed.qaOwnerGrantsV1[grantId].usedMicroUsd, 3_000_000);
  assert.equal(completed.qaOwnerGrantsV1[grantId].reservedMicroUsd, 0);
  assert.equal(completed.qaOwnerGrantsV1[grantId].batches.length, 2);
  assert.throws(() => checkPeteQaAdmission(grantEnv("710003"), completed, grantRequest(completed, "0.01")));
  const legacy = structuredClone(original); delete legacy.qaOwnerGrantsV1;
  verifyPeteQaGrantHistory([legacy, original, first, settled, second, completed]);
  assert.deepEqual(completed.extraOwnerQa20261022, original.extraOwnerQa20261022);
});
test("Separate QA grant: lower metered actual costs leave the proven unused amount available", () => {
  const l = grantLedger(), r = grantRequest(l);
  const held = preparePeteQaReservation(grantEnv(), l, r).ledger;
  const settled = settlePeteQaReservation(grantEnv(), held, receipt(held, "710001", 320_000)).ledger;
  assert.equal(settled.qaOwnerGrantsV1[grantId].usedMicroUsd, 320_000);
  assert.equal(checkPeteQaAdmission(grantEnv("710002"), settled, grantRequest(settled, "2.68")).micro, 2_680_000);
  assert.throws(() => checkPeteQaAdmission(grantEnv("710002"), settled, grantRequest(settled, "2.69")));
});
test("Separate QA grants: future amounts are ledger records, never source constants", () => {
  const l = grantLedger(), nextId = "qa-future-distinct-owner-approval";
  l.qaOwnerGrantsV1[nextId] = createPeteQaOwnerGrant({ grantId: nextId,
    ownerApprovalRef: "owner:future-explicit-approval",
    approvalEvidenceUrl: "https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/pull/191#issuecomment-9999999999",
    capMicroUsd: 9_000_000 });
  const g = l.qaOwnerGrantsV1[nextId];
  const r = { ...grantRequest(l, "9.00"), ownerGrantId: nextId,
    ownerApprovalRef: g.ownerApprovalRef, grantApprovalSha256: g.approvalSha256 };
  assert.equal(checkPeteQaAdmission(grantEnv(), l, r).micro, 9_000_000);
  assert.throws(() => checkPeteQaAdmission(grantEnv(), l, { ...r, budgetUsd: "9.01" }));
});
test("Separate QA grant: stale parallel reservation, same-run retry and changed source are denied", () => {
  const l = grantLedger(), r = grantRequest(l);
  const held = preparePeteQaReservation(grantEnv(), l, r).ledger;
  assert.throws(() => checkPeteQaAdmission(grantEnv(), held, r));
  assert.throws(() => checkPeteQaAdmission(grantEnv("710002"), held, r));
  assert.throws(() => checkPeteQaGrantHeld({ ...grantEnv(), GITHUB_SHA: "b".repeat(40) }, held, r));
  const settled = settlePeteQaReservation(grantEnv(), held, receipt(held, "710001")).ledger;
  assert.throws(() => checkPeteQaAdmission(grantEnv(), settled, r));
  assert.throws(() => settlePeteQaReservation(grantEnv(), settled, receipt(held, "710001")));
  assert.throws(() => checkPeteQaAdmission({ ...grantEnv(), GITHUB_RUN_ATTEMPT: "2" }, settled, r));
});
test("Separate QA grant: grant/approval/amount/history tampering fails closed", () => {
  const l = grantLedger(), r = grantRequest(l);
  for (const patch of [{ ownerApprovalRef: "owner:some-other-approval" },
    { ownerGrantId: "qa-unknown-no-approval" }, { grantApprovalSha256: "0".repeat(64) },
    { budgetUsd: "3.01" }, { budgetUsd: "-1.00" }, { budgetUsd: "3e0" },
    { budgetUsd: 3 }, { testSet: "live-contacts" }])
    assert.throws(() => checkPeteQaAdmission(grantEnv(), l, { ...r, ...patch }));
  for (const patch of [{ usedMicroUsd: -1 }, { usedMicroUsd: 1 },
    { reservedMicroUsd: 3_000_001 }, { capMicroUsd: 4_000_000 },
    { historySha256: "0".repeat(64) }, { batches: [{ runId: "bad", chargeMicroUsd: -1 }] }]) {
    const altered = structuredClone(l); Object.assign(altered.qaOwnerGrantsV1[grantId], patch);
    assert.throws(() => checkPeteQaAdmission(grantEnv(), altered, r));
  }
  const oldReset = structuredClone(l); oldReset.extraOwnerQa20261022.usedMicroUsd = 0;
  assert.throws(() => checkPeteQaAdmission(grantEnv(), oldReset, r));
});
test("Separate QA grant: rehashed usage reset or enlarged cap is rejected by git history", () => {
  const l = grantLedger(), r = grantRequest(l);
  const held = preparePeteQaReservation(grantEnv(), l, r).ledger;
  const settled = settlePeteQaReservation(grantEnv(), held, receipt(held, "710001")).ledger;
  assert.throws(() => verifyPeteQaGrantHistory([l, held, settled, l]), /rewritten/);
  const enlarged = grantLedger(); enlarged.qaOwnerGrantsV1[grantId] = createPeteQaOwnerGrant({
    ...enlarged.qaOwnerGrantsV1[grantId], capMicroUsd: 4_000_000 });
  assert.throws(() => verifyPeteQaGrantHistory([l, enlarged]), /rewritten/);
  const modified = structuredClone(held); modified.qaOwnerGrantsV1[grantId].history[0].ticket.micro = 1;
  assert.throws(() => checkPeteQaGrantHeld(grantEnv(), modified, r));
  const legacyReset = structuredClone(l); legacyReset.extraOwnerQa20261022.batches = [];
  legacyReset.extraOwnerQa20261022.usedMicroUsd = 0;
  assert.throws(() => verifyPeteQaGrantHistory([l, legacyReset]), /legacy_budget_rewritten/);
});
test("Separate QA grant: timeout, lost or wrong receipt retains the full reservation; late settlement is blocked", () => {
  const l = grantLedger(), r = grantRequest(l);
  const held = preparePeteQaReservation(grantEnv(), l, r).ledger;
  const good = receipt(held, "710001");
  for (const bad of [null, {}, { ...good, requestsMetered: 0 },
    { ...good, qaGrant: { ...good.qaGrant, bindingSha256: "0".repeat(64) } },
    { ...good, confirmedMicroUsd: 0, committedMicroUsd: 0 },
    { ...good, confirmedMicroUsd: 0, committedMicroUsd: 0, billedInputTokens: 0, billedOutputTokens: 0 },
    { ...good, billedInputTokens: -1 }, { ...good, accountingError: true },
    { ...good, pending: { unknown: { microUsd: 1 } } }]) {
    const result = settlePeteQaReservation(grantEnv(), held, bad);
    assert.equal(result.settlement, "uncertain_reservation_retained");
    assert.equal(result.chargeMicroUsd, null);
    assert.equal(result.ledger.qaOwnerGrantsV1[grantId].reservedMicroUsd, 2_000_000);
    assert.equal(result.ledger.qaOwnerGrantsV1[grantId].usedMicroUsd, 0);
    assert.throws(() => checkPeteQaAdmission(grantEnv("710002"), result.ledger, r));
    assert.throws(() => settlePeteQaReservation(grantEnv(), result.ledger, good));
  }
});
test("Separate QA grant: run IDs cannot migrate into another grant or the legacy account", () => {
  const l = grantLedger(), r = grantRequest(l);
  const held = preparePeteQaReservation(grantEnv(), l, r).ledger;
  const settled = settlePeteQaReservation(grantEnv(), held, receipt(held, "710001")).ledger;
  const nextId = "qa-second-distinct-owner-approval";
  const next = createPeteQaOwnerGrant({ grantId: nextId, ownerApprovalRef: "owner:second-explicit-approval",
    approvalEvidenceUrl: "https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/pull/191#issuecomment-9999999999",
    capMicroUsd: 3_000_000 });
  settled.qaOwnerGrantsV1[nextId] = next;
  assert.throws(() => checkPeteQaAdmission(grantEnv(), settled, { ...r, ownerGrantId: nextId,
    ownerApprovalRef: next.ownerApprovalRef, grantApprovalSha256: next.approvalSha256 }));
  const migrated = structuredClone(l);
  migrated.extraOwnerQa20261022.batches.push({ runId: "710001", id: "pete-qa-710001", chargeMicroUsd: 0 });
  assert.throws(() => checkPeteQaAdmission(grantEnv(), migrated, r));
});
test("Separate QA grant: every unsafe environment flag is checked again", () => {
  const l = grantLedger(), r = grantRequest(l);
  for (const patch of [{ GITHUB_ACTIONS: "false" }, { GITHUB_EVENT_NAME: "workflow_dispatch" },
    { GITHUB_SHA: "" }, { GITHUB_REF: "refs/heads/main" }, { NODE_ENV: "production" },
    { OPENAI_MODEL: "gpt-4.1-mini" }, { INSTAGRAM_SEND_ENABLED: "true" },
    { INSTAGRAM_ENGINE_ENABLED: "true" }, { WHATSAPP_SEND_ENABLED: "true" },
    { ENABLE_GENERIC_WEBHOOKS: "true" }, { PETE_MOBILE_LAB_ENABLED: "true" },
    { INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "true" }, { INSTAGRAM_ALLOW_ALL_SENDERS: "true" },
    { WHATSAPP_ALLOW_ALL_RECIPIENTS: "true" }, { DISABLE_DESTRUCTIVE_ROUTES: "false" }])
    assert.throws(() => checkPeteQaAdmission({ ...grantEnv(), ...patch }, l, r));
});

test("Separate QA grant: actual competing git pushes admit exactly one remote reservation", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qa-grant-cas-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, "remote.git"), seed = path.join(root, "seed");
  const git = (cwd, args, accepted = true) => {
    const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
    if (accepted) assert.equal(r.status, 0, r.stderr);
    return r;
  };
  fs.mkdirSync(seed); fs.mkdirSync(remote);
  git(remote, ["init", "--bare", "--quiet"]); git(seed, ["init", "--quiet"]);
  const l = grantLedger(), r = grantRequest(l);
  const commit = (dir, value) => {
    fs.writeFileSync(path.join(dir, "phase3-budget-ledger.json"), JSON.stringify(value));
    git(dir, ["add", "phase3-budget-ledger.json"]);
    git(dir, ["-c", "user.name=QA fixture", "-c", "user.email=qa@example.invalid",
      "commit", "--quiet", "-m", "fixture reservation"]);
  };
  commit(seed, l); git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "--quiet", "origin", "HEAD:refs/heads/ledger"]);
  const jobs = [path.join(root, "job1"), path.join(root, "job2")];
  for (const directory of jobs) git(root, ["clone", "--quiet", "--branch", "ledger", remote, directory]);
  commit(jobs[0], preparePeteQaReservation(grantEnv("730001"), l, r).ledger);
  commit(jobs[1], preparePeteQaReservation(grantEnv("730002"), l, r).ledger);
  git(jobs[0], ["push", "--quiet", "origin", "HEAD:refs/heads/ledger"]);
  const loser = git(jobs[1], ["push", "--quiet", "origin", "HEAD:refs/heads/ledger"], false);
  assert.notEqual(loser.status, 0, "stale parallel job cannot overwrite a reservation");
  const persisted = JSON.parse(git(remote, ["show", "refs/heads/ledger:phase3-budget-ledger.json"]).stdout);
  assert.equal(persisted.qaOwnerGrantsV1[grantId].reservedMicroUsd, 2_000_000);
  assert.deepEqual(Object.keys(persisted.qaOwnerGrantsV1[grantId].reservations), ["pete-qa-730001"]);
  assert.deepEqual(persisted.extraOwnerQa20261022, l.extraOwnerQa20261022);
});
const env = () => ({
  GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push",
  GITHUB_REPOSITORY: "VSCodeBot78/funnelpilot-whatsapp-app",
  GITHUB_REF: "refs/heads/feat/pete-policy-v4-20261022",
  GITHUB_RUN_ATTEMPT: "1", GITHUB_RUN_ID: "700001",
  NODE_ENV: "test", OPENAI_MODEL: "gpt-6.1-sol",
  INSTAGRAM_SEND_ENABLED: "false", INSTAGRAM_ENGINE_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false", ENABLE_GENERIC_WEBHOOKS: "false",
  PETE_MOBILE_LAB_ENABLED: "false",
  PETE_LLM_CONVERSATION_ENABLED: "true", PETE_LLM_API_CALLS_APPROVED: "true",
});
const ledger = () => ({
  version: 1, capMicroUsd: 8_000_000, spentMicroUsd: 7_817_830,
  reservedMicroUsd: 0, activeReservations: {},
  extraOwnerQa20261022: {
    authorizedEur: 5, conservativeUsdCapMicro: 5_000_000,
    oldProjectCapMicroUsd: 8_000_000,
    oldProjectSpendAtApprovalMicroUsd: 7_817_830,
    usedMicroUsd: 861_926, reservedMicroUsd: 0,
    reservations: {}, batches: [
      { id: "historical-once-1", runId: "100000", chargeMicroUsd: 861_926 },
    ],
  },
});

test("Paid QA trigger requires deployment suppression and explicit QA intent together", () => {
  const workflow = fs.readFileSync(new URL("../.github/workflows/pete-repeatable-sol-qa.yml", import.meta.url), "utf8");
  const prefix = workflow.match(/startsWith\(github\.event\.head_commit\.message, '([^']+)'\)/)?.[1];
  assert.equal(prefix, "[CF-Pages-Skip] PETE_QA_APPROVED_RUN:");
  const starts = message => message.startsWith(prefix);
  assert.equal(starts("[CF-Pages-Skip] PETE_QA_APPROVED_RUN: owner authorized"), true);
  for (const message of ["PETE_QA_APPROVED_RUN: old unprotected trigger", "[CF-Pages-Skip] ordinary fix",
    "x[CF-Pages-Skip] PETE_QA_APPROVED_RUN:", "[CF-Pages-Skip] PETE_QA_APPROVED_RUN "])
    assert.equal(starts(message), false);
  assert.match(workflow, /github\.run_attempt == 1/);
  assert.match(workflow, /git -C budget-ledger push origin HEAD:pete-phase3-budget-ledger/);
  assert.match(workflow, /WHATSAPP_SEND_ENABLED: "false"/);
  assert.match(workflow, /INSTAGRAM_SEND_ENABLED: "false"/);
});

test("Repeatable QA accepts only a bounded explicit amount in whole cents", () => {
  assert.equal(parseQaBudgetMicros("0.10"), 100_000);
  assert.equal(parseQaBudgetMicros("2.00"), 2_000_000);
  for (const bad of ["0.00", "2.01", "3.00", "2", "2.000",
    "02.00", "-1.00", "1.2", "NaN", "Infinity", 2, null]) {
    assert.throws(() => parseQaBudgetMicros(bad), undefined, String(bad));
  }
});

test("Repeatable QA rejects wrong refs, reposts, unsafe sends, unknown models and retry", () => {
  const good = env();
  for (const patch of [
    { GITHUB_ACTIONS: "false" }, { GITHUB_REPOSITORY: "other/repo" },
    { GITHUB_REF: "refs/heads/main" }, { GITHUB_EVENT_NAME: "schedule" },
    { GITHUB_RUN_ATTEMPT: "2" }, { GITHUB_RUN_ID: "" },
    { OPENAI_MODEL: "gpt-4.1-mini" }, { NODE_ENV: "production" },
    { INSTAGRAM_SEND_ENABLED: "true" }, { INSTAGRAM_ENGINE_ENABLED: "true" },
    { WHATSAPP_SEND_ENABLED: "true" }, { ENABLE_GENERIC_WEBHOOKS: "true" },
    { PETE_MOBILE_LAB_ENABLED: "true" }, { PETE_LLM_API_CALLS_APPROVED: "false" },
  ]) {
    assert.throws(() => checkPeteQaAdmission({ ...good, ...patch }, ledger(), request()),
      undefined, JSON.stringify(patch));
  }
});

test("Repeatable QA requires user approval, known test suite and remaining historical cap", () => {
  for (const patch of [
    { ownerApprovalRef: "" }, { ownerApprovalRef: "self approved" },
    { version: 2 }, { testSet: "live-contacts" }, { budgetUsd: "2.50" },
  ]) {
    assert.throws(() => checkPeteQaAdmission(env(), ledger(), { ...request(), ...patch }));
  }
  const almostSpent = ledger();
  almostSpent.extraOwnerQa20261022.usedMicroUsd = 4_000_000;
  assert.throws(() => checkPeteQaAdmission(env(), almostSpent, request()));
  const alteredHistory = ledger();
  alteredHistory.spentMicroUsd = 0;
  assert.throws(() => checkPeteQaAdmission(env(), alteredHistory, request()));
  const tampered = ledger();
  tampered.extraOwnerQa20261022.reservedMicroUsd = 200_000;
  assert.throws(() => checkPeteQaAdmission(env(), tampered, request()));
});

test("Repeatable QA reserves exactly once and denies concurrent spending", () => {
  const start = ledger();
  const { ledger: held, ticket } = preparePeteQaReservation(env(), start, request());
  assert.equal(ticket.micro, 2_000_000);
  assert.equal(start.extraOwnerQa20261022.reservedMicroUsd, 0, "must not mutate baseline");
  assert.equal(held.extraOwnerQa20261022.reservedMicroUsd, 2_000_000);
  assert.throws(() => checkPeteQaAdmission(env(), held, request()));
  assert.throws(() => checkPeteQaAdmission({ ...env(), GITHUB_RUN_ID: "700002" }, held, request()));
});

test("Repeatable QA settles an authentic receipt, and replay remains blocked", () => {
  const { ledger: held } = preparePeteQaReservation(env(), ledger(), request());
  const result = settlePeteQaReservation(env(), held, {
    version: 1, committedMicroUsd: 320_000, requestsStarted: 40,
  });
  assert.equal(result.chargeMicroUsd, 320_000);
  assert.equal(result.ledger.extraOwnerQa20261022.reservedMicroUsd, 0);
  assert.equal(result.ledger.extraOwnerQa20261022.usedMicroUsd, 1_181_926);
  assert.throws(() => checkPeteQaAdmission(env(), result.ledger, request()));
  assert.throws(() => settlePeteQaReservation(env(), result.ledger, null));
  assert.equal(held.extraOwnerQa20261022.reservedMicroUsd, 2_000_000);
});

test("Missing receipt burns full amount, retries never create fresh approval", () => {
  const { ledger: held } = preparePeteQaReservation(env(), ledger(), request());
  assert.throws(() => settlePeteQaReservation({ ...env(), GITHUB_RUN_ATTEMPT: "2" }, held, null));
  const { ledger: settled, chargeMicroUsd } = settlePeteQaReservation(env(), held, null);
  assert.equal(chargeMicroUsd, 2_000_000);
  assert.equal(settled.extraOwnerQa20261022.usedMicroUsd, 2_861_926);
  assert.equal(settled.extraOwnerQa20261022.reservedMicroUsd, 0);
});


test("Targeted 15-case retest retains fresh owner consent and USD0.75 ceiling", () => {
  const approval = {
    version: 1, testSet: "focus15", budgetUsd: "0.75",
    ownerApprovalRef: "owner:2026-10-23-focus15-075usd",
  };
  const { ledger: held, ticket } = preparePeteQaReservation(env(), ledger(), approval);
  assert.equal(ticket.micro, 750_000);
  assert.equal(ticket.testSet, "focus15");
  assert.equal(held.extraOwnerQa20261022.reservedMicroUsd, 750_000);
  assert.equal(held.extraOwnerQa20261022.reservations["pete-qa-700001"].ownerApprovalRef,
    approval.ownerApprovalRef);
  assert.throws(() => checkPeteQaAdmission(
    { ...env(), GITHUB_RUN_ID: "700002" }, held, approval));
  const { ledger: settled, chargeMicroUsd } = settlePeteQaReservation(env(), held, {
    version: 1, committedMicroUsd: 412_000, requestsStarted: 23,
  });
  assert.equal(chargeMicroUsd, 412_000);
  assert.equal(settled.extraOwnerQa20261022.reservedMicroUsd, 0);
  assert.equal(settled.extraOwnerQa20261022.batches.at(-1).testSet, "focus15");
  assert.throws(() => checkPeteQaAdmission(
    { ...env(), GITHUB_RUN_ID: "700003" }, settled, approval),
    "a consent token may not be reused for a second run");
});
