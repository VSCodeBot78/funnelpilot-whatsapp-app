/** Offline orchestration only. The existing engine owns every API reservation. */
export type QaBudget = {
  ok: boolean; blocked?: boolean; requestsStarted?: number; requestsMetered?: number;
  inputTokens?: number; outputTokens?: number; confirmedUsd?: number; reservedUsd?: number;
};
type QaReply = {
  text: string | null; detectedIntent?: unknown; replySuppressedReason?: unknown;
  state: { answers: Record<string, unknown>; owner?: string; aiPaused?: boolean;
    flags: { stopped?: boolean } };
};
export type QaCase = { id: string; lines: string[] };
export function validateQaCases(cases: unknown): asserts cases is QaCase[] {
  if (!Array.isArray(cases) || new Set(cases.map(c => c?.id)).size !== cases.length ||
      cases.some(c => typeof c?.id !== "string" || !/^[A-Za-z0-9-]{1,90}$/.test(c.id) ||
        !Array.isArray(c.lines) || !(c.lines.length === 2 ||
          (c.lines.length >= 6 && c.lines.length <= 12)) ||
        c.lines.some((s: unknown) => typeof s !== "string" || !s.trim() || s.length > 500)))
    throw Error("qa_invalid_synthetic_case");
}
export async function runQaDialogues(args: {
  cases: QaCase[]; budget: () => QaBudget;
  reply: (id: string, message: string) => Promise<QaReply>;
  onCase?: (result: unknown) => void;
}) {
  validateQaCases(args.cases);
  const results: { id: string; plannedLeadTurns: number; completed: boolean;
    modelTurns: number; turns: Record<string, unknown>[] }[] = [];
  const sourceCounts: Record<string, number> = {};
  let modelResponses = 0, providerResponses = 0, suppressedTurns = 0;
  let haltedReason: string | null = null;
  for (const entry of args.cases) {
    const result = { id: entry.id, plannedLeadTurns: entry.lines.length,
      completed: false, modelTurns: 0, turns: [] as Record<string, unknown>[] };
    for (const message of entry.lines) {
      const before = args.budget();
      if (!before.ok || before.blocked) { haltedReason = "cost_ceiling_or_ledger_unavailable"; break; }
      let out: QaReply;
      try { out = await args.reply(entry.id, message); }
      catch { haltedReason = "engine_error"; break; }
      const after = args.budget(), a = out.state.answers;
      const source = String(a.peteReplySource ?? "unknown");
      const emitted = typeof out.text === "string" && out.text.length > 0 && !out.replySuppressedReason;
      const started = (after.requestsStarted ?? 0) - (before.requestsStarted ?? 0);
      const metered = (after.requestsMetered ?? 0) - (before.requestsMetered ?? 0);
      const input = (after.inputTokens ?? 0) - (before.inputTokens ?? 0);
      const output = (after.outputTokens ?? 0) - (before.outputTokens ?? 0);
      const providerSucceeded = before.ok && after.ok && started === 1 && metered === 1;
      if (providerSucceeded) providerResponses++;
      const genuine = emitted && source === "llm" && providerSucceeded &&
        a.peteProviderUsageMetered === true && a.peteProviderModel === "gpt-6.1-sol" &&
        a.peteProviderInputTokens === input && a.peteProviderOutputTokens === output;
      if (genuine) { modelResponses++; result.modelTurns++; }
      if (emitted) sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
      else suppressedTurns++;
      const failure = typeof a.peteLlmFailureReason === "string" ? a.peteLlmFailureReason : null;
      result.turns.push({ user: message, reply: out.text, source: emitted ? source : "suppressed",
        realModelText: genuine, providerSucceeded,
        model: providerSucceeded ? "gpt-6.1-sol" : null,
        inputTokens: input, outputTokens: output, requestsStarted: started, requestsMetered: metered,
        confirmedCostMicroUsd: Math.round(((after.confirmedUsd ?? 0) - (before.confirmedUsd ?? 0)) * 1e6),
        reservedUsdAfter: after.reservedUsd ?? null,
        intent: out.detectedIntent ?? null, blockedReason: out.replySuppressedReason ?? null,
        failureReason: failure, failureDetail: a.peteLlmFailureDetail ?? null,
        semanticProposalRejected: genuine && a.peteSemanticProposalRejected === true,
        owner: out.state.owner ?? null, aiPaused: out.state.aiPaused ?? null,
        stopped: out.state.flags.stopped === true });
      if (!after.ok || started > metered) haltedReason = "provider_usage_unverified";
      else if (emitted && source === "llm" && !genuine) haltedReason = "llm_provenance_unverified";
      else if (["provider_unavailable", "budget_exhausted", "budget_unavailable", "invalid_output"].includes(failure ?? ""))
        haltedReason = failure;
      if (haltedReason) break;
    }
    result.completed = result.turns.length === entry.lines.length && !haltedReason;
    // Retain partial cases and their spend, even when a ceiling interrupts a dialogue.
    results.push(result);
    args.onCase?.(result);
    if (haltedReason) break;
  }
  return { cases: results, totalPlanned: args.cases.length,
    totalCompleted: results.filter(r => r.completed).length,
    modelResponses, providerResponses, sourceCounts, suppressedTurns, haltedReason };
}
