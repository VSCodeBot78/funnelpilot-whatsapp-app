import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = fileURLToPath(new URL("./pete-quality-resume-budget.mjs", import.meta.url));
const oldRunCharge = 245_788;
const remaining = 1_754_212;
const env = {
  ...process.env,
  GITHUB_ACTIONS: "true",
  GITHUB_RUN_ID: "39588888888",
  GITHUB_REF: "refs/heads/pete-quality-real-resume-20261021",
  PETE_QUALITY_QA_20261021: "true",
  PETE_QUALITY_QA_RESUME_20261021: "true",
  PETE_QUALITY_QA_APPROVAL: "single-run-20261021",
  INSTAGRAM_SEND_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false",
};

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fp-qa-resume-"));
  const data = {
    version: 1,
    capMicroUsd: 8_000_000,
    spentMicroUsd: 4_841_397,
    reservedMicroUsd: 0,
    activeReservations: {},
    completedBatches: [{
      id: "approved-real-pete-quality-20261021-usd2",
      costMicroUsd: oldRunCharge,
    }],
    qualityRun20261021: {
      runId: "39547752858",
      authorizedMicroUsd: 2_000_000,
      status: "settled",
      chargedMicroUsd: oldRunCharge,
    },
  };
  fs.mkdirSync(path.join(cwd, "budget-ledger"), { recursive: true });
  const file = path.join(cwd, "budget-ledger", "phase3-budget-ledger.json");
  fs.writeFileSync(file, JSON.stringify(data));
  const read = () => JSON.parse(fs.readFileSync(file, "utf8"));
  const run = (command, additionalEnv = {}) => spawnSync(
    process.execPath, [script, command],
    { cwd, env: { ...env, ...additionalEnv }, encoding: "utf8" });
  return {
    cwd, file, read, run,
    dispose() { fs.rmSync(cwd, { recursive: true, force: true }); },
  };
}

test("cannot reserve without exact approved GitHub QA branch and flags", t => {
  const x = fixture(); t.after(() => x.dispose());
  for (const extra of [
    { GITHUB_REF: "refs/heads/main" },
    { PETE_QUALITY_QA_APPROVAL: "" },
    { GITHUB_ACTIONS: "false" },
    { PETE_QUALITY_QA_RESUME_20261021: "false" },
  ]) {
    assert.notEqual(x.run("reserve", extra).status, 0, JSON.stringify(extra));
    assert.equal(x.read().reservedMicroUsd, 0);
  }
});

test("original charge cannot be erased or silently charged again", t => {
  const x = fixture(); t.after(() => x.dispose());
  const value = x.read();
  value.qualityRun20261021.chargedMicroUsd = 0;
  fs.writeFileSync(x.file, JSON.stringify(value));
  assert.notEqual(x.run("reserve").status, 0);
  assert.equal(x.read().spentMicroUsd, 4_841_397);
});

test("reserve exactly the unused $1.754212 once, settle actual usage, then prevent re-run", t => {
  const x = fixture(); t.after(() => x.dispose());
  assert.equal(x.run("reserve").status, 0);
  let ledger = x.read();
  assert.equal(ledger.reservedMicroUsd, remaining);
  assert.equal(ledger.qualityResume20261021.previouslyChargedMicroUsd, oldRunCharge);
  assert.equal(ledger.qualityResume20261021.status, "reserved");
  assert.notEqual(x.run("reserve").status, 0, "second reservation must fail");

  const dataDir = path.join(x.cwd, "backend", ".pete-quality-20261021-resume");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "pete-api-budget.json"), JSON.stringify({
    version: 1, requestsStarted: 21, committedMicroUsd: 55_000,
  }));
  assert.equal(x.run("settle").status, 0);
  ledger = x.read();
  assert.equal(ledger.spentMicroUsd, 4_841_397 + 55_000);
  assert.equal(ledger.reservedMicroUsd, 0);
  assert.equal(ledger.qualityResume20261021.chargedMicroUsd, 55_000);
  assert.equal(ledger.qualityResume20261021.status, "settled");
  assert.notEqual(x.run("reserve").status, 0);
  assert.notEqual(x.run("settle").status, 0);
});

test("unknown usage consumes full remaining authorization, never grants a reset", t => {
  const x = fixture(); t.after(() => x.dispose());
  assert.equal(x.run("reserve").status, 0);
  assert.equal(x.run("settle").status, 0);
  const ledger = x.read();
  assert.equal(ledger.spentMicroUsd, 4_841_397 + remaining);
  assert.equal(ledger.qualityResume20261021.chargedMicroUsd, remaining);
  assert.equal(ledger.spentMicroUsd + ledger.reservedMicroUsd <= ledger.capMicroUsd, true);
});

test("missing original completed batch proof blocks reservation", t => {
  const x = fixture(); t.after(() => x.dispose());
  const v = x.read(); v.completedBatches = []; fs.writeFileSync(x.file, JSON.stringify(v));
  assert.notEqual(x.run("reserve").status, 0);
});
