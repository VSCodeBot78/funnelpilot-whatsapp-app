/**
 * Reusable founder-approved Pete Sol QA with synthetic leads ONLY.
 * Does not send Instagram, WhatsApp, calendar or checkout actions.
 * The workflow reserves and REMOTELY persists an owner-budget allowance
 * before this program may pass the local budget guard.
 */
import fs from "node:fs";
import path from "node:path";
import { runQaDialogues, validateQaCases } from "./pete-repeatable-qa-evidence.js";

const env = process.env;
if (env.GITHUB_ACTIONS !== "true" ||
    env.GITHUB_EVENT_NAME !== "push" ||
    env.GITHUB_REPOSITORY !== "VSCodeBot78/funnelpilot-whatsapp-app" ||
    env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
    env.GITHUB_RUN_ATTEMPT !== "1" ||
    !/^[0-9]{5,}$/.test(env.GITHUB_RUN_ID ?? "") ||
    env.NODE_ENV !== "test" ||
    env.PETE_REPEATABLE_QA_ENABLED !== "true" ||
    env.OPENAI_MODEL !== "gpt-6.1-sol" ||
    env.PETE_LLM_CONVERSATION_ENABLED !== "true" ||
    env.PETE_LLM_API_CALLS_APPROVED !== "true" ||
    env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
    env.INSTAGRAM_SEND_ENABLED !== "false" ||
    env.WHATSAPP_SEND_ENABLED !== "false" ||
    env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
    env.PETE_MOBILE_LAB_ENABLED !== "false" ||
    !env.OPENAI_API_KEY?.trim() ||
    !env.GITHUB_WORKSPACE) throw Error("pete_repeatable_qa_not_authorized");

const workspace = path.resolve(env.GITHUB_WORKSPACE);
if (path.resolve(process.cwd()) !== path.join(workspace, "backend") ||
    path.resolve(env.DATA_DIR ?? "") !==
      path.join(workspace, "backend", ".pete-repeatable-qa-" + env.GITHUB_RUN_ID))
  throw Error("pete_repeatable_qa_not_isolated");

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const request = readJson(path.join(workspace, "qa", "pete-approved-test.json"));
const catalog = readJson(path.join(workspace, "scripts", "pete-repeatable-qa-cases.json"));
if (request.version !== 1 ||
    !["sales20", "sales32", "focus15"].includes(request.testSet) ||
    catalog.version !== 1 ||
    !Array.isArray(catalog.known) || catalog.known.length !== 20 ||
    !Array.isArray(catalog.blind) || catalog.blind.length !== 12 ||
    !Array.isArray(catalog.focus) || catalog.focus.length !== 5 ||
    !Array.isArray(catalog.fresh) || catalog.fresh.length !== 10)
  throw Error("qa_catalog_or_approval_invalid");
const cases = request.testSet === "focus15"
  ? [...catalog.focus, ...catalog.fresh]
  : request.testSet === "sales32"
    ? [...catalog.known, ...catalog.blind]
    : [...catalog.known];
validateQaCases(cases);

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getPeteBudgetStatusSafe } = await import("../services/pete-api-budget.service.js");
const before = getPeteBudgetStatusSafe();
if (!before.ok || before.blocked ||
    before.labAuthorizedUsd !== Number(request.budgetUsd) ||
    before.requestsStarted !== 0)
  throw Error("qa_ledger_preflight_denied");
writeSettings({ aiEnabled: true, aiModel: "gpt-6.1-sol" });

const evidence = await runQaDialogues({
  cases, budget: getPeteBudgetStatusSafe,
  reply: (id, messageText) => processIncomingMessage({
    leadId: "pete-repeatable-qa-" + env.GITHUB_RUN_ID + "-" + id,
    campaignId: DEFAULT_CAMPAIGN_ID, messageText, conversationMode: "natural",
  }),
  onCase: result => console.log("QA_CASE " + JSON.stringify(result)),
});

const budget = getPeteBudgetStatusSafe();
const report = {
  version: 1, kind: "pete_repeatable_synthetic_sol_qa",
  runId: env.GITHUB_RUN_ID,
  sourceSha: env.GITHUB_SHA, model: "gpt-6.1-sol",
  testSet: request.testSet,
  ownerApprovalRef: request.ownerApprovalRef,
  approvedBudgetUsd: request.budgetUsd,
  ...evidence, budget,
  automaticGrade: null, // Never claim an 18/20 real quality score automatically.
};
const outdir = path.join(workspace, "backend", "qa-reports");
fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(path.join(outdir, "pete-repeatable-sol-" + env.GITHUB_RUN_ID + ".json"),
  JSON.stringify(report, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
console.log("QA_SUMMARY " + JSON.stringify({
  runId: env.GITHUB_RUN_ID, sourceSha: env.GITHUB_SHA,
  completed: evidence.totalCompleted, planned: cases.length,
  modelResponses: evidence.modelResponses, providerResponses: evidence.providerResponses,
  sourceCounts: evidence.sourceCounts, suppressedTurns: evidence.suppressedTurns,
  haltedReason: evidence.haltedReason, budget,
}));
if (evidence.haltedReason || !budget.ok || evidence.totalCompleted !== cases.length ||
    evidence.modelResponses === 0) process.exitCode = 1;
