import assert from "node:assert/strict";
import test from "node:test";
import { runQaDialogues, validateQaCases, type QaBudget } from "./pete-repeatable-qa-evidence.js";

const cases = [{ id: "free-parent", lines: ["Ich bin oft muede", "Meine Kinder schlafen schlecht"] }];
const budget = (): QaBudget => ({ ok: true, blocked: false, requestsStarted: 0,
  requestsMetered: 0, inputTokens: 0, outputTokens: 0, confirmedUsd: 0, reservedUsd: 0 });
function reply(text: string | null, answers: Record<string, unknown>, reason?: string) {
  return { text, state: { answers, flags: { stopped: false } }, replySuppressedReason: reason };
}
test("QA never counts stale LLM provenance after a suppressed human/STOP turn", async () => {
  const b = budget();
  const r = await runQaDialogues({ cases, budget: () => b,
    reply: async () => reply(null, { peteReplySource: "llm", peteProviderUsageMetered: true,
      peteProviderModel: "gpt-6.1-sol", peteProviderInputTokens: 80, peteProviderOutputTokens: 10 }, "human_owned") });
  assert.equal(r.modelResponses, 0); assert.equal(r.providerResponses, 0);
  assert.equal(r.suppressedTurns, 2); assert.deepEqual(r.sourceCounts, {});
});
test("QA keeps a partial transcript and metered cost when the next turn hits the cap", async () => {
  let b = budget();
  const r = await runQaDialogues({ cases, budget: () => ({ ...b }), reply: async () => {
    b = { ...b, blocked: true, requestsStarted: 1, requestsMetered: 1,
      inputTokens: 80, outputTokens: 10, confirmedUsd: .00026 };
    return reply("Das klingt anstrengend.", { peteReplySource: "llm", peteProviderUsageMetered: true,
      peteProviderModel: "gpt-6.1-sol", peteProviderInputTokens: 80, peteProviderOutputTokens: 10 });
  } });
  assert.equal(r.totalCompleted, 0); assert.equal(r.cases[0].turns.length, 1);
  assert.equal(r.modelResponses, 1); assert.equal(r.cases[0].turns[0].confirmedCostMicroUsd, 260);
  assert.equal(r.haltedReason, "cost_ceiling_or_ledger_unavailable");
});
test("QA stops without retry on uncertain provider usage and retains its reservation", async () => {
  let b = budget(), calls = 0;
  const r = await runQaDialogues({ cases: [...cases, { ...cases[0], id: "next-parent" }],
    budget: () => ({ ...b }), reply: async () => {
      calls++; b = { ...b, requestsStarted: 1, reservedUsd: .12 };
      return reply("Ich gebe es weiter.", { peteReplySource: "llm_handoff", peteLlmFailureReason: "provider_unavailable" });
    } });
  assert.equal(calls, 1); assert.equal(r.modelResponses, 0); assert.equal(r.totalCompleted, 0);
  assert.equal(r.haltedReason, "provider_usage_unverified");
  assert.equal(r.cases[0].turns[0].reservedUsdAfter, .12);
});
test("A metered server-rendered transaction remains distinct from model-generated text", async () => {
  let b = budget();
  const r = await runQaDialogues({ cases, budget: () => ({ ...b }), reply: async () => {
    b = { ...b, requestsStarted: b.requestsStarted! + 1, requestsMetered: b.requestsMetered! + 1,
      inputTokens: b.inputTokens! + 30, outputTokens: b.outputTokens! + 4, confirmedUsd: b.confirmedUsd! + .0001 };
    return reply("Hier ist der gepruefte Link.", { peteReplySource: "verified_transaction" });
  } });
  assert.equal(r.modelResponses, 0); assert.equal(r.providerResponses, 2);
  assert.equal(r.sourceCounts.verified_transaction, 2);
});
test("Missing ledger blocks before any engine call", async () => {
  let calls = 0;
  const r = await runQaDialogues({ cases, budget: () => ({ ok: false }),
    reply: async () => { calls++; return reply("", {}); } });
  assert.equal(calls, 0); assert.equal(r.totalCompleted, 0);
});
test("Dialogue validation permits bounded real free text, rejects duplicate leads or malformed cases", () => {
  validateQaCases([{ id: "six-turns", lines: Array(6).fill("Ein eigener Satz.") }]);
  for (const bad of [[...cases, ...cases], [{ id: "bad", lines: Array(13).fill("x") }],
    [{ id: "bad", lines: ["", " "] }], [{ id: "bad/path", lines: ["x", "y"] }]])
    assert.throws(() => validateQaCases(bad));
});
