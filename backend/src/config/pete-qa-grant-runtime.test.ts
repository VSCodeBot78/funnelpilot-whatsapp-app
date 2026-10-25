import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { createPeteQaOwnerGrant, preparePeteQaReservation } from "../../../scripts/pete-repeatable-qa-contract.mjs";
import { getPeteQaRuntimeAuthorization, runPeteQaLedgerCommand } from "../../../scripts/pete-repeatable-qa-ledger.mjs";

// Only git readback and Responses are mocked. The actual ledger bridge,
// filesystem lock, budget service, provider caller and engine run unchanged.
// No production switch or alternative runtime authorization is introduced.
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fp-qa-grant-")));
const backend = path.join(workspace, "backend"), ledgerDir = path.join(workspace, "budget-ledger");
fs.mkdirSync(backend, { recursive: true });
const runId = "720001", sourceSha = "a".repeat(40), ledgerSha = "b".repeat(40);
const creationSha = "c".repeat(40), previousSha = "d".repeat(40);
const dataDir = path.join(backend, ".pete-repeatable-qa-" + runId);
const grantId = "qa-20261025-owner-sol-separate-3usd";
const approval = { grantId, capMicroUsd: 3_000_000,
  ownerApprovalRef: "owner:2026-10-25-separate-sol-3usd",
  approvalEvidenceUrl: "https://github.com/VSCodeBot78/funnelpilot-whatsapp-app/pull/191#issuecomment-6400728469" };
const grant = createPeteQaOwnerGrant(approval);
const request = { version: 2, budgetUsd: "2.00", testSet: "sales20", ownerGrantId: grantId,
  ownerApprovalRef: grant.ownerApprovalRef, grantApprovalSha256: grant.approvalSha256 };
const legacy = { version: 1, capMicroUsd: 8_000_000, spentMicroUsd: 7_817_830,
  reservedMicroUsd: 0, activeReservations: {}, extraOwnerQa20261022: {
    authorizedEur: 5, conservativeUsdCapMicro: 5_000_000,
    oldProjectCapMicroUsd: 8_000_000, oldProjectSpendAtApprovalMicroUsd: 7_817_830,
    usedMicroUsd: 4_882_540, reservedMicroUsd: 0, reservations: {},
    batches: [{ id: "old", runId: "700000", chargeMicroUsd: 4_882_540 }] } };
const created = { ...structuredClone(legacy), qaOwnerGrantsV1: { [grantId]: grant } };
const safeEnv = { ...process.env, NODE_ENV: "test", DATA_DIR: dataDir,
  GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_RUN_ATTEMPT: "1",
  GITHUB_RUN_ID: runId, GITHUB_SHA: sourceSha, GITHUB_WORKSPACE: workspace,
  GITHUB_REPOSITORY: "VSCodeBot78/funnelpilot-whatsapp-app",
  GITHUB_REF: "refs/heads/feat/pete-policy-v4-20261022",
  OPENAI_MODEL: "gpt-6.1-sol", OPENAI_API_KEY: "SYNTHETIC-never-network",
  PETE_REPEATABLE_QA_ENABLED: "true", PETE_LLM_CONVERSATION_ENABLED: "true",
  PETE_LLM_API_CALLS_APPROVED: "true", INSTAGRAM_ENGINE_ENABLED: "false",
  INSTAGRAM_SEND_ENABLED: "false", WHATSAPP_SEND_ENABLED: "false",
  ENABLE_GENERIC_WEBHOOKS: "false", PETE_MOBILE_LAB_ENABLED: "false",
  INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "false", WHATSAPP_ALLOW_ALL_RECIPIENTS: "false",
  INSTAGRAM_ALLOW_ALL_SENDERS: "false", DISABLE_DESTRUCTIVE_ROUTES: "true" };
