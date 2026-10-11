import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { getPeteVerifiedTransactionAnswer } from "../core/pete-conversation-quality.js";

test("Phase 56: past checkout concern is not a purchase or handover", () => {
  const state = { messages: [] } as any;
  const first = getPeteVerifiedTransactionAnswer(
    "Ich habe in einem Checkout schon böse Überraschungen erlebt.", state);
  assert.ok(first);
  assert.equal(first.handoff, undefined);
  assert.match(first.text, /Bedingungen|Konditionen|Vertragsdetails/i);
  assert.doesNotMatch(first.text, /ist (?:erfolgreich )?bezahlt|bestätigte Bestellung/);
  const payment = getPeteVerifiedTransactionAnswer(
    "Ich habe bezahlt und mein Zugang fehlt.", state);
  assert.equal(payment?.handoff, true);
});

test("Phase 56: cumulative budget ledger only releases proven zero-call blocks", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase56-ledger-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, "budget-ledger");
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(root, "backend", ".phase3-data"), { recursive: true });
  const ledgerFile = path.join(dir, "phase3-budget-ledger.json");
  fs.writeFileSync(ledgerFile, JSON.stringify({
    version: 1, capMicroUsd: 8000000, spentMicroUsd: 0,
    reservedMicroUsd: 0, activeReservations: {}, completedBatches: [],
  }));
  const script = path.resolve(import.meta.dirname, "../../../scripts/pete-phase3-ledger.mjs");
  const env = { ...process.env, GITHUB_ACTIONS: "true",
    GITHUB_RUN_ID: "verified-job", GITHUB_RUN_ATTEMPT: "1" };
  function run(action: string, batch: number) {
    return spawnSync(process.execPath, [script, action, String(batch)],
      { cwd: root, env, encoding: "utf8" });
  }
  const ledger = () => JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
  function writeEvidence(batch: number, overrides: Record<string, unknown> = {}) {
    const dataDir = path.join(root, "backend", ".phase3-data", "batch-" + batch);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "pete-phase3-zero-calls.json"),
      JSON.stringify({
        version: 1, kind: "successful_flagship_no_provider_calls",
        runId: "verified-job", attempt: "1", batch,
        providerCalls: 0, completedPersonas: 2, success: true,
        ...overrides,
      }));
  }
  assert.equal(run("reserve", 0).status, 0);
  writeEvidence(0);
  assert.equal(run("settle", 0).status, 0);
  assert.equal(ledger().spentMicroUsd, 0,
    "Only a successful, exact zero-provider-call proof releases the hold");
  assert.equal(run("reserve", 1).status, 0);
  assert.equal(run("settle", 1).status, 0);
  assert.equal(ledger().spentMicroUsd, 1500000,
    "Missing zero-call proof still charges full block");
  assert.equal(run("reserve", 2).status, 0);
  writeEvidence(2, { runId: "some-other-github-job" });
  assert.equal(run("settle", 2).status, 0);
  assert.equal(ledger().spentMicroUsd, 3000000,
    "A mismatched run cannot release budget");
  assert.equal(run("reserve", 3).status, 0);
  writeEvidence(3);
  const usageDir = path.join(root, "backend", ".phase3-data", "batch-3");
  fs.writeFileSync(path.join(usageDir, "pete-api-budget.json"),
    JSON.stringify({ version: 1, committedMicroUsd: 180000 }));
  assert.equal(run("settle", 3).status, 0);
  assert.equal(ledger().spentMicroUsd, 3180000,
    "Actual recorded cost prevails over any zero-call attestation");
  assert.equal(ledger().reservedMicroUsd, 0);
  assert.equal(run("reserve", 0).status !== 0, true,
    "An old batch may not be replayed in the same job");
});
