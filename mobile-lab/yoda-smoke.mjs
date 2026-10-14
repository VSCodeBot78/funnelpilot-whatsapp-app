/**
 * One-shot PRIVATE LAB GPT-5.4 smoke evaluation, synthetic conversations only.
 * Invoked only on explicit Railway PETE_LAB_YODA_SMOKE_ONCE=20261014-v1.
 * Calls loopback test-chat routes; budget checks and hard caps stay authoritative.
 * Persistent marker prevents repeating paid calls on container restart.
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { writeFileSync, existsSync } from "node:fs";

const RUN_TAG = "20261014-v1";
const MAX_LLM_CALLS = 6;

const CASES = [
  { name: "Elternteil mit Zeitdruck", scenarioId: "follower",
    replies: ["Ich bin Mama von zwei Kindern, arbeite Vollzeit und habe kaum Zeit. Ich will wieder Energie, aber keine neue Diät."] },
  { name: "Preis-Einwand und klares Nein", scenarioId: "follower",
    replies: ["499 Euro sind mir momentan zu viel. Was wäre dein Vorschlag?",
              "Nein danke, ich will momentan nichts kaufen."] },
  { name: "ManyChat-Keto ohne Pitch", scenarioId: "manychat_keto_handoff",
    replies: ["Danke für den kostenlosen Guide. Ich will derzeit ausdrücklich kein Coaching."] },
  { name: "Mensch hat übernommen", scenarioId: "jochen_greeting",
    replies: ["Kannst du für mich direkt einen Termin buchen?"] },
];

export async function runPeteYodaSmoke({ dataDir, port, adminSecret }) {
  if (process.env.PETE_LAB_YODA_SMOKE_ONCE !== RUN_TAG) return;
  if (process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD !== "2000000" ||
      process.env.OPENAI_MODEL !== "gpt-5.4" ||
      process.env.PETE_LLM_CONVERSATION_ENABLED !== "true" ||
      process.env.PETE_LLM_API_CALLS_APPROVED !== "true" ||
      process.env.PETE_MOBILE_LAB_GPT54_CONSENT !== "true")
    throw Error("yoda_smoke_gpt54_consent_incomplete");
  const marker = join(dataDir, ".pete-yoda-smoke-" + RUN_TAG + ".started");
  if (existsSync(marker)) {
    console.log("[yoda-smoke] Previous run marker found; no paid calls repeated");
    return;
  }
  const base = "http://127.0.0.1:" + port + "/test-chat/lab/";
  const headers = { "x-funnelpilot-admin-ingress": adminSecret, "content-type": "application/json" };
  async function api(method, route, body) {
    const response = await fetch(base + route, {
      method, headers, ...(body ? {body: JSON.stringify(body)} : {}),
      signal: AbortSignal.timeout(65_000),
    });
    const payload = await response.json();
    if (!response.ok || payload.ok !== true)
      throw Error("lab_api_failed_" + response.status + "_" + String(payload.error || payload.reason || "").slice(0,70));
    return payload;
  }
  // Await backend readiness without starting chargeable requests.
  let budget;
  for (let i = 0; i < 35; i++) {
    try { budget = await api("GET", "budget"); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  if (!budget || budget.mode !== "gpt-5.4" || budget.llmReady !== true ||
      budget.labAuthorizedUsd !== 2 || budget.blocked ||
      !Number.isFinite(budget.labRemainingUsd) || budget.labRemainingUsd < 0.25)
    throw Error("yoda_smoke_budget_or_model_unavailable");

  // Claim run BEFORE spending: crash/restart will never repeat any paid calls.
  writeFileSync(marker, new Date().toISOString() + "\n", { flag: "wx", mode: 0o600 });
  console.log("[yoda-smoke] BEGIN " + RUN_TAG + " remain=" + budget.labRemainingUsd.toFixed(4) + " USD");
  let llmCalls = 0, unexpected = 0;
  for (const testCase of CASES) {
    const leadId = "lab_" + randomUUID().replaceAll("-", "");
    const go = async (method, route, message) => {
      const previous = await api("GET", "budget");
      if (previous.blocked || previous.labRemainingUsd < 0.075 ||
          llmCalls >= MAX_LLM_CALLS) throw Error("yoda_smoke_local_cost_guard");
      const reply = await api(method, route, message);
      if (reply.replySource === "llm") llmCalls++;
      if (reply.replySource !== "llm" &&
          reply.replySource !== "scripted_context" &&
          reply.replySource !== "human_manual" &&
          reply.replySource !== "human_owned") unexpected++;
      console.log("[yoda-smoke] " + JSON.stringify({
        case: testCase.name, source: reply.replySource,
        suppressed: reply.replySuppressedReason ?? null,
        reply: typeof reply.reply === "string" ? reply.reply.slice(0, 800) : null,
      }));
    };
    try {
      await go("POST", "start", {leadId, scenarioId: testCase.scenarioId});
      for (const messageText of testCase.replies) {
        await go("POST", "message", {leadId, messageText});
      }
    } catch(e) {
      console.error("[yoda-smoke] CASE_STOP " + testCase.name + ": " +
        (e instanceof Error ? e.message : String(e)));
      if (/cost_guard|budget_|unavailable|incomplete/.test(String(e))) break;
    }
  }
  const after = await api("GET", "budget");
  console.log("[yoda-smoke] END " + JSON.stringify({
    llmCalls, unexpected, beforeLabUsd: budget.labCommittedUsd,
    afterLabUsd: after.labCommittedUsd,
    newSpentUsd: Math.max(0, after.labCommittedUsd-budget.labCommittedUsd),
    remainingUsd: after.labRemainingUsd,
    requestsMetered: after.requestsMetered,
    tokenInput: after.inputTokens, tokenOutput: after.outputTokens,
    noMetaSend: true,
  }));
}
