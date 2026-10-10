import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PETE_PHASE3_PERSONAS, getPhase3LeadMessage } from "./pete-phase3-scenarios.js";

/** The runner NEVER sends Meta or WhatsApp messages. All 50 profiles are synthetic. */
const batch = Number(process.argv[2]);
if (!Number.isInteger(batch) || batch < 0 || batch > 4 ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.PETE_PHASE3_APPROVED_RUN !== "FIFTY_SYNTHETIC_CHATS" ||
    process.env.PETE_PHASE3_BUDGET_ENVELOPE !== "true" ||
    process.env.OPENAI_MODEL !== "gpt-4.1-mini" ||
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
const reportDir = path.resolve("..", "phase3-reports");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "phase3-batch-" + batch + ".json");
const personas = PETE_PHASE3_PERSONAS.slice(batch * 10, (batch + 1) * 10);
assert.equal(personas.length, 10);
const report: any = {
  phase: 3,
  batch,
  model: "gpt-4.1-mini",
  source: "genuine OpenAI Responses API if provider call recorded",
  warnings: [],
  completedPersonas: 0,
  totalLeadMessages: 0,
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
  const leadId = "pete-phase3-fictional-" + persona.id;
  const entry: any = {
    id: persona.id, category: persona.category,
    fictionalPersona: persona.opener, messages: [], warnings: [],
    llmReplies: 0, deterministicReplies: 0, suppressedReplies: 0,
    qualityStatus: "manual_review_required",
  };
  report.cases.push(entry);
  let previousReply = "";
  for (let turn = 0; turn < 10; turn += 1) {
    const userText = getPhase3LeadMessage(persona, turn, previousReply);
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
    });
    if (reply === null) entry.suppressedReplies++;
    else if (source === "llm") entry.llmReplies++;
    else entry.deterministicReplies++;
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
    if (getPeteBudgetStatus().requestsStarted > 100)
      throw Error("phase3_batch_more_than_100_provider_calls");
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
  modelReplies: report.cases.reduce((n: number, c: any) => n + c.llmReplies, 0),
  safetyOrDeterministicReplies: report.cases.reduce((n: number, c: any) => n + c.deterministicReplies, 0),
  suppressedReplies: report.cases.reduce((n: number, c: any) => n + c.suppressedReplies, 0),
  possibleDialogueDefects: report.cases.reduce((n: number, c: any) => n + c.warnings.length, 0),
  qualityApproval: "NOT_GRANTED_REQUIRES_HUMAN_REVIEW",
};
persist();
if (fatal) throw Error("phase3_abort_after_provider_or_budget_error_" + fatal);
if (report.completedPersonas !== 10 || report.totalLeadMessages !== 100)
  throw Error("phase3_incomplete_batch");
if (report.providerCalls === 0) throw Error("phase3_no_real_model_calls");