Object.assign(process.env, safeEnv);
const budget = await import("../services/pete-api-budget.service.js");
const { getPeteLlmConversationReply } = await import("../core/pete-llm-conversation.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getOrCreateConversationState, takeOverByHuman } = await import("../core/state-manager.js");
const { evaluateLatestAiOutboundPermission } = await import("../services/ai-outbound-guard.service.js");
const json = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value) + "\n");
const ledgerFile = path.join(ledgerDir, "phase3-budget-ledger.json");
const localFile = path.join(dataDir, "pete-api-budget.json");
const manifestFile = path.join(workspace, "qa", "pete-approved-test.json");
let remoteLedger: any, sourceRemote = sourceSha, ledgerRemote = ledgerSha;
let dirty = false, shallow = false, gitFailure = false;
let snapshots: Record<string, any>;
const gitCalls: string[][] = [];
function mockGit(_file: any, args: any = []): any {
  assert.equal(_file, "git");
  assert.equal(args[0], "-C");
  const directory = args[1], command = args.slice(2);
  gitCalls.push(command);
  if (gitFailure) throw Error("SYNTHETIC git read unavailable");
  if (command.join(" ") === "remote get-url origin") return "https://github.com/VSCodeBot78/funnelpilot-whatsapp-app.git\n";
  if (command.join(" ") === "rev-parse HEAD") return directory === workspace ? sourceSha : ledgerSha;
  if (command[0] === "ls-remote") return (directory === workspace ? sourceRemote : ledgerRemote) + "\t" + command[3];
  if (command[0] === "diff") return dirty ? "scripts/pete-repeatable-qa-contract.mjs\n" : "";
  if (command.join(" ") === "rev-parse --is-shallow-repository") return String(shallow);
  if (command[0] === "show") {
    if (directory === workspace) return JSON.stringify(request);
    const id = command[1].split(":")[0];
    return JSON.stringify(id === ledgerSha ? remoteLedger : snapshots[id]);
  }
  if (command[0] === "log") return [ledgerSha, creationSha, previousSha].join("\n");
  throw Error("Unexpected git operation: " + command.join(" "));
}
function reset() {
  Object.assign(process.env, safeEnv);
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(ledgerDir, { recursive: true });
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  json(manifestFile, request);
  const held = preparePeteQaReservation(process.env, created, request).ledger;
  remoteLedger = held; snapshots = { [creationSha]: created, [previousSha]: legacy };
  sourceRemote = sourceSha; ledgerRemote = ledgerSha;
  dirty = shallow = gitFailure = false; gitCalls.length = 0;
  json(ledgerFile, held);
  const hold = held.qaOwnerGrantsV1[grantId].reservations["pete-qa-" + runId];
  json(localFile, { version: 1, priorSpentMicroUsd: 0, capMicroUsd: hold.micro,
    committedMicroUsd: 0, confirmedMicroUsd: 0, reservedMicroUsd: 0, requestsStarted: 0,
    requestsMetered: 0, billedInputTokens: 0, billedOutputTokens: 0, pending: {}, qaGrant: hold });
  writeSettings({ aiEnabled: true });
}
const providerState = () => ({ campaignId: "eltern-vital-fit", answers: {},
  messages: [{ role: "user", text: "Ich bin abends müde und möchte weniger Bauchfett." }] } as any);

