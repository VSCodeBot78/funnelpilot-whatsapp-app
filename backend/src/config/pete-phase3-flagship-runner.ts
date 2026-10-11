import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PETE_PHASE3_PERSONAS } from "./pete-phase3-scenarios.js";
import { PETE_PHASE3_REALISTIC, getRealisticPhase3Message } from "./pete-phase3-realistic-scenarios.js";

/** Independent ten-case flagship A/B sample: entirely fictional, no outbound. */
const batch = Number(process.argv[2]);
if (!Number.isInteger(batch) || batch < 0 || batch > 4 ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.PETE_PHASE3_APPROVED_RUN !== "FLAGSHIP_TEN_SYNTHETIC_CHATS" ||
    process.env.PETE_PHASE3_FLAGSHIP_ENVELOPE !== "true" ||
    process.env.OPENAI_MODEL !== "gpt-5.4" ||
    !process.env.OPENAI_API_KEY?.trim() ||
    process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
    process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
    process.env.WHATSAPP_SEND_ENABLED !== "false" ||
    process.env.PETE_LLM_CONVERSATION_ENABLED !== "true" ||
    process.env.PETE_LLM_API_CALLS_APPROVED !== "true") {
  throw Error("phase3_runner_missing_authorized_guard");
}
assert.equal(PETE_PHASE3_PERSONAS.length, 50);
assert.equal(new Set(PETE_PHASE3_PERSONAS.map(p => p.id)).size, 50);

const [{ DEFAULT_CAMPAIGN_ID }, { writeSettings },
  { processIncomingMessage }, { clearConversationStore },
  { getPeteBudgetStatus }] = await Promise.all([
  import("./campaigns.js"),
  import("../services/settings-store.js"),
  import("../core/conversation-engine.js"),
  import("../data/store.js"),
  import("../services/pete-api-budget.service.js"),
]);
writeSettings({ aiEnabled: true, dmConversationMode: "natural", testMode: true });
const reportDir = path.resolve("..", "phase3-flagship-reports");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "phase3-flagship-batch-" + batch + ".json");
const selected = [
  "family-01", "frustration-01", "frustration-06", "knowledge-01",
  "knowledge-02", "budget-05", "handoff-02", "handoff-03",
  "handoff-05", "switch-03",
];
if (PETE_PHASE3_REALISTIC.length !== 10 ||
    selected.some(id => !PETE_PHASE3_REALISTIC.some(c => c.id === id)))
  throw Error("Phase3 flagship scenario list is incomplete");
