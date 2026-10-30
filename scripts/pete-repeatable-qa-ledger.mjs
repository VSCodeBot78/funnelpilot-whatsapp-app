/**
 * Persistent GitHub Actions ledger bridge for owner-approved synthetic QA.
 * No provider operations here. The git adapter verifies remote publication. The workflow must
 * push a reserve commit successfully BEFORE running any paid model calls.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  checkPeteQaAdmission, preparePeteQaReservation, settlePeteQaReservation,
  checkPeteQaGrantHeld, verifyPeteQaGrantHistory,
} from "./pete-repeatable-qa-contract.mjs";

const REPO = "VSCodeBot78/funnelpilot-whatsapp-app";
const SOURCE_REF = "refs/heads/feat/pete-policy-v4-20261022";
const LEDGER_REF = "refs/heads/pete-phase3-budget-ledger";
const LEDGER_NAME = "phase3-budget-ledger.json";
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
function git(directory, args) {
  // Never echo credentials or raw child-process errors. No shell expansion.
  return execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8", timeout: 15_000, maxBuffer: 4_000_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function confirmRef(directory, ref) {
  const origin = git(directory, ["remote", "get-url", "origin"]);
  if (origin !== "https://github.com/" + REPO + ".git" &&
      origin !== "https://github.com/" + REPO) throw Error("qa_untrusted_git_origin");
  const head = git(directory, ["rev-parse", "HEAD"]);
  if (!/^[0-9a-f]{40}$/.test(head) ||
      git(directory, ["ls-remote", "--exit-code", "origin", ref]) !== head + "\t" + ref ||
      git(directory, ["diff", "--name-only", "HEAD", "--"]) !== "")
    throw Error("qa_remote_ref_not_confirmed");
  return head;
}
/** Read-only git verification. An env value/local file/push-intent flag is
 * never proof of publication. Called again by the provider budget service
 * before each request, not just by the workflow shell. */
export function readConfirmedPeteQaState(env) {
  if (!env.GITHUB_WORKSPACE || !/^[0-9a-f]{40}$/.test(env.GITHUB_SHA ?? ""))
    throw Error("qa_workspace_required");
  const workspace = path.resolve(env.GITHUB_WORKSPACE);
  const directory = path.join(workspace, "budget-ledger");
  const data = path.join(workspace, "backend", ".pete-repeatable-qa-" + env.GITHUB_RUN_ID);
  if (path.resolve(env.DATA_DIR ?? "") !== data ||
      (fs.existsSync(data) && fs.realpathSync(data) !== data) ||
      fs.realpathSync(directory) !== directory || fs.realpathSync(workspace) !== workspace ||
      confirmRef(workspace, SOURCE_REF) !== env.GITHUB_SHA)
    throw Error("qa_source_or_storage_mismatch");
  const ledgerSha = confirmRef(directory, LEDGER_REF);
  if (git(directory, ["rev-parse", "--is-shallow-repository"]) !== "false")
    throw Error("qa_complete_ledger_history_required");
  const request = readJson(path.join(workspace, "qa", "pete-approved-test.json"));
  if (JSON.stringify(request) !== JSON.stringify(JSON.parse(git(workspace,
    ["show", env.GITHUB_SHA + ":qa/pete-approved-test.json"])))) throw Error("qa_manifest_modified");
  const committed = git(directory, ["show", ledgerSha + ":" + LEDGER_NAME]);
  if (fs.readFileSync(path.join(directory, LEDGER_NAME), "utf8").trim() !== committed)
    throw Error("qa_ledger_not_committed");
  const ledger = JSON.parse(committed);
  // Walk back to the last pre-grant snapshot; insist on complete history.
  const snapshots = [];
  const commits = git(directory, ["log", "--format=%H", "--", LEDGER_NAME]).split("\n");
  for (const commit of commits) {
    const snapshot = JSON.parse(git(directory, ["show", commit + ":" + LEDGER_NAME]));
    snapshots.unshift(snapshot);
    if (!snapshot.qaOwnerGrantsV1) break;
  }
  if (!snapshots.length || snapshots[0].qaOwnerGrantsV1)
    throw Error("qa_grant_creation_history_missing");
  verifyPeteQaGrantHistory(snapshots);
  return { request, ledger, ledgerSha };
}
export function getPeteQaRuntimeAuthorization(env) {
  if (typeof env.OPENAI_API_KEY !== "string" || env.OPENAI_API_KEY.trim().length < 15)
    throw Error("qa_provider_secret_required");
  const context = readConfirmedPeteQaState(env);
  return checkPeteQaGrantHeld(env, context.ledger, context.request);
}

