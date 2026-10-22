/**
 * Phase 3: deliberately conservative local Pete-only API spend guard.
 * This is not an account-wide OpenAI spending limit or live FX conversion.
 *
 * One backend process plus an exclusive filesystem lock protects reservations
 * across processes on a shared volume. A crashed process retains reservations
 * (fails closed). Never auto-reset this ledger on startup.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { resolvePeteRuntimeModel } from "../config/pete-model-selection.js";
import { writePrivateJsonAtomic } from "../data/private-json-file.js";

const USD_MICROS_CAP = 8_000_000; // Existing project-wide internal cap.
const PETE_QA_20261021_CAP_MICROS = 2_000_000; // Additional, strictly narrower QA authorization.

/**
 * The 21 Oct genuine-model QA run is opt-in AND only valid in a no-send GitHub
 * Actions test. This does not change existing production/lab authorizations.
 * Never allow a self-selected amount or a missing guard to raise this cap.
 */
function qualityQaCapMicros(): number | null {
  // One-use remainder holdout after a failed case; owner EUR5 ceiling unchanged.
  if (process.env.PETE_V42_REMAINDER_QA_ENABLED === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_V42_REMAINDER_QA_APPROVAL !== "once-20261022-eur5-usd0p70-remainder" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_MOBILE_LAB_ENABLED !== "false" ||
        process.env.PETE_V42_HOLDOUT_QA_ENABLED === "true" ||
        process.env.PETE_V42_SOL_QA_ENABLED === "true")
      throw new PeteBudgetStop("unavailable");
    return 700_000;
  }
  // Second independent holdout under the same extra EUR5 owner authorization.
  if (process.env.PETE_V42_HOLDOUT_QA_ENABLED === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_V42_HOLDOUT_QA_APPROVAL !== "once-20261022-eur5-usd0p75-holdout" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_MOBILE_LAB_ENABLED !== "false" ||
        process.env.PETE_V42_SOL_QA_ENABLED === "true" ||
        process.env.PETE_POLICY_V41_FINAL_QA_20261022 === "true")
      throw new PeteBudgetStop("unavailable");
    return 750_000;
  }
  // Extra owner authorization: EUR 5, conservatively at most USD 5 in
  // synthetic QA only. External shared budget script reserves BEFORE calls.
  // This does not change original USD 8 cap for normal Pete or live sends.
  if (process.env.PETE_V42_SOL_QA_ENABLED === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_V42_SOL_QA_APPROVAL !== "once-20261022-eur5-usd1-batch" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_MOBILE_LAB_ENABLED !== "false" ||
        process.env.PETE_POLICY_V41_BLIND_QA_20261022 === "true" ||
        process.env.PETE_POLICY_V41_FINAL_QA_20261022 === "true")
      throw new PeteBudgetStop("unavailable");
    return 1_000_000;
  }
  if (process.env.PETE_POLICY_V41_BLIND_QA_20261022 === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_POLICY_V41_BLIND_APPROVAL !== "once-sol-v41-blind-20261022-usd0p45" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_MOBILE_LAB_ENABLED === "true" ||
        process.env.PETE_POLICY_V41_FINAL_QA_20261022 === "true" ||
        process.env.PETE_POLICY_V4_HOLDOUT_QA_20261022 === "true")
      throw new PeteBudgetStop("unavailable");
    return 450_000;
  }
  // Final v4.1 synthetic-only Sol QA; shared persistent USD 8 ledger controls
  // one-time authorization before this local budget cap can be used.
  if (process.env.PETE_POLICY_V41_FINAL_QA_20261022 === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_POLICY_V41_FINAL_APPROVAL !== "once-sol-v41-final-20261022-usd0p85" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_MOBILE_LAB_ENABLED === "true" ||
        process.env.PETE_POLICY_V4_HOLDOUT_QA_20261022 === "true" ||
        process.env.PETE_POLICY_V4B_QA_20261022 === "true")
      throw new PeteBudgetStop("unavailable");
    return 850_000;
  }
  // One additional genuinely new synthetic holdout batch, at most USD0.80.
  // It is not a re-run or reset of either settled Policy-v4 batch.
  if (process.env.PETE_POLICY_V4_HOLDOUT_QA_20261022 === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_POLICY_V4_HOLDOUT_APPROVAL !== "once-sol-v4-holdout-20261022-usd0p80" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_POLICY_V4_QA_20261022 === "true" ||
        process.env.PETE_POLICY_V4B_QA_20261022 === "true" ||
        process.env.PETE_YODA3_QA_20261021 === "true" ||
        process.env.PETE_QUALITY_QA_20261021 === "true")
      throw new PeteBudgetStop("unavailable");
    return 800_000;
  }
  // Second owner-approved one-time Sol QA. Never reuses the first reservation.
  if (process.env.PETE_POLICY_V4B_QA_20261022 === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_POLICY_V4B_APPROVAL !== "once-sol-v4b-20261022-usd1p25" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_POLICY_V4_QA_20261022 === "true" ||
        process.env.PETE_YODA3_QA_20261021 === "true" ||
        process.env.PETE_QUALITY_QA_20261021 === "true")
      throw new PeteBudgetStop("unavailable");
    return 1_250_000;
  }
  // Policy-v4 approved synthetic QA only. The shared project ledger still
  // enforces the old USD 8 lifetime ceiling before a single paid model call.
  if (process.env.PETE_POLICY_V4_QA_20261022 === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_POLICY_V4_APPROVAL !== "once-sol-20261022-usd1p5" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_YODA3_QA_20261021 === "true" ||
        process.env.PETE_QUALITY_QA_20261021 === "true")
      throw new PeteBudgetStop("unavailable");
    return 1_500_000;
  }
  if (process.env.PETE_YODA3_QA_20261021 === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/pete-yoda3-retest-20261021" ||
        process.env.PETE_YODA3_APPROVAL !== "single-retest-20261021-usd5" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-4.1-mini" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_QUALITY_QA_20261021 === "true") throw new PeteBudgetStop("unavailable");
    return 1_000_000; // One new USD 1 hold, inside owner-approved USD 5 and remaining USD 8 lifetime cap.
  }
  if (process.env.PETE_QUALITY_QA_20261021 !== "true") return null;
  if (process.env.GITHUB_ACTIONS !== "true" ||
      process.env.PETE_QUALITY_QA_APPROVAL !== "single-run-20261021" ||
      process.env.NODE_ENV !== "test" ||
      process.env.OPENAI_MODEL !== "gpt-4.1-mini" ||
      process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
      process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
      process.env.WHATSAPP_SEND_ENABLED !== "false" ||
      process.env.ENABLE_GENERIC_WEBHOOKS !== "false") {
    throw new PeteBudgetStop("unavailable");
  }
  if (process.env.PETE_QUALITY_QA_ROUND2_20261021 === "true") {
    // Only the preauthorized third batch, never an additional $2.
    if (process.env.GITHUB_REF !== "refs/heads/pete-quality-real-round2-20261021" ||
        process.env.PETE_QUALITY_QA_RESUME_20261021 === "true") {
      throw new PeteBudgetStop("unavailable");
    }
    return 400_000; // USD 0.40 for this one run only.
  }
  if (process.env.PETE_QUALITY_QA_RESUME_20261021 === "true") {
    if (process.env.GITHUB_REF !== "refs/heads/pete-quality-real-resume-20261021") {
      throw new PeteBudgetStop("unavailable");
    }
    // Existing immutable QA reservation consumed $0.245788 on 21 Oct.
    // Remaining authorization is $1.754212, NEVER another $2.
    return PETE_QA_20261021_CAP_MICROS - 245_788;
  }
  return PETE_QA_20261021_CAP_MICROS;
}
/**
 * Separate private-lab authorizations: $2 initially plus $2 approved on 16 Oct 2026; at most $4 of cumulative lab calls.
 * The older GitHub project ledger is $4.583900; the lab's immutable prior
 * snapshot is $4.323801. The $0.260099 delta counts against the lifetime
 * $8 project cap, but is NOT charged against the cumulative $4 lab authorization.
 * Keep the original prior snapshot unchanged: its existing persisted ledger
 * validates it on every read and must never be silently reset/migrated.
 */
