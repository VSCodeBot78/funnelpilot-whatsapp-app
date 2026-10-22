/**
 * Persistent GitHub Actions ledger bridge for owner-approved synthetic QA.
 * No network operations or model calls here. The Actions workflow must
 * push a reserve commit successfully BEFORE running any paid model calls.
 */
import fs from "node:fs";
import path from "node:path";
import {
  checkPeteQaAdmission, preparePeteQaReservation, settlePeteQaReservation,
} from "./pete-repeatable-qa-contract.mjs";

const command = process.argv[2];
const cwd = process.cwd();
const requestFile = path.join(cwd, "qa", "pete-approved-test.json");
const ledgerFile = path.join(cwd, "budget-ledger", "phase3-budget-ledger.json");
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, content) => {
  const tmp = file + ".new";
  fs.writeFileSync(tmp, JSON.stringify(content, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, file);
};
if (process.argv.length !== 3 || !["preflight", "reserve", "settle"].includes(command))
  throw Error("qa_command_invalid");
const env = process.env;
const request = readJson(requestFile);
const ledger = readJson(ledgerFile);
if (command === "preflight") {
  const ticket = checkPeteQaAdmission(env, ledger, request);
  console.log(JSON.stringify({ preflight: "accepted", runId: ticket.runId, testSet: ticket.testSet,
    budgetUsd: ticket.micro / 1_000_000 }));
} else if (command === "reserve") {
  const prepared = preparePeteQaReservation(env, ledger, request);
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