export function runPeteQaLedgerCommand(command, env = process.env, cwd = process.cwd()) {
  const requestFile = path.join(cwd, "qa", "pete-approved-test.json");
  const ledgerFile = path.join(cwd, "budget-ledger", "phase3-budget-ledger.json");
  const writeJson = (file, content) => {
    const tmp = file + ".new";
    fs.writeFileSync(tmp, JSON.stringify(content, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(tmp, file);
  };
  if (!["preflight", "reserve", "settle"].includes(command))
    throw Error("qa_command_invalid");
  const request = readJson(requestFile);
  const ledger = readJson(ledgerFile);
  if (request.version === 2) {
    // Both refs must match remote before admission and before settlement.
    // The provider repeats the verification after the reservation push.
    readConfirmedPeteQaState({ ...env, DATA_DIR: env.DATA_DIR ??
      path.join(cwd, "backend", ".pete-repeatable-qa-" + env.GITHUB_RUN_ID) });
  }
  if (command === "preflight") {
    const ticket = checkPeteQaAdmission(env, ledger, request);
    console.log(JSON.stringify({ preflight: "accepted", runId: ticket.runId, testSet: ticket.testSet,
      budgetUsd: ticket.micro / 1_000_000 }));
  } else if (command === "reserve") {
    const prepared = preparePeteQaReservation(env, ledger, request);
    if (request.version === 2) {
      const directory = path.join(cwd, "backend", ".pete-repeatable-qa-" + env.GITHUB_RUN_ID);
      if (path.resolve(env.DATA_DIR ?? "") !== directory) throw Error("qa_data_dir_mismatch");
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      // Missing/erased receipts must never restart a run from zero. Only this
      // pre-push reservation step can create the initial bound local ledger.
      fs.writeFileSync(path.join(directory, "pete-api-budget.json"), JSON.stringify({
        version: 1, priorSpentMicroUsd: 0, capMicroUsd: prepared.ticket.micro,
        committedMicroUsd: 0, confirmedMicroUsd: 0, reservedMicroUsd: 0,
        requestsStarted: 0, requestsMetered: 0, billedInputTokens: 0, billedOutputTokens: 0,
        pending: {}, qaGrant: { ...prepared.ticket, status: "reserved" },
      }) + "\n", { flag: "wx", mode: 0o600 });
    }
    writeJson(ledgerFile, prepared.ledger);
    console.log("qa_reserved_locally", prepared.ticket.id, prepared.ticket.micro);
  } else {
    const directory = path.resolve(env.DATA_DIR ?? "");
    const required = path.join(cwd, "backend", ".pete-repeatable-qa-" + env.GITHUB_RUN_ID);
    if (directory !== required) throw Error("qa_data_dir_mismatch");
    let receipt = null;
    try { receipt = readJson(path.join(directory, "pete-api-budget.json")); }
    catch { /* No reliable receipt: burn full hold. */ }
    const settled = settlePeteQaReservation(env, ledger, receipt);
    writeJson(ledgerFile, settled.ledger);
    console.log("qa_settled_locally", env.GITHUB_RUN_ID, settled.chargeMicroUsd);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw Error("qa_command_invalid");
  runPeteQaLedgerCommand(process.argv[2]);
}