const LAB_NEW_SPEND_CAP_MICROS = 4_000_000;
const LAB_KNOWN_OUTSIDE_SPEND_MICROS = 260_099;
const LAB_ORIGINAL_PRIOR_MICROS = "4323801";

const MODEL = "gpt-4.1-mini"; // backward compatible default
// Official OpenAI pay-as-you-go prices in USD per million tokens, checked 2026-10-11.
const MODEL_PRICES = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-5.4": { input: 2.5, output: 15.0 },
  // Official Standard tier USD / 1M tokens; excludes optional regional / fast multipliers.
  "gpt-6.1-sol": { input: 2.0, output: 10.0 },
} as const;
type PricedModel = keyof typeof MODEL_PRICES;
function priceFor(name: string): typeof MODEL_PRICES[PricedModel] | null {
  return Object.prototype.hasOwnProperty.call(MODEL_PRICES, name)
    ? MODEL_PRICES[name as PricedModel] : null;
}
const MAX_OUTPUT_BY_MODEL: Record<PricedModel, number> = {
  "gpt-4.1-mini": 400,
  "gpt-5.4": 800,
  "gpt-6.1-sol": 1200,
};
const LEDGER_FILE = path.join(env.DATA_DIR, "pete-api-budget.json");
const LOCK_FILE = path.join(env.DATA_DIR, "pete-api-budget.lock");

