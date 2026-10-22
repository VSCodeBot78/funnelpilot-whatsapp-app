import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Isolated storage, no external network, tokens simulated by mocked Responses.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fp-pete-budget-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = temp;
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const budget = await import("../services/pete-api-budget.service.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getPeteLlmConversationReply } = await import("../core/pete-llm-conversation.js");

function resetLedger() {
  for (const name of ["pete-api-budget.json", "pete-api-budget.lock"]) {
    fs.rmSync(path.join(temp, name), { force: true });
  }
}
const request = (length = 1000) => ({
  model: "gpt-4.1-mini", requestBody: "z".repeat(length),
  maxOutputTokens: 400,
});

test("Phase 47: persistent fail-closed 8 USD internal spend cap", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    delete process.env.OPENAI_API_KEY;
    fs.rmSync(temp, { recursive: true, force: true });
  });

  await t.test("mobile lab imports verified historical spend and fails closed if changed", () => {
    resetLedger();
    process.env.PETE_MOBILE_LAB_ENABLED = "true";
    process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD = "4323801";
    try {
      const initial = budget.getPeteBudgetStatus();
      assert.equal(initial.priorConfirmedUsd, 4.323801);
      assert.equal(initial.committedUsd, 4.323801);
      assert.equal(initial.remainingUsd, 3.676199);
      const id = budget.reservePeteBudget(request(1000));
      assert.ok(id);
      assert.ok(budget.getPeteBudgetStatus().remainingUsd < 3.676199);
      process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD = "0";
      assert.equal(budget.getPeteBudgetStatusSafe().ok, false);
      assert.throws(() => budget.reservePeteBudget(request(1000)),
        (err: any) => err?.reason === "unavailable");
    } finally {
      delete process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD;
      process.env.PETE_MOBILE_LAB_ENABLED = "false";
      resetLedger();
    }
  });

  await t.test("explicit private-lab GPT-5.4 approval reconciles $4.583900 and caps cumulative lab charges at $4 subject to $8 project ceiling", async () => {
    resetLedger();
    process.env.PETE_MOBILE_LAB_ENABLED = "true";
    process.env.PETE_MOBILE_LAB_ISOLATED_DATA = "true";
    process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD = "4323801";
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    process.env.PETE_MOBILE_LAB_GPT54_CONSENT = "true";
    process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD = "4000000";
    process.env.OPENAI_MODEL = "gpt-5.4";
    process.env.OPENAI_API_KEY = "fake-lab-key-no-network";
    writeSettings({ aiEnabled: false });
    try {
      const { isPeteLlmReadyForProvider } = await import("../core/pete-llm-conversation.js");
      assert.equal(isPeteLlmReadyForProvider(), true,
        "isolated consent works despite default aiEnabled false");
      const initial = budget.getPeteBudgetStatus();
      assert.equal(initial.model, "gpt-5.4");
      assert.equal(initial.hardCapUsd, 8);
      assert.equal(initial.priorConfirmedUsd, 4.5839);
      assert.equal(initial.committedUsd, 4.5839);
      assert.equal(initial.globalRemainingUsd, 3.4161);
      assert.equal(initial.labAuthorizedUsd, 4);
      assert.equal(initial.labRemainingUsd, 3.4161);
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response(JSON.stringify({
          output: [{ content: [{ type: "output_text", text: JSON.stringify({
            reply: "Bei deinen wechselnden Schichten macht ein fester Wochenplan wenig Sinn.",
            needsHuman: false,
          }) }] }],
          usage: { input_tokens: 1000, output_tokens: 150 },
        }), { status: 200 });
      };
      const answer = await getPeteLlmConversationReply({ campaignId: "dummy", answers: {},
        messages: [{ role: "user", text: "Ich arbeite in Schichten." }] } as any);
      assert.equal(answer.kind, "llm");
      assert.equal(calls, 1);
      const after = budget.getPeteBudgetStatus();
      assert.equal(after.labCommittedUsd, 0.00475);
      assert.equal(after.labRemainingUsd, 3.41135);
      assert.equal(after.committedUsd, 4.58865);
      assert.equal(after.reservedUsd, 0);
      assert.equal(after.requestsMetered, 1);

      // A previous lab ledger may exist: only deleting it in a fixture can
      // exercise the exact preauthorization threshold. Runtime never resets.
      resetLedger();
      for (let i = 0; i < 115; i++) {
        const id = budget.reservePeteBudget({
          model: "gpt-5.4", requestBody: "Z".repeat(1000), maxOutputTokens: 800,
        });
        assert.ok(id);
      }
      const nearCap = budget.getPeteBudgetStatus();
      assert.equal(nearCap.labCommittedUsd, 3.3925);
      assert.equal(nearCap.labRemainingUsd, 0.0236);
      assert.equal(nearCap.requestsStarted, 115);
      assert.throws(() => budget.reservePeteBudget({
        model: "gpt-5.4", requestBody: "Z".repeat(1000), maxOutputTokens: 800,
      }), (err: any) => err?.reason === "exhausted");
      assert.equal(budget.getPeteBudgetStatus().requestsStarted, 115,
        "a blocked call cannot spend tokens");
    } finally {
      process.env.PETE_MOBILE_LAB_ENABLED = "false";
      delete process.env.PETE_MOBILE_LAB_ISOLATED_DATA;
      delete process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD;
      delete process.env.PETE_MOBILE_LAB_GPT54_CONSENT;
      delete process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD;
      delete process.env.OPENAI_MODEL;
      delete process.env.OPENAI_API_KEY;
      process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
      process.env.PETE_LLM_API_CALLS_APPROVED = "false";
      resetLedger();
    }
  });

  await t.test("extended lab approval retains the existing persistent spend ledger", () => {
    resetLedger();
    process.env.PETE_MOBILE_LAB_ENABLED = "true";
    process.env.PETE_MOBILE_LAB_ISOLATED_DATA = "true";
    process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD = "4323801";
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    process.env.PETE_MOBILE_LAB_GPT54_CONSENT = "true";
    process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD = "4000000";
    process.env.OPENAI_MODEL = "gpt-5.4";
    try {
      fs.writeFileSync(path.join(temp, "pete-api-budget.json"), JSON.stringify({
        version: 1, priorSpentMicroUsd: 4323801, capMicroUsd: 8000000,
        committedMicroUsd: 1658682, confirmedMicroUsd: 1658682,
        reservedMicroUsd: 0, requestsStarted: 150, requestsMetered: 150,
        billedInputTokens: 0, billedOutputTokens: 0, pending: {},
      }));
      const after = budget.getPeteBudgetStatus();
      assert.equal(after.hardCapUsd, 8);
      assert.equal(after.labAuthorizedUsd, 4);
      assert.equal(after.labCommittedUsd, 1.658682);
      assert.equal(after.committedUsd, 6.242582);
      assert.equal(after.labRemainingUsd, 1.757418);
      assert.equal(after.globalRemainingUsd, 1.757418);
      assert.equal(after.requestsStarted, 150);
      assert.equal(after.requestsMetered, 150);
    } finally {
      process.env.PETE_MOBILE_LAB_ENABLED = "false";
      delete process.env.PETE_MOBILE_LAB_ISOLATED_DATA;
      delete process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD;
      delete process.env.PETE_MOBILE_LAB_GPT54_CONSENT;
      delete process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD;
      delete process.env.OPENAI_MODEL;
      process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
      process.env.PETE_LLM_API_CALLS_APPROVED = "false";
      resetLedger();
    }
  });

  await t.test("partial or absent lab approval blocks billing even if key and flags exist", () => {
    resetLedger();
    process.env.PETE_MOBILE_LAB_ENABLED = "true";
    process.env.PETE_MOBILE_LAB_ISOLATED_DATA = "true";
    process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD = "4323801";
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    process.env.OPENAI_MODEL = "gpt-5.4";
    process.env.OPENAI_API_KEY = "fake-no-network";
    try {
      assert.equal(budget.getPeteBudgetStatusSafe().ok, false);
      assert.throws(() => budget.reservePeteBudget({
        model: "gpt-5.4", requestBody: "hello", maxOutputTokens: 800,
      }), (err: any) => err?.reason === "unavailable");
      process.env.PETE_MOBILE_LAB_GPT54_CONSENT = "true";
      process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD = "4500000";
      assert.equal(budget.getPeteBudgetStatusSafe().ok, false,
        "cap must exactly match approved 4 USD");
      assert.throws(() => budget.reservePeteBudget({
        model: "gpt-5.4", requestBody: "hello", maxOutputTokens: 800,
      }), (err: any) => err?.reason === "unavailable");
    } finally {
      process.env.PETE_MOBILE_LAB_ENABLED = "false";
      delete process.env.PETE_MOBILE_LAB_ISOLATED_DATA;
      delete process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD;
      delete process.env.PETE_MOBILE_LAB_GPT54_CONSENT;
      delete process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD;
      delete process.env.OPENAI_MODEL;
      delete process.env.OPENAI_API_KEY;
      process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
      process.env.PETE_LLM_API_CALLS_APPROVED = "false";
      resetLedger();
    }
  });

  await t.test("new counter is empty and explicitly priced for mini only", () => {
    resetLedger();
    const s = budget.getPeteBudgetStatus();
    assert.equal(s.hardCapUsd, 8);
    assert.equal(s.committedUsd, 0);
    assert.equal(s.requestsStarted, 0);
    assert.throws(() => budget.reservePeteBudget({ ...request(), model: "gpt-4.1" }),
      (err: any) => err?.reason === "model_not_priced");
  });

  await t.test("reserves before API then settles based on actual input/output tokens", () => {
    resetLedger();
    const id = budget.reservePeteBudget(request());
    const held = budget.getPeteBudgetStatus();
    assert.equal(held.requestsStarted, 1);
    assert.ok(held.reservedUsd > 0);
    assert.equal(held.confirmedUsd, 0);
    const first = budget.settlePeteBudget(id, { input_tokens: 300, output_tokens: 100 });
    assert.equal(first, true);
    assert.equal(budget.settlePeteBudget(id, { input_tokens: 300, output_tokens: 100 }), false);
    const after = budget.getPeteBudgetStatus();
    assert.equal(after.requestsMetered, 1);
    assert.equal(after.requestsStarted, 1);
    assert.equal(after.reservedUsd, 0);
    assert.equal(after.inputTokens, 300);
    assert.equal(after.outputTokens, 100);
    assert.equal(after.confirmedUsd, 0.00028);
    assert.equal(after.committedUsd, after.confirmedUsd);
    // Fresh disk read simulates a backend restart.
    assert.equal(budget.getPeteBudgetStatus().confirmedUsd, 0.00028);
  });

  await t.test("missing usage or failed request keeps reservation (never silently free it)", () => {
    resetLedger();
    const id = budget.reservePeteBudget(request(500));
    assert.equal(budget.settlePeteBudget(id, undefined), false);
    const s = budget.getPeteBudgetStatus();
    assert.equal(s.requestsStarted, 1);
    assert.equal(s.requestsMetered, 0);
    assert.equal(s.reservedUsd, s.committedUsd);
    assert.ok(s.remainingUsd < 8);
  });

  await t.test("concurrent starts cannot overspend remaining budget", async () => {
    resetLedger();
    const huge = request(300_000);
    const reservations = await Promise.all(Array.from({ length: 90 }, () =>
      Promise.resolve().then(() => {
        try { return budget.reservePeteBudget(huge); }
        catch (error) {
          assert.ok(error instanceof budget.PeteBudgetStop);
          return null;
        }
      }),
    ));
    const admitted = reservations.filter(Boolean);
    const rejected = reservations.filter(x => x === null);
    assert.ok(admitted.length > 0 && rejected.length > 0);
    const snapshot = budget.getPeteBudgetStatus();
    assert.equal(snapshot.requestsStarted, admitted.length);
    assert.ok(snapshot.committedUsd <= 8);
    assert.ok(snapshot.remainingUsd < 0.25);
    assert.equal(snapshot.reservedUsd, snapshot.committedUsd);
    assert.throws(() => budget.reservePeteBudget(huge),
      (error: any) => error?.reason === "exhausted");
  });

  await t.test("cross-process lock blocks an unguarded request, safely", () => {
    resetLedger();
    fs.writeFileSync(path.join(temp, "pete-api-budget.lock"), "held");
    assert.throws(() => budget.reservePeteBudget(request()),
      (error: any) => error?.reason === "unavailable");
    fs.rmSync(path.join(temp, "pete-api-budget.lock"));
    assert.equal(budget.getPeteBudgetStatus().committedUsd, 0);
  });

  await t.test("corrupt budget file fails closed; no reset on restart", () => {
    resetLedger();
    fs.writeFileSync(path.join(temp, "pete-api-budget.json"), "{broken-json");
    assert.equal(budget.getPeteBudgetStatusSafe().ok, false);
    assert.throws(() => budget.reservePeteBudget(request()),
      (error: any) => error?.reason === "unavailable");
    assert.equal(fs.readFileSync(path.join(temp, "pete-api-budget.json"), "utf8"), "{broken-json");
  });

  await t.test("full Pete LLM flow bills actual tokens from mocked provider JSON", async () => {
    resetLedger();
    process.env.OPENAI_API_KEY = "offline-fake-key";
    // Archived Mini-price assertion is synthetic QA only, never a product choice.
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
    process.env.PETE_LLM_API_CALLS_APPROVED = "true";
    writeSettings({ aiEnabled: true });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: JSON.stringify({
          reply: "Du brauchst einen Weg, der auch nach chaotischen Tagen wieder funktioniert.",
          needsHuman: false,
        }) }] }],
        usage: { input_tokens: 1000, output_tokens: 150, total_tokens: 1150 },
      }), { status: 200 });
    };
    const state: any = { campaignId: "test", answers: {}, messages: [
      { role: "user", text: "Mein Kind war krank, wie geht es weiter?" },
    ] };
    const r = await getPeteLlmConversationReply(state);
    assert.equal(r.kind, "llm");
    const snap = budget.getPeteBudgetStatus();
    assert.equal(calls, 1);
    assert.equal(snap.requestsStarted, 1);
    assert.equal(snap.requestsMetered, 1);
    assert.equal(snap.inputTokens, 1000);
    assert.equal(snap.outputTokens, 150);
    assert.equal(snap.committedUsd, 0.00064);
    assert.equal(snap.reservedUsd, 0);
    delete process.env.OPENAI_MODEL;
  });

  await t.test("unsupported model cannot incur unknown API tariffs", async () => {
    resetLedger();
    process.env.OPENAI_MODEL = "gpt-6-astra";
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("not permitted"); };
    const state: any = { campaignId: "test", answers: {}, messages: [
      { role: "user", text: "Guten Abend" },
    ] };
    const reply = await getPeteLlmConversationReply(state);
    assert.equal(reply.kind, "handoff");
    assert.equal((reply as any).reason, "budget_unavailable");
    assert.equal(calls, 0);
    delete process.env.OPENAI_MODEL;
  });
});
