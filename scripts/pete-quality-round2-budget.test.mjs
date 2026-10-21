import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = fileURLToPath(new URL("./pete-quality-round2-budget.mjs", import.meta.url));
const cap = 400_000;
const oldOne = 245_788, oldTwo = 79_279;
const env = {
  ...process.env,
  GITHUB_ACTIONS: "true",
  GITHUB_RUN_ID: "39610000000",
  GITHUB_REF: "refs/heads/pete-quality-real-round2-20261021",
  PETE_QUALITY_QA_20261021: "true",
  PETE_QUALITY_QA_ROUND2_20261021: "true",
  PETE_QUALITY_QA_RESUME_20261021: "false",
  PETE_QUALITY_QA_APPROVAL: "single-run-20261021",
};
function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fp-round2-budget-"));
  const budgetPath = path.join(cwd, "budget-ledger", "phase3-budget-ledger.json");
  fs.mkdirSync(path.dirname(budgetPath), { recursive: true });
  fs.writeFileSync(budgetPath, JSON.stringify({
    version: 1, capMicroUsd: 8_000_000, spentMicroUsd: 4_920_676,
    reservedMicroUsd: 0, activeReservations: {},
    qualityRun20261021: { status: "settled", chargedMicroUsd: oldOne },
    qualityResume20261021: { status: "settled", chargedMicroUsd: oldTwo, previouslyChargedMicroUsd: oldOne },
    completedBatches: [
      { id: "approved-real-pete-quality-20261021-usd2", costMicroUsd: oldOne },
      { id: "approved-pete-qa-20261021-resume-remaining", costMicroUsd: oldTwo },
    ],
  }));
  return {
    cwd, budgetPath,
    read: () => JSON.parse(fs.readFileSync(budgetPath, "utf8")),
    run: (op, extraEnv = {}) => spawnSync(process.execPath, [script, op], {
      cwd, encoding: "utf8", env: { ...env, ...extraEnv },
    }),
    cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }),
  };
}
test("USD0.40 QA: exact named owner-approved branch, explicit consent and run required", t => {
  const f = fixture(); t.after(f.cleanup);
  for (const diff of [
    { GITHUB_REF: "refs/heads/main" }, { GITHUB_ACTIONS: "false" },
    { PETE_QUALITY_QA_ROUND2_20261021: "false" },
    { PETE_QUALITY_QA_APPROVAL: "arbitrary" },
    { GITHUB_RUN_ID: "" },
  ]) {
    assert.notEqual(f.run("reserve", diff).status, 0, JSON.stringify(diff));
    assert.equal(f.read().reservedMicroUsd, 0);
  }
});
test("USD0.40 QA: reserves only unspent portion of original USD2, not a second grant", t => {
  const f = fixture(); t.after(f.cleanup);
  assert.equal(f.run("reserve").status, 0);
  const ledger = f.read();
  assert.equal(ledger.reservedMicroUsd, cap);
  assert.equal(ledger.qualityRound2_20261021.previousSpendMicroUsd, oldOne + oldTwo);
  assert.equal(ledger.qualityRound2_20261021.reserveMicroUsd, cap);
  assert.equal(oldOne + oldTwo + cap <= 2_000_000, true);
  assert.notEqual(f.run("reserve").status, 0, "double spend prevented");
});
test("USD0.40 QA: settlement charges actual measured run and closes approval forever", t => {
  const f = fixture(); t.after(f.cleanup);
  assert.equal(f.run("reserve").status, 0);
  const dataDir = path.join(f.cwd, "backend", ".pete-quality-20261021-round2");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "pete-api-budget.json"), JSON.stringify({
    version: 1, committedMicroUsd: 88_000, requestsStarted: 40,
  }));
  assert.equal(f.run("settle").status, 0);
  const v = f.read();
  assert.equal(v.reservedMicroUsd, 0);
  assert.equal(v.spentMicroUsd, 4_920_676 + 88_000);
  assert.equal(v.qualityRound2_20261021.chargedMicroUsd, 88_000);
  assert.equal(v.qualityRound2_20261021.status, "settled");
  assert.notEqual(f.run("reserve").status, 0);
  assert.notEqual(f.run("settle").status, 0);
});
test("USD0.40 QA: any missing usage proof charges whole USD0.40, never releases a second run", t => {
  const f = fixture(); t.after(f.cleanup);
  assert.equal(f.run("reserve").status, 0);
  assert.equal(f.run("settle").status, 0);
  assert.equal(f.read().spentMicroUsd, 4_920_676 + cap);
  assert.equal(f.read().reservedMicroUsd, 0);
  assert.notEqual(f.run("reserve").status, 0);
});
test("USD0.40 QA: tampered earlier approvals, global cap, or other reservation block new spending", t => {
  for (const edit of [
    (x) => { x.qualityRun20261021.chargedMicroUsd = 0; },
    (x) => { x.qualityResume20261021.chargedMicroUsd = 0; },
    (x) => { x.spentMicroUsd = 7_900_000; },
    (x) => { x.reservedMicroUsd = 10_000; x.activeReservations.other = { heldMicroUsd: 10_000 }; },
  ]) {
    const f = fixture(); t.after(f.cleanup);
    const state = f.read(); edit(state);
    fs.writeFileSync(f.budgetPath, JSON.stringify(state));
    assert.notEqual(f.run("reserve").status, 0);
    assert.notEqual(f.read().qualityRound2_20261021?.status, "reserved");
  }
});