type Reservation = { microUsd: number; createdAt: string; model?: PricedModel };
type Ledger = {
  version: 1;
  priorSpentMicroUsd?: number;
  capMicroUsd: number;
  committedMicroUsd: number;
  confirmedMicroUsd: number;
  reservedMicroUsd: number;
  requestsStarted: number;
  requestsMetered: number;
  billedInputTokens: number;
  billedOutputTokens: number;
  pending: Record<string, Reservation>;
};
export class PeteBudgetStop extends Error {
  constructor(public readonly reason: "exhausted" | "unavailable" | "model_not_priced") {
    super("pete_budget_" + reason);
  }
}
// Historical project spend is a fixed local reconciliation snapshot,
// not the OpenAI account balance or live billing history.
function priorSpentMicros(): number {
  if (process.env.PETE_MOBILE_LAB_ENABLED !== "true") return 0;
  const raw = process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD?.trim();
  if (!raw || !/^(0|[1-9][0-9]{0,6})$/.test(raw)) throw new PeteBudgetStop("unavailable");
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > USD_MICROS_CAP)
    throw new PeteBudgetStop("unavailable");
  return parsed;
}

export function isPeteLabGpt54Approved(): boolean {
  if (process.env.PETE_MOBILE_LAB_ENABLED !== "true") return false;
  if (process.env.PETE_MOBILE_LAB_GPT54_CONSENT !== "true") return false;
  return process.env.PETE_MOBILE_LAB_ISOLATED_DATA === "true" &&
    process.env.PETE_LLM_CONVERSATION_ENABLED === "true" &&
    process.env.PETE_LLM_API_CALLS_APPROVED === "true" &&
    process.env.OPENAI_MODEL === "gpt-5.4" &&
    process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD === String(LAB_NEW_SPEND_CAP_MICROS) &&
    process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD === LAB_ORIGINAL_PRIOR_MICROS;
}

/** Fail closed if ANY lab LLM switch is present without the whole agreement. */
function labApproval(): { active: boolean; historicalAdjustment: number; newCap: number } {
  const isLab = process.env.PETE_MOBILE_LAB_ENABLED === "true";
  if (!isLab) return { active: false, historicalAdjustment: 0, newCap: USD_MICROS_CAP };
  const wantsLlm = process.env.PETE_LLM_CONVERSATION_ENABLED === "true" ||
    process.env.PETE_LLM_API_CALLS_APPROVED === "true" ||
    process.env.PETE_MOBILE_LAB_GPT54_CONSENT === "true";
  if (!wantsLlm) return { active: false, historicalAdjustment: 0, newCap: USD_MICROS_CAP };
  if (!isPeteLabGpt54Approved()) throw new PeteBudgetStop("unavailable");
  return {
    active: true,
    historicalAdjustment: LAB_KNOWN_OUTSIDE_SPEND_MICROS,
    newCap: LAB_NEW_SPEND_CAP_MICROS,
  };
}

