/** Backend Pete ledger, NEVER the actual OpenAI account balance. */
export function readPeteBudget(raw) {
  if (!raw || raw.ok !== true || !Number.isFinite(raw.hardCapUsd) ||
      raw.hardCapUsd <= 0 || !Number.isFinite(raw.committedUsd) ||
      !Number.isFinite(raw.confirmedUsd) || !Number.isFinite(raw.reservedUsd) ||
      !Number.isFinite(raw.remainingUsd) || raw.committedUsd < 0 ||
      raw.confirmedUsd < 0 || raw.reservedUsd < 0 || raw.remainingUsd < 0 ||
      Math.abs(raw.committedUsd - raw.confirmedUsd - raw.reservedUsd) > 0.000002) return null;
  return {
    cap: raw.hardCapUsd,
    spent: raw.committedUsd,
    confirmed: raw.confirmedUsd,
    reserved: raw.reservedUsd,
    left: raw.remainingUsd,
    started: Number.isSafeInteger(raw.requestsStarted) ? raw.requestsStarted : null,
    metered: Number.isSafeInteger(raw.requestsMetered) ? raw.requestsMetered : null,
    inputTokens: Number.isSafeInteger(raw.inputTokens) ? raw.inputTokens : null,
    outputTokens: Number.isSafeInteger(raw.outputTokens) ? raw.outputTokens : null,
    blocked: raw.blocked === true || raw.remainingUsd <= 0,
    low: raw.remainingUsd <= Math.max(0.01, raw.hardCapUsd * 0.2),
  };
}

export function formatUsd(value, digits = 4) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? "$" + value.toFixed(digits)
    : "nicht verfügbar";
}

/** Approximate server ledger delta, not attributable if others test concurrently. */
export function budgetCounterChange(before, after) {
  if (!before || !after) return null;
  const delta = after.spent - before.spent;
  return Number.isFinite(delta) && delta >= 0 ? delta : null;
}