const target = selected.slice(batch * 2, (batch + 1) * 2);
const personas = target.map(id => {
  const match = PETE_PHASE3_PERSONAS.find(p => p.id === id);
  if (!match) throw Error("Missing comparison persona: " + id);
  return match;
});
assert.equal(personas.length, 2);
const report: any = {
  phase: 3,
  batch,
  model: "gpt-5.4",
  source: "genuine OpenAI Responses API if provider call recorded",
  warnings: [],
  completedPersonas: 0,
  totalLeadMessages: 0,
  plannedLeadMessages: 0,
  avoidedAfterTakeover: 0,
  providerCalls: 0,
  cases: [],
  startedAt: new Date().toISOString(),
};
let fatal: string | null = null;
const persist = () => {
  report.providerCalls = getPeteBudgetStatus().requestsStarted;
  report.budget = getPeteBudgetStatus();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
};
for (const persona of personas) {
  clearConversationStore();
  const leadId = "pete-phase3-flagship-fictional-" + persona.id;
  const entry: any = {
    id: persona.id, category: persona.category,
    fictionalPersona: persona.opener, messages: [], warnings: [],
    llmReplies: 0, deterministicReplies: 0, suppressedReplies: 0,
    safeNoncriticalReplies: 0, endedBy: "script_end",
    qualityStatus: "manual_review_required",
  };
  report.cases.push(entry);
  let previousReply = "";
  const scenario = PETE_PHASE3_REALISTIC.find(c => c.id === persona.id);
  if (!scenario) throw Error("Missing dialogue for " + persona.id);
  report.plannedLeadMessages += scenario.turns.length;
  for (let turn = 0; turn < scenario.turns.length; turn += 1) {
    const userText = getRealisticPhase3Message(persona.id, turn, previousReply);
    if (!userText) throw Error("Missing scripted user message");
    const result = await processIncomingMessage({
      leadId, campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: userText, conversationMode: "natural",
    });
    report.totalLeadMessages += 1;
    const source = String(result.state.answers.peteReplySource || "guarded");
    const reply = result.text ?? null;
    entry.messages.push({
      turn: turn + 1, lead: userText,
      pete: reply, source, owner: result.state.owner,
      suppressed: result.replySuppressedReason ?? null,
      handoffReason: result.state.answers.peteLlmFailureReason ?? null,
      handoffDetail: result.state.answers.peteLlmFailureDetail ?? null,
    });
    if (reply === null) entry.suppressedReplies++;
    else if (source === "llm") entry.llmReplies++;
    else if (source === "safe_noncritical") {
      entry.safeNoncriticalReplies++;
      entry.deterministicReplies++;
    } else entry.deterministicReplies++;
    if (reply) {
      previousReply = reply;
      if ((reply.match(/\?/g) ?? []).length > 1)
        entry.warnings.push("Multiple questions at turn " + (turn + 1));
      if (/[–—]|\p{Extended_Pictographic}/u.test(reply))
        entry.warnings.push("Artificial typography/emoji at turn " + (turn + 1));
      if (/woran ist es bisher meistens gescheitert|was hast du bisher versucht/i.test(reply) && turn >= 3)
        entry.warnings.push("Asks about prior attempts after already disclosed: turn " + (turn + 1));
      if (userText.includes("konkret") && reply.length < 95 && reply.trim().endsWith("?"))
        entry.warnings.push("Potential unanswered direct question at turn " + (turn + 1));
    }
    if (result.state.answers.peteLlmFailureReason === "provider_unavailable" ||
        result.state.answers.peteLlmFailureReason === "budget_unavailable" ||
        result.state.answers.peteLlmFailureReason === "budget_exhausted") {
      fatal = String(result.state.answers.peteLlmFailureReason);
      entry.warnings.push("Provider or budget stopped: " + fatal);
      break;
    }
    if (getPeteBudgetStatus().requestsStarted > 20)
      throw Error("phase3_flagship_batch_more_than_20_provider_calls");
    // A legitimate STOP, explicit human takeover or verified order handover
    // ends this fictional conversation. Do NOT keep submitting 9 more user
    // messages and count silence as a model-quality result.
    if (result.state.flags.stopped || result.state.owner === "human" ||
        result.state.aiPaused === true) {
      entry.endedBy = result.state.flags.stopped ? "stop" : "human_handover";
      report.avoidedAfterTakeover += scenario.turns.length - turn - 1;
      persist();
      break;
    }
    persist();
  }
  report.completedPersonas++;
  persist();
  console.log("Phase 3 batch " + batch + ": evaluated fictional case " +
    entry.id + " (" + entry.messages.length + " turns, " +
    entry.llmReplies + " LLM replies, " + entry.warnings.length + " warnings)");
  if (fatal) break;
}
report.completedAt = new Date().toISOString();
report.summary = {
  personaCount: report.completedPersonas,
  leadTurns: report.totalLeadMessages,
  plannedTurns: report.plannedLeadMessages,
  avoidedAfterTakeover: report.avoidedAfterTakeover,
  handovers: report.cases.filter((c: any) => c.endedBy === "human_handover").length,
  safeNoncriticalReplies: report.cases.reduce((n: number, c: any) => n + c.safeNoncriticalReplies, 0),
  modelReplies: report.cases.reduce((n: number, c: any) => n + c.llmReplies, 0),
  safetyOrDeterministicReplies: report.cases.reduce((n: number, c: any) => n + c.deterministicReplies, 0),
  suppressedReplies: report.cases.reduce((n: number, c: any) => n + c.suppressedReplies, 0),
  possibleDialogueDefects: report.cases.reduce((n: number, c: any) => n + c.warnings.length, 0),
  qualityApproval: "NOT_GRANTED_REQUIRES_HUMAN_REVIEW",
};
persist();
// The local Pete budget file is intentionally absent if every reply came
// from deterministic rules. Prove zero provider reservations in a separate
// attest file, tied to this exact job and batch, AFTER the run succeeded.
if (!fatal && report.completedPersonas === 2 &&
    report.providerCalls === 0 &&
    report.totalLeadMessages > 0) {
  const status = getPeteBudgetStatus();
  if (status.requestsStarted !== 0 || status.committedUsd !== 0 ||
      status.reservedUsd !== 0) throw Error("phase3_zero_calls_not_proven");
  const evidencePath = path.resolve(".phase3-data",
    "batch-" + batch, "pete-phase3-zero-calls.json");
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, JSON.stringify({
    version: 1, kind: "successful_flagship_no_provider_calls",
    runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
    batch, providerCalls: 0, completedPersonas: 2, success: true,
  }) + "\n", { encoding: "utf8", mode: 0o600 });
}
if (fatal) throw Error("phase3_abort_after_provider_or_budget_error_" + fatal);
if (report.completedPersonas !== 2 ||
    report.totalLeadMessages < 2 || report.totalLeadMessages > report.plannedLeadMessages ||
    report.avoidedAfterTakeover + report.totalLeadMessages !== report.plannedLeadMessages)
  throw Error("phase3_incomplete_or_inflated_batch");
if (batch <= 2 && report.providerCalls === 0)
  throw Error("phase3_no_real_model_calls_for_knowledge_or_family_batch");