test("Separate QA grant is enforced by the actual provider service, no network", async t => {
  const cwd = process.cwd(), originalFetch = globalThis.fetch;
  const nativeGit = childProcess.execFileSync;
  childProcess.execFileSync = mockGit;
  syncBuiltinESMExports();
  process.chdir(backend);
  let calls = 0, payloadUsage: unknown = { input_tokens: 100, output_tokens: 20 };
  let timeout = false;
  globalThis.fetch = async url => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    calls++;
    if (timeout) throw Error("SYNTHETIC timeout, no network");
    return new Response(JSON.stringify({ usage: payloadUsage,
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        reply: "Was kostet dich abends gerade am meisten Energie?", needsHuman: false,
        nextStep: "none", evidenceQuote: "" }) }] }] }), { status: 200 });
  };
  t.after(() => { process.chdir(cwd); childProcess.execFileSync = nativeGit;
    syncBuiltinESMExports(); globalThis.fetch = originalFetch;
    fs.rmSync(workspace, { recursive: true, force: true }); });

  await t.test("remote-held USD2 cap is independent of the exhausted old pool and bills actual usage", async () => {
    reset(); calls = 0;
    assert.equal(getPeteQaRuntimeAuthorization(process.env).micro, 2_000_000);
    const before = budget.getPeteBudgetStatus();
    assert.equal(before.ownerGrantId, grantId); assert.equal(before.budgetScope, "owner_qa_grant");
    assert.equal(before.hardCapUsd, 2); assert.equal(before.remainingUsd, 2);
    const result = await getPeteLlmConversationReply(providerState());
    assert.equal(result.kind, "llm"); assert.equal(calls, 1);
    assert.equal(budget.getPeteBudgetStatus().confirmedUsd, .0004);
    assert.equal(budget.getPeteBudgetStatus().reservedUsd, 0);
    assert.deepEqual(remoteLedger.extraOwnerQa20261022, legacy.extraOwnerQa20261022);
    assert.ok(gitCalls.filter(c => c[0] === "ls-remote").length >= 4,
      "both refs are read again by the provider, not trusted from workflow env");
    runPeteQaLedgerCommand("settle", process.env, workspace);
    const settled = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
    assert.equal(settled.qaOwnerGrantsV1[grantId].usedMicroUsd, 400);
    assert.equal(settled.qaOwnerGrantsV1[grantId].reservedMicroUsd, 0);
  });
  for (const [name, alter] of [
    ["failed remote push", () => { ledgerRemote = "e".repeat(40); }],
    ["source ref advanced", () => { sourceRemote = "e".repeat(40); }],
    ["uncommitted source", () => { dirty = true; }],
    ["missing git history", () => { shallow = true; }],
    ["git read failure", () => { gitFailure = true; }],
    ["uncommitted local ledger", () => json(ledgerFile, created)],
    ["missing local receipt", () => fs.rmSync(localFile)],
    ["wrong approval ref", () => json(manifestFile, { ...request, ownerApprovalRef: "owner:some-other-approval" })],
    ["missing secret", () => { delete process.env.OPENAI_API_KEY; }],
    ["replayed GitHub attempt", () => { process.env.GITHUB_RUN_ATTEMPT = "2"; }],
    ["wrong model", () => { process.env.OPENAI_MODEL = "gpt-4.1-mini"; }],
    ["WhatsApp send enabled", () => { process.env.WHATSAPP_SEND_ENABLED = "true"; }],
    ["Instagram send enabled", () => { process.env.INSTAGRAM_SEND_ENABLED = "true"; }],
    ["rehash/reset of already committed history", () => {
      snapshots[creationSha] = remoteLedger; remoteLedger = created; json(ledgerFile, created);
    }],
  ] as [string, () => void][]) await t.test(name + " stops before provider network", async () => {
    reset(); calls = 0; alter();
    const result = await getPeteLlmConversationReply(providerState());
    assert.equal(result.kind, "handoff"); assert.equal(calls, 0);
  });
  await t.test("secret/env/lead supplied cap cannot enlarge the remotely held run", () => {
    reset(); process.env.PETE_QA_BUDGET_USD = "1000.00";
    process.env.PETE_OWNER_GRANT_CAP_MICRO_USD = "1000000000";
    assert.equal(budget.getPeteBudgetStatus().remainingUsd, 2);
    assert.throws(() => budget.reservePeteBudget({ model: "gpt-6.1-sol",
      requestBody: "x".repeat(1_000_000), maxOutputTokens: 1200 }));
    assert.equal(budget.getPeteBudgetStatus().requestsStarted, 0);
    delete process.env.PETE_QA_BUDGET_USD; delete process.env.PETE_OWNER_GRANT_CAP_MICRO_USD;
  });
  await t.test("pending call prevents a concurrent second provider reservation", () => {
    reset(); const p = { model: "gpt-6.1-sol", requestBody: "x", maxOutputTokens: 1200 };
    const id = budget.reservePeteBudget(p);
    assert.throws(() => budget.reservePeteBudget(p));
    assert.equal(budget.getPeteBudgetStatus().requestsStarted, 1);
    assert.equal(budget.settlePeteBudget(id, { input_tokens: 100, output_tokens: 20 }), true);
    assert.equal(budget.settlePeteBudget(id, { input_tokens: 100, output_tokens: 20 }), false);
  });
  for (const kind of ["timeout", "missing usage", "excessive usage"]) await t.test(kind + " keeps its hold and forbids retry", async () => {
    reset(); calls = 0; timeout = kind === "timeout";
    payloadUsage = kind === "missing usage" ? undefined : { input_tokens: 10_000_000, output_tokens: 20 };
    try {
      await getPeteLlmConversationReply(providerState());
      assert.equal(calls, 1);
      const receipt = JSON.parse(fs.readFileSync(localFile, "utf8"));
      assert.ok(receipt.reservedMicroUsd > 0);
      await getPeteLlmConversationReply(providerState());
      assert.equal(calls, 1, "no second call with uncertain first usage");
      runPeteQaLedgerCommand("settle", process.env, workspace);
      const settled = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
      assert.equal(settled.qaOwnerGrantsV1[grantId].reservedMicroUsd, 2_000_000);
      assert.equal(settled.qaOwnerGrantsV1[grantId].reservations["pete-qa-" + runId].status, "uncertain");
    } finally { timeout = false; payloadUsage = { input_tokens: 100, output_tokens: 20 }; }
  });
  await t.test("bridge creates a bound receipt once; unpushed reservation is denied by provider", async () => {
    reset(); remoteLedger = created; json(ledgerFile, created); fs.rmSync(localFile);
    runPeteQaLedgerCommand("preflight", process.env, workspace);
    runPeteQaLedgerCommand("reserve", process.env, workspace);
    assert.ok(fs.existsSync(localFile));
    assert.throws(() => getPeteQaRuntimeAuthorization(process.env), /remote_ref|not_committed/);
    assert.throws(() => runPeteQaLedgerCommand("reserve", process.env, workspace));
    calls = 0; await getPeteLlmConversationReply(providerState()); assert.equal(calls, 0);
  });
  await t.test("STOP, human ownership and sales opt-out remain stronger than a valid grant", async () => {
    reset(); calls = 0;
    const send = (id: string, text: string) => processIncomingMessage({ leadId: id,
      campaignId: "eltern-vital-fit", messageText: text, conversationMode: "natural" });
    const stopped = await send("qa-stop", "STOP. Bitte kontaktiere mich nicht mehr.");
    assert.equal(stopped.state.flags.stopped, true);
    const follow = await send("qa-stop", "Hallo"); assert.equal(follow.text, null);
    const human = getOrCreateConversationState("qa-human", "eltern-vital-fit"); takeOverByHuman(human);
    assert.equal((await send("qa-human", "Ich brauche Hilfe")).text, null);
    const refused = await send("qa-refused", "Passt, ich will erst nachdenken und keine Verkaufsnachricht.");
    assert.equal(refused.state.flags.salesFollowUpsOptedOut, true);
    assert.equal(evaluateLatestAiOutboundPermission({ leadId: "qa-refused", campaignId: "eltern-vital-fit",
      purpose: "automated_followup" }).allowed, false);
    assert.equal(calls, 0);
  });
});
