/**
 * Reusable founder-approved Pete Sol QA with synthetic leads ONLY.
 * Does not send Instagram, WhatsApp, calendar or checkout actions.
 * The workflow reserves and REMOTELY persists an owner-budget allowance
 * before this program may pass the local budget guard.
 */
import fs from "node:fs";
import path from "node:path";

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
if (cases.some((c: { id?: unknown; lines?: unknown }) =>
  typeof c.id !== "string" ||
  !Array.isArray(c.lines) || c.lines.length !== 2 ||
  c.lines.some((s: unknown) => typeof s !== "string" || s.length > 500)))
  throw Error("qa_invalid_synthetic_case");

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

type QaReply = {
  user: string; reply: string | null; source: string;
  intent: string | null; blockedReason: string | null;
};
const results: {
  id: string; turns: QaReply[]; modelTurns: number; totalTurns: number;
}[] = [];
let modelResponses = 0, verifiedResponses = 0, haltedReason: string | null = null;
outer: for (const entry of cases) {
  const transcript: QaReply[] = [];
  for (const leadMessage of entry.lines) {
    const budget = getPeteBudgetStatusSafe();
    if (!budget.ok || budget.blocked) {
      haltedReason = "cost_ceiling_reached";
      break outer;
    }
    let out;
    try {
      out = await processIncomingMessage({
        leadId: "pete-repeatable-qa-" + env.GITHUB_RUN_ID + "-" + entry.id,
        campaignId: DEFAULT_CAMPAIGN_ID,
        messageText: leadMessage,
        conversationMode: "natural",
      });
    } catch {
      haltedReason = "engine_error";
      break outer;
    }
    const source = String(out.state.answers.peteReplySource ?? "unknown");
    if (source === "llm") modelResponses++;
    else verifiedResponses++;
    transcript.push({
      user: leadMessage, reply: out.text,
      source, intent: out.detectedIntent ?? null,
      blockedReason: out.replySuppressedReason ?? null,
    });
  }
  results.push({
    id: entry.id, turns: transcript, modelTurns:
      transcript.filter(t => t.source === "llm").length,
    totalTurns: transcript.length,
  });
}
const budget = getPeteBudgetStatusSafe();
const report = {
  version: 1, kind: "pete_repeatable_synthetic_sol_qa",
  runId: env.GITHUB_RUN_ID,
  sourceSha: env.GITHUB_SHA, model: "gpt-6.1-sol",
  testSet: request.testSet,
  ownerApprovalRef: request.ownerApprovalRef,
  approvedBudgetUsd: request.budgetUsd,
  totalPlanned: cases.length, totalCompleted: results.length,
  modelResponses, verifiedResponses, haltedReason,
  budget, cases: results,
  automaticGrade: null, // Never claim an 18/20 real quality score automatically.
};
const outdir = path.join(workspace, "backend", "qa-reports");
fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(path.join(outdir, "pete-repeatable-sol-" + env.GITHUB_RUN_ID + ".json"),
  JSON.stringify(report, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
console.log("QA_SUMMARY " + JSON.stringify({
  runId: env.GITHUB_RUN_ID, completed: results.length, planned: cases.length,
  modelResponses, verifiedResponses, haltedReason,
  actualCommittedUsd: budget.ok ? budget.labCommittedUsd : null,
}));
if (haltedReason || !budget.ok || results.length !== cases.length ||
    modelResponses === 0) process.exitCode = 1;