function emptyLedger(): Ledger {
  return {
    version: 1, priorSpentMicroUsd: priorSpentMicros(),
    capMicroUsd: USD_MICROS_CAP, committedMicroUsd: 0,
    confirmedMicroUsd: 0, reservedMicroUsd: 0, requestsStarted: 0,
    requestsMetered: 0, billedInputTokens: 0, billedOutputTokens: 0, pending: {},
  };
}
function isWhole(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function load(): Ledger {
  if (!fs.existsSync(LEDGER_FILE)) return emptyLedger();
  let value: unknown;
  try { value = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8")); }
  catch { throw new PeteBudgetStop("unavailable"); }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PeteBudgetStop("unavailable");
  const data = value as Record<string, unknown>;
  for (const key of ["capMicroUsd", "committedMicroUsd", "confirmedMicroUsd",
    "reservedMicroUsd", "requestsStarted", "requestsMetered",
    "billedInputTokens", "billedOutputTokens"]) {
    if (!isWhole(data[key])) throw new PeteBudgetStop("unavailable");
  }
  const prior = data.priorSpentMicroUsd ?? 0;
  if (!isWhole(prior) || prior !== priorSpentMicros() ||
      data.version !== 1 || data.capMicroUsd !== USD_MICROS_CAP ||
      !data.pending || typeof data.pending !== "object" || Array.isArray(data.pending) ||
      (data.confirmedMicroUsd as number) + (data.reservedMicroUsd as number) !== data.committedMicroUsd ||
      (data.requestsMetered as number) > (data.requestsStarted as number))
    throw new PeteBudgetStop("unavailable");
  const pending = data.pending as Record<string, unknown>;
  let reserved = 0;
  for (const val of Object.values(pending)) {
    if (!val || typeof val !== "object" ||
        !isWhole((val as Reservation).microUsd) ||
        typeof (val as Reservation).createdAt !== "string" ||
        ((val as Reservation).model !== undefined && !priceFor((val as Reservation).model!)))
      throw new PeteBudgetStop("unavailable");
    reserved += (val as Reservation).microUsd;
  }
  if (reserved !== data.reservedMicroUsd) throw new PeteBudgetStop("unavailable");
  return data as Ledger;
}
function locked<T>(fn: () => T): T {
  try { fs.mkdirSync(env.DATA_DIR, { recursive: true, mode: 0o700 }); }
  catch { throw new PeteBudgetStop("unavailable"); }
  let fd: number;
  try { fd = fs.openSync(LOCK_FILE, "wx", 0o600); }
  catch { throw new PeteBudgetStop("unavailable"); }
  try { return fn(); }
  finally {
    fs.closeSync(fd);
    fs.unlinkSync(LOCK_FILE);
  }
}
export function getPeteBudgetStatus() {
  const approval = labApproval();
  const data = load();
  const prior = priorSpentMicros() + approval.historicalAdjustment;
  const globalRemaining = Math.max(0, USD_MICROS_CAP - prior - data.committedMicroUsd);
  const labRemaining = Math.max(0, approval.newCap - data.committedMicroUsd);
  const qaCap = qualityQaCapMicros();
  const qaRemaining = qaCap === null ? globalRemaining : Math.max(0, qaCap - data.committedMicroUsd);
  const remaining = Math.min(approval.active ? Math.min(globalRemaining, labRemaining) : globalRemaining, qaRemaining);
  return {
    model: approval.active ? "gpt-5.4" : (resolvePeteRuntimeModel({
      envModel: process.env.OPENAI_MODEL,
      nodeEnv: process.env.NODE_ENV,
    }) ?? "unavailable"),
    hardCapUsd: USD_MICROS_CAP / 1_000_000,
    priorConfirmedUsd: prior / 1_000_000,
    committedUsd: (prior + data.committedMicroUsd) / 1_000_000,
    confirmedUsd: (prior + data.confirmedMicroUsd) / 1_000_000,
    reservedUsd: data.reservedMicroUsd / 1_000_000,
    remainingUsd: remaining / 1_000_000,
    // The lab shows its OWN cumulative $4 permission separately from lifetime spend; the $8 lifetime cap remains stricter.
    labAuthorizedUsd: qaCap !== null ? qaCap / 1_000_000 :
      (approval.active ? approval.newCap / 1_000_000 : null),
    labCommittedUsd: qaCap !== null || approval.active ? data.committedMicroUsd / 1_000_000 : null,
    labRemainingUsd: qaCap !== null || approval.active ? remaining / 1_000_000 : null,
    globalRemainingUsd: globalRemaining / 1_000_000,
    requestsStarted: data.requestsStarted, requestsMetered: data.requestsMetered,
    inputTokens: data.billedInputTokens, outputTokens: data.billedOutputTokens,
    blocked: remaining <= 0,
  };
}
export function getPeteBudgetStatusSafe() {
  try { return { ok: true as const, ...getPeteBudgetStatus() }; }
  catch { return { ok: false as const, reason: "ledger_unavailable" }; }
}
/** Reserve a worst-case token charge BEFORE making the HTTP request. */
export function reservePeteBudget(params: {
  model: string; requestBody: string; maxOutputTokens: number;
}): string {
  const pricing = priceFor(params.model);
  if (!pricing || params.maxOutputTokens !== MAX_OUTPUT_BY_MODEL[params.model as PricedModel])
    throw new PeteBudgetStop("model_not_priced");
  // Each token represents >=1 byte of text in the encoded payload; an extra
  // 6k-token overhead covers API wrappers and hidden roles. No tools are enabled.
  // GitHub Phase 3 envelopes reserve 1.50 USD for exactly 100 calls.
  // At most 26k request bytes + 6k wrapper tokens and 400 output tokens
  // Mini remains under 1.50 USD per batch. GPT-5.4 with 18k bytes,
  // 6k input overhead and 800 output tokens costs at most 0.072 USD/call;
  // 20 calls cost at most 1.44 USD, below the persisted 1.50 USD reserve.
  const bytes = Buffer.byteLength(params.requestBody, "utf8");
  if (process.env.PETE_PHASE3_FLAGSHIP_ENVELOPE === "true" &&
      params.model === "gpt-5.4" && bytes > 18000)
    throw new PeteBudgetStop("exhausted");
  if (process.env.PETE_PHASE3_BUDGET_ENVELOPE === "true" &&
      params.model === "gpt-4.1-mini" && bytes > 26000)
    throw new PeteBudgetStop("exhausted");
  const maximumInputTokens = bytes + 6000;
  const reservedMicros = Math.ceil(maximumInputTokens * pricing.input +
    params.maxOutputTokens * pricing.output);
  if (!Number.isSafeInteger(reservedMicros) || reservedMicros <= 0 || reservedMicros > USD_MICROS_CAP)
    throw new PeteBudgetStop("exhausted");
  return locked(() => {
    const approval = labApproval();
    const data = load();
    if (approval.active && params.model !== "gpt-5.4")
      throw new PeteBudgetStop("model_not_priced");
    if (priorSpentMicros() + approval.historicalAdjustment +
        data.committedMicroUsd + reservedMicros > USD_MICROS_CAP)
      throw new PeteBudgetStop("exhausted");
    if (approval.active && data.committedMicroUsd + reservedMicros > approval.newCap)
      throw new PeteBudgetStop("exhausted");
    const qaCap = qualityQaCapMicros();
    if (qaCap !== null && data.committedMicroUsd + reservedMicros > qaCap)
      throw new PeteBudgetStop("exhausted");
    const id = crypto.randomUUID();
    data.pending[id] = { microUsd: reservedMicros, createdAt: new Date().toISOString(), model: params.model as PricedModel };
    data.reservedMicroUsd += reservedMicros;
    data.committedMicroUsd += reservedMicros;
    data.requestsStarted += 1;
    writePrivateJsonAtomic(LEDGER_FILE, data);
    return id;
  });
}
/**
 * Reconcile ONLY on a successful provider response with trustworthy usage.
 * Missing usage, network errors and crashes keep the full preauthorization
 * reserved. Therefore all billed/uncertain requests remain counted.
 */
export function settlePeteBudget(id: string, usage: unknown): boolean {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return false;
  const u = usage as Record<string, unknown>;
  if (!isWhole(u.input_tokens) || !isWhole(u.output_tokens)) return false;
  return locked(() => {
    const data = load();
    const pending = data.pending[id];
    if (!pending) return false;
    const pricing = priceFor(pending.model ?? MODEL);
    if (!pricing) throw new PeteBudgetStop("unavailable");
    const actualMicros = Math.ceil(u.input_tokens as number * pricing.input +
      (u.output_tokens as number) * pricing.output);
    if (!isWhole(actualMicros)) throw new PeteBudgetStop("unavailable");
    data.confirmedMicroUsd += actualMicros;
    data.reservedMicroUsd -= pending.microUsd;
    data.committedMicroUsd = data.confirmedMicroUsd + data.reservedMicroUsd;
    data.billedInputTokens += u.input_tokens as number;
    data.billedOutputTokens += u.output_tokens as number;
    data.requestsMetered += 1;
    delete data.pending[id];
    writePrivateJsonAtomic(LEDGER_FILE, data);
    return true;
  });
}
