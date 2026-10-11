import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-flagship-budget-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_PHASE3_FLAGSHIP_ENVELOPE = "true";
delete process.env.OPENAI_API_KEY;

const { getPeteBudgetStatus, reservePeteBudget,
  settlePeteBudget, PeteBudgetStop } = await import("../services/pete-api-budget.service.js");

function clean() {
  fs.rmSync(path.join(dir, "pete-api-budget.json"), { force: true });
  fs.rmSync(path.join(dir, "pete-api-budget.lock"), { force: true });
}
const request = (bytes = 1000) => ({
  model: "gpt-5.4", requestBody: "A".repeat(bytes), maxOutputTokens: 800,
});

test("Phase 50: flagship cost safety, isolated from real API", async t => {
  t.after(() => {
    delete process.env.PETE_PHASE3_FLAGSHIP_ENVELOPE;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await t.test("price gpt-5.4 correctly at 2.50 input and 15 output per million", () => {
    clean();
    const id = reservePeteBudget(request());
    const s = getPeteBudgetStatus();
    assert.equal(s.requestsStarted, 1);
    assert.equal(s.reservedUsd, 0.0295);
    assert.equal(settlePeteBudget(id, { input_tokens: 1000, output_tokens: 150 }), true);
    assert.equal(getPeteBudgetStatus().confirmedUsd, 0.00475);
  });
  await t.test("overlong request cannot escape per-block 1.50 USD envelope", () => {
    clean();
    assert.throws(() => reservePeteBudget(request(18001)),
      (e: any) => e instanceof PeteBudgetStop && e.reason === "exhausted");
    assert.equal(getPeteBudgetStatus().requestsStarted, 0);
  });
  await t.test("20 worst-case requests fit a 1.50 USD block and global 8 USD cap", () => {
    clean();
    for (let i = 0; i < 20; i++) reservePeteBudget(request(18000));
    const s = getPeteBudgetStatus();
    assert.equal(s.requestsStarted, 20);
    assert.ok(s.committedUsd <= 1.5, "worst 20-call cost should fit block");
    assert.ok(s.committedUsd > 1.3);
  });
  await t.test("provider cost cannot be reset by a fresh status read", () => {
    assert.ok(getPeteBudgetStatus().committedUsd > 1.3);
    assert.ok(getPeteBudgetStatus().remainingUsd < 6.7);
  });
  await t.test("unknown and unpriced model remains forbidden", () => {
    assert.throws(() => reservePeteBudget({ ...request(), model: "gpt-6-unknown" }),
      (e: any) => e instanceof PeteBudgetStop && e.reason === "model_not_priced");
  });
  await t.test("special action requires explicit branch and user-run commit", () => {
    const file = path.resolve(import.meta.dirname,
      "../../../.github/workflows/pete-phase3-flagship-comparison.yml");
    const yaml = fs.readFileSync(file, "utf8");
    assert.match(yaml, /phase3-flagship-approved-run-20261011/);
    assert.match(yaml, /PHASE3_FLAGSHIP_APPROVED_10_CHATS/);
    assert.match(yaml, /PETE_PHASE3_FLAGSHIP_ENVELOPE: "true"/);
    assert.match(yaml, /OPENAI_MODEL: gpt-5\.4/);
    assert.match(yaml, /secrets\.OPENAI_API_KEY/);
    assert.doesNotMatch(yaml, /workflow_dispatch:/);
  });
});
