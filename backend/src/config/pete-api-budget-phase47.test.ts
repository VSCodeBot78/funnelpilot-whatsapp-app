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
