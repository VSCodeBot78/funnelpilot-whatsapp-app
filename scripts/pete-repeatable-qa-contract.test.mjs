import assert from "node:assert/strict";
import test from "node:test";
import {
  parseQaBudgetMicros, checkPeteQaAdmission,
  preparePeteQaReservation, settlePeteQaReservation,
} from "./pete-repeatable-qa-contract.mjs";

const request = () => ({
  version: 1, budgetUsd: "2.00", testSet: "sales32",
  ownerApprovalRef: "owner:2026-10-23-test-go-2usd",
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
