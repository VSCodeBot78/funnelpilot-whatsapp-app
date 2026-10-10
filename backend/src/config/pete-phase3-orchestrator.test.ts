import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { PETE_PHASE3_PERSONAS, getPhase3LeadMessage } from "./pete-phase3-scenarios.js";

const expected = { family: 10, frustration: 8, budget: 8,
  knowledge: 7, switch: 7, safety: 5, handoff: 5 };
test("Phase3 offline: exactly fifty distinct difficult fictional conversations", () => {
  assert.equal(PETE_PHASE3_PERSONAS.length, 50);
  assert.equal(new Set(PETE_PHASE3_PERSONAS.map(p => p.id)).size, 50);
  for (const [category, count] of Object.entries(expected)) {
    assert.equal(PETE_PHASE3_PERSONAS.filter(p => p.category === category).length, count);
  }
  for (const p of PETE_PHASE3_PERSONAS) {
    const turns = Array.from({ length: 10 }, (_, i) =>
      getPhase3LeadMessage(p, i, i === 4 ? "Was hast du bisher versucht?" : ""));
    assert.equal(turns.length, 10);
    assert.ok(turns.every(x => x.length > 15));
    assert.ok(turns[4].includes("gleiche Frage"));
    assert.ok(turns[3].includes("?"));
  }
});
test("Phase3 offline: CI runner never triggers on a pull request or normal branch", () => {
  const file = path.resolve(import.meta.dirname, "../../../.github/workflows/pete-phase3-synthetic.yml");
  const yaml = fs.readFileSync(file, "utf8");
  assert.match(yaml, /phase3-approved-run-20261011/);
  assert.match(yaml, /startsWith\(github.event.head_commit.message, 'PHASE3_APPROVED_50_CHATS'\)/);
  assert.match(yaml, /secrets\.OPENAI_API_KEY/);
  assert.match(yaml, /PETE_PHASE3_BUDGET_ENVELOPE: "true"/);
  assert.match(yaml, /INSTAGRAM_SEND_ENABLED: "false"/);
  assert.match(yaml, /WHATSAPP_SEND_ENABLED: "false"/);
  assert.doesNotMatch(yaml, /pull_request:/);
  assert.doesNotMatch(yaml, /workflow_dispatch:/);
});
test("Phase3 offline: durable envelope reservations cannot reset or exceed authorized cap", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-phase3-gh-ledger-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "budget-ledger"));
  const ledgerFile = path.join(dir, "budget-ledger", "phase3-budget-ledger.json");
  const initial = {
    version: 1, capMicroUsd: 8000000, spentMicroUsd: 0,
    reservedMicroUsd: 0, completedBatches: [], activeReservations: {},
  };
  fs.writeFileSync(ledgerFile, JSON.stringify(initial));
  const script = path.resolve(import.meta.dirname, "../../../scripts/pete-phase3-ledger.mjs");
  const env = { ...process.env, GITHUB_ACTIONS: "true", GITHUB_RUN_ID: "synthetic-run",
    GITHUB_RUN_ATTEMPT: "1" };
  const execute = (op: string, index: number) => spawnSync(
    process.execPath, [script, op, String(index)], {
      cwd: dir, env, encoding: "utf8",
    },
  );
  const data = () => JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
  assert.equal(execute("reserve", 0).status, 0);
  assert.equal(data().reservedMicroUsd, 1500000);
  assert.notEqual(execute("reserve", 0).status, 0, "duplicate reservation must fail");
  assert.equal(execute("settle", 0).status, 0);
  assert.equal(data().spentMicroUsd, 1500000,
    "Missing local usage charges the entire reservation");
  assert.notEqual(execute("reserve", 0).status, 0, "completed run must not replay");
  for (let batch = 1; batch <= 4; batch++) {
    assert.equal(execute("reserve", batch).status, 0);
    assert.equal(execute("settle", batch).status, 0);
  }
  assert.equal(data().spentMicroUsd, 7500000);
  assert.ok(data().spentMicroUsd + data().reservedMicroUsd <= 8000000);
  const secondRun = { ...env, GITHUB_RUN_ID: "replay-run" };
  const refused = spawnSync(process.execPath, [script, "reserve", "0"], {
    cwd: dir, env: secondRun, encoding: "utf8",
  });
  assert.notEqual(refused.status, 0);
  assert.equal(data().spentMicroUsd, 7500000);
});
