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
import { isDeepStrictEqual } from "node:util";
import { getPeteQaRuntimeAuthorization, type PeteQaGrantHold } from "../../../scripts/pete-repeatable-qa-ledger.mjs";
import { env } from "../config/env.js";
import { resolvePeteRuntimeModel } from "../config/pete-model-selection.js";
import { writePrivateJsonAtomic } from "../data/private-json-file.js";
import { assertSafeLocalLaptopEnvironment } from "../config/local-laptop-safe-mode.js";
import { PETE_DESKTOP_HISTORY, PETE_DESKTOP_BUDGET_CHOICES } from "../config/pete-desktop-history.js";

const USD_MICROS_CAP = 8_000_000; // Existing project-wide internal cap.
const PETE_QA_20261021_CAP_MICROS = 2_000_000; // Additional, strictly narrower QA authorization.

/**
 * The 21 Oct genuine-model QA run is opt-in AND only valid in a no-send GitHub
 * Actions test. This does not change existing production/lab authorizations.
 * Never allow a self-selected amount or a missing guard to raise this cap.
 */
function qualityQaCapMicros(): number | null {
  // Reusable QA requires a persisted reservation from an owner-approved
  // GitHub test manifest. Unlike the historical date-coded batches, the
  // per-run cap is read from the held ledger, never a self-selected env value.
  if (process.env.PETE_REPEATABLE_QA_ENABLED === "true") {
    const e = process.env;
    if (e.GITHUB_ACTIONS !== "true" ||
        e.GITHUB_EVENT_NAME !== "push" ||
        e.GITHUB_REPOSITORY !== "VSCodeBot78/funnelpilot-whatsapp-app" ||
        e.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        e.GITHUB_RUN_ATTEMPT !== "1" ||
        !/^[0-9]{5,}$/.test(e.GITHUB_RUN_ID ?? "") ||
        e.NODE_ENV !== "test" || e.OPENAI_MODEL !== "gpt-6.1-sol" ||
        e.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        e.INSTAGRAM_SEND_ENABLED !== "false" ||
        e.WHATSAPP_SEND_ENABLED !== "false" ||
        e.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        e.PETE_MOBILE_LAB_ENABLED !== "false" ||
        e.PETE_LLM_CONVERSATION_ENABLED !== "true" ||
        e.PETE_LLM_API_CALLS_APPROVED !== "true" ||
        !e.GITHUB_WORKSPACE) throw new PeteBudgetStop("unavailable");
    let request: Record<string, unknown>, ledger: Record<string, unknown>;
    try {
      const workspace = path.resolve(e.GITHUB_WORKSPACE);
      if (path.resolve(process.cwd()) !== path.join(workspace, "backend"))
        throw Error("qa_wrong_workdir");
      request = JSON.parse(fs.readFileSync(path.join(workspace, "qa", "pete-approved-test.json"), "utf8"));
      ledger = JSON.parse(fs.readFileSync(path.join(workspace, "budget-ledger", "phase3-budget-ledger.json"), "utf8"));
    } catch { throw new PeteBudgetStop("unavailable"); }
    if (request.version === 2) {
      try { return getPeteQaRuntimeAuthorization(e).micro; }
      catch { throw new PeteBudgetStop("unavailable"); }
    }
    const dollars = request.budgetUsd;
    if (request.version !== 1 || !["sales20", "sales32", "focus15"].includes(String(request.testSet)) ||
        typeof dollars !== "string" ||
        !/^(?:0\.[0-9]{2}|1\.[0-9]{2}|2\.00)$/.test(dollars) ||
        !/^owner:[a-z0-9-]{8,80}$/.test(String(request.ownerApprovalRef ?? "")))
      throw new PeteBudgetStop("unavailable");
    const amount = Math.round(Number(dollars) * 1_000_000);
    if (!Number.isSafeInteger(amount) || amount < 10_000 || amount > 2_000_000)
      throw new PeteBudgetStop("unavailable");
    const extra = ledger.extraOwnerQa20261022 as Record<string, unknown> | undefined;
    const hold = (extra?.reservations as Record<string, unknown> | undefined)?.["pete-qa-" + e.GITHUB_RUN_ID] as Record<string, unknown> | undefined;
    if (ledger.version !== 1 || ledger.spentMicroUsd !== 7_817_830 ||
        ledger.capMicroUsd !== 8_000_000 || ledger.reservedMicroUsd !== 0 ||
        extra?.conservativeUsdCapMicro !== 5_000_000 ||
        !Number.isSafeInteger(extra.usedMicroUsd) ||
        !Number.isSafeInteger(extra.reservedMicroUsd) ||
        Number(extra.usedMicroUsd) + Number(extra.reservedMicroUsd) > 5_000_000 ||
        hold?.runId !== e.GITHUB_RUN_ID ||
        hold?.holdMicroUsd !== amount ||
        hold?.ownerApprovalRef !== request.ownerApprovalRef ||
        hold?.testSet !== request.testSet ||
        extra.reservedMicroUsd !== amount)
      throw new PeteBudgetStop("unavailable");
    return amount;
  }
  // Final historical-vs-current-pregnancy smoke, no production cap change.
  if (process.env.PETE_V42_PREGNANCY_QA_ENABLED === "true") {
    if (process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
        process.env.PETE_V42_PREGNANCY_QA_APPROVAL !== "once-20261022-eur5-usd0p25-pregnancy" ||
        process.env.NODE_ENV !== "test" ||
        process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
        process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
        process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
        process.env.WHATSAPP_SEND_ENABLED !== "false" ||
        process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
        process.env.PETE_MOBILE_LAB_ENABLED !== "false" ||
        process.env.PETE_V42_SOL_QA_ENABLED === "true" ||
        process.env.PETE_V42_HOLDOUT_QA_ENABLED === "true" ||
        process.env.PETE_V42_REMAINDER_QA_ENABLED === "true")
      throw new PeteBudgetStop("unavailable");
    return 250_000;
  }
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

type Reservation = { microUsd: number; createdAt: string; model?: PricedModel; desktop?: true };
type DesktopBudget = {
  limitMicroUsd: number;
  confirmedMicroUsd: number;
  reservedMicroUsd: number;
  enabledBootId: string | null;
  enabledSessionHash: string | null;
  history: { reviewSha256: string; priorMicroUsd: number } | null;
  // Explicit local owner choice, not a fabricated historical reconciliation.
  ownerManagedCostsAcknowledgedAt?: string;
  accountingError: boolean;
};
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
  desktop?: DesktopBudget;
  qaGrant?: PeteQaGrantHold;
  accountingError?: true;
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
function ownerQaGrant(): PeteQaGrantHold | null {
  if (process.env.PETE_REPEATABLE_QA_ENABLED !== "true") return null;
  try {
    const request = JSON.parse(fs.readFileSync(path.join(process.env.GITHUB_WORKSPACE ?? "",
      "qa", "pete-approved-test.json"), "utf8"));
    if (request.version === 1) return null;
    if (request.version !== 2 || path.resolve(process.cwd()) !==
        path.join(path.resolve(process.env.GITHUB_WORKSPACE ?? ""), "backend") ||
        path.resolve(env.DATA_DIR) !== path.resolve(process.env.DATA_DIR ?? "") ||
        env.INSTAGRAM_ENGINE_ENABLED || env.INSTAGRAM_SEND_ENABLED ||
        env.WHATSAPP_SEND_ENABLED || env.ENABLE_GENERIC_WEBHOOKS)
      throw Error("qa_grant_scope_invalid");
    return getPeteQaRuntimeAuthorization(process.env);
  } catch { throw new PeteBudgetStop("unavailable"); }
}
function load(): Ledger {
  const grant = ownerQaGrant();
  if (!fs.existsSync(LEDGER_FILE)) {
    if (grant) throw new PeteBudgetStop("unavailable");
    return emptyLedger();
  }
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
      data.version !== 1 || data.capMicroUsd !== (grant?.micro ?? USD_MICROS_CAP) ||
      (grant ? !isDeepStrictEqual(data.qaGrant, grant) || data.desktop !== undefined
        : data.qaGrant !== undefined) ||
      data.accountingError !== undefined ||
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
        ((val as Reservation).desktop !== undefined && (val as Reservation).desktop !== true) ||
        ((val as Reservation).model !== undefined && !priceFor((val as Reservation).model!)))
      throw new PeteBudgetStop("unavailable");
    reserved += (val as Reservation).microUsd;
  }
  if (reserved !== data.reservedMicroUsd) throw new PeteBudgetStop("unavailable");
  if (data.desktop !== undefined) validateDesktopBudget(data as Ledger);
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
  const remaining = data.qaGrant ? qaRemaining :
    Math.min(approval.active ? Math.min(globalRemaining, labRemaining) : globalRemaining, qaRemaining);
  return {
    model: approval.active ? "gpt-5.4" : (resolvePeteRuntimeModel({
      envModel: process.env.OPENAI_MODEL,
      nodeEnv: process.env.NODE_ENV,
    }) ?? "unavailable"),
    hardCapUsd: (data.qaGrant ? data.capMicroUsd : USD_MICROS_CAP) / 1_000_000,
    budgetScope: data.qaGrant ? "owner_qa_grant" : "legacy_pete",
    ownerGrantId: data.qaGrant?.ownerGrantId ?? null,
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
  desktopSessionHash?: string;
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
    if (params.desktopSessionHash !== undefined) {
      assertDesktopRuntimeSafe();
      const desktop = desktopData(data);
      const basis = readDesktopCostBasis(data);
      if (params.model !== "gpt-6.1-sol" ||
          (basis.sha256 !== null && (!desktop.history || desktop.history.reviewSha256 !== basis.sha256)) ||
          desktop.accountingError ||
          desktop.enabledBootId !== DESKTOP_BOOT_ID ||
          desktop.enabledSessionHash !== params.desktopSessionHash)
        throw new PeteBudgetStop("unavailable");
      if (desktop.confirmedMicroUsd + desktop.reservedMicroUsd + reservedMicros > desktop.limitMicroUsd ||
          basis.priorMicroUsd + data.committedMicroUsd + reservedMicros > PETE_DESKTOP_HISTORY.projectCeilingMicroUsd)
        throw new PeteBudgetStop("exhausted");
      const id = crypto.randomUUID();
      data.pending[id] = { microUsd: reservedMicros, createdAt: new Date().toISOString(),
        model: "gpt-6.1-sol", desktop: true };
      data.reservedMicroUsd += reservedMicros;
      data.committedMicroUsd += reservedMicros;
      data.requestsStarted += 1;
      desktop.reservedMicroUsd += reservedMicros;
      data.desktop = desktop;
      writePrivateJsonAtomic(LEDGER_FILE, data);
      return id;
    }
    if (approval.active && params.model !== "gpt-5.4")
      throw new PeteBudgetStop("model_not_priced");
    if (data.qaGrant && (params.model !== "gpt-6.1-sol" || data.reservedMicroUsd !== 0))
      throw new PeteBudgetStop("unavailable");
    if (!data.qaGrant && priorSpentMicros() + approval.historicalAdjustment +
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
    if (pending.desktop) {
      const desktop = desktopData(data);
      if (actualMicros > pending.microUsd) {
        // A price/envelope mismatch is NOT a refund. Retain at least the
        // reported charge, stop further calls and require accounting review.
        const delta = actualMicros - pending.microUsd;
        pending.microUsd = actualMicros;
        data.reservedMicroUsd += delta;
        data.committedMicroUsd += delta;
        desktop.reservedMicroUsd += delta;
        desktop.accountingError = true;
        data.desktop = desktop;
        writePrivateJsonAtomic(LEDGER_FILE, data);
        return false;
      }
      desktop.confirmedMicroUsd += actualMicros;
      desktop.reservedMicroUsd -= pending.microUsd;
      data.desktop = desktop;
    }
    if (data.qaGrant && actualMicros > pending.microUsd) {
      // Usage above the conservative envelope is an accounting incident.
      // Retain the full hold and quarantine the run, never refund/retry it.
      data.accountingError = true;
      writePrivateJsonAtomic(LEDGER_FILE, data);
      return false;
    }
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

// Desktop authorization lives in THIS ledger and its existing file lock.
// The boot nonce is intentionally not reusable after a server restart.
const DESKTOP_BOOT_ID = crypto.randomBytes(32).toString("hex");
const DESKTOP_REVIEW_FILE = path.join(env.DATA_DIR, "pete-desktop-history-review.json");

export function assertDesktopRuntimeSafe(): void {
  if (!env.LOCAL_LAPTOP_TEST_MODE || env.NODE_ENV !== "development" ||
      process.env.FUNNELPILOT_LOCAL_TEST_MODE !== "true" ||
      process.env.NODE_ENV !== "development" || process.env.GITHUB_ACTIONS === "true" ||
      process.env.PETE_LLM_API_CALLS_APPROVED !== "false" ||
      process.env.PETE_MOBILE_LAB_ENABLED === "true" ||
      env.INSTAGRAM_ENGINE_ENABLED || env.INSTAGRAM_SEND_ENABLED || env.WHATSAPP_SEND_ENABLED ||
      env.ENABLE_GENERIC_WEBHOOKS || !env.DISABLE_DESTRUCTIVE_ROUTES ||
      Object.entries(process.env).some(([key, val]) =>
        key.startsWith("PETE_") && /QA.*ENABLED|QA_2026/.test(key) && val === "true"))
    throw new PeteBudgetStop("unavailable");
  try { assertSafeLocalLaptopEnvironment(process.env); }
  catch { throw new PeteBudgetStop("unavailable"); }
}

function desktopData(data: Ledger): DesktopBudget {
  return data.desktop ?? { limitMicroUsd: 0, confirmedMicroUsd: 0, reservedMicroUsd: 0,
    enabledBootId: null, enabledSessionHash: null, history: null, accountingError: false };
}

function validateDesktopBudget(data: Ledger): void {
  const d = data.desktop!;
  if (!d || typeof d !== "object" || Array.isArray(d) ||
      ![0, ...PETE_DESKTOP_BUDGET_CHOICES].includes(d.limitMicroUsd) ||
      !isWhole(d.confirmedMicroUsd) || !isWhole(d.reservedMicroUsd) ||
      typeof d.accountingError !== "boolean" ||
      ![d.enabledBootId, d.enabledSessionHash].every(x => x === null || /^[a-f0-9]{64}$/.test(x)) ||
      ((d.enabledBootId === null) !== (d.enabledSessionHash === null)) ||
      d.confirmedMicroUsd > data.confirmedMicroUsd || d.reservedMicroUsd > data.reservedMicroUsd ||
      d.reservedMicroUsd !== Object.values(data.pending).filter(p => p.desktop === true)
        .reduce((sum, p) => sum + p.microUsd, 0) ||
      (d.ownerManagedCostsAcknowledgedAt !== undefined &&
        (typeof d.ownerManagedCostsAcknowledgedAt !== "string" ||
          !Number.isFinite(Date.parse(d.ownerManagedCostsAcknowledgedAt)) ||
          Date.parse(d.ownerManagedCostsAcknowledgedAt) > Date.now() || d.history !== null)) ||
      (d.history !== null && (!d.history || !/^[a-f0-9]{64}$/.test(d.history.reviewSha256) ||
        !isWhole(d.history.priorMicroUsd) || d.history.priorMicroUsd < PETE_DESKTOP_HISTORY.knownBookedMicroUsd)))
    throw new PeteBudgetStop("unavailable");
}

function sha256File(filename: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

/** Local, operator-reviewed evidence, never accepted from an HTTP body.
 * Hashes bind the review to the old local ledgers, provider statement and
 * target DATA_DIR. Hash/schema checks cannot perform a financial audit;
 * completeness must be reviewed by the local owner. No review is shipped.
 */
function readDesktopHistoryReview(data: Ledger): { sha256: string; priorMicroUsd: number } {
  try {
    const raw = fs.readFileSync(DESKTOP_REVIEW_FILE, "utf8");
    const review = JSON.parse(raw);
    const digest = crypto.createHash("sha256").update(raw).digest("hex");
    if (review.version !== 1 || review.kind !== "owner-reviewed-desktop-history" ||
        review.knownCloudLedgerCommit !== PETE_DESKTOP_HISTORY.ledgerCommit ||
        review.knownCloudLedgerBlob !== PETE_DESKTOP_HISTORY.ledgerBlob ||
        review.unresolvedSources !== 0 || review.ownerReviewedComplete !== true ||
        !isWhole(review.priorMicroUsd) || review.priorMicroUsd < PETE_DESKTOP_HISTORY.knownBookedMicroUsd ||
        typeof review.reviewedAt !== "string" || !Number.isFinite(Date.parse(review.reviewedAt)) ||
        Date.parse(review.reviewedAt) > Date.now() ||
        review.dataDir !== fs.realpathSync(env.DATA_DIR) ||
        !Array.isArray(review.localLedgers) || !review.localLedgers.length)
      throw Error("incomplete_review");
    const sources = [...review.localLedgers, review.providerStatement];
    const seen = new Set<string>();
    let localCommitted = 0;
    for (const [index, source] of sources.entries()) {
      if (!source || typeof source.path !== "string" || !path.isAbsolute(source.path) ||
          !/^[a-f0-9]{64}$/.test(source.sha256)) throw Error("invalid_evidence");
      const filename = fs.realpathSync(source.path);
      if (filename === path.resolve(LEDGER_FILE) || filename === path.resolve(DESKTOP_REVIEW_FILE) ||
          seen.has(filename) || sha256File(filename) !== source.sha256) throw Error("changed_evidence");
      seen.add(filename);
      if (index < review.localLedgers.length) {
        const old = JSON.parse(fs.readFileSync(filename, "utf8"));
        if (old.version !== 1 || !isWhole(old.committedMicroUsd) ||
            !isWhole(old.confirmedMicroUsd) || !isWhole(old.reservedMicroUsd) ||
            old.committedMicroUsd !== old.confirmedMicroUsd + old.reservedMicroUsd)
          throw Error("invalid_old_ledger");
        // Conservative: do not erase uncertain reservations or assume that
        // local charges have already been included in the cloud snapshot.
        localCommitted += old.committedMicroUsd;
      }
    }
    if (!isWhole(localCommitted) ||
        review.priorMicroUsd < PETE_DESKTOP_HISTORY.knownBookedMicroUsd + localCommitted)
      throw Error("historical_understatement");
    if (data.desktop?.history) {
      if (data.desktop.history.reviewSha256 !== digest ||
          data.desktop.history.priorMicroUsd !== review.priorMicroUsd) throw Error("changed_review");
    } else {
      // Bind the first migration to the existing ledger; an old installation
      // cannot silently disappear when a fresh AutoStart DATA_DIR is used.
      const current = fs.existsSync(LEDGER_FILE) ? sha256File(LEDGER_FILE) : "absent";
      if (review.initialTargetLedgerSha256 !== current) throw Error("wrong_target_ledger");
    }
    return { sha256: digest, priorMicroUsd: review.priorMicroUsd };
  } catch { throw new PeteBudgetStop("unavailable"); }
}

/** The owner may manage historical costs directly in OpenAI and explicitly
 * authorize a bounded local test. Keep the immutable known booking floor and
 * every current-ledger charge/reservation. Never call this verified history.
 * A previously sealed review cannot be replaced by this mode.
 */
function readDesktopCostBasis(data: Ledger): { sha256: string | null; priorMicroUsd: number } {
  const d = desktopData(data);
  if (d.ownerManagedCostsAcknowledgedAt !== undefined && d.history === null)
    return { sha256: null, priorMicroUsd: PETE_DESKTOP_HISTORY.knownBookedMicroUsd };
  return readDesktopHistoryReview(data);
}

export function getPeteDesktopBudgetStatus(sessionHash?: string) {
  try {
    assertDesktopRuntimeSafe();
    if (fs.existsSync(LOCK_FILE)) throw new PeteBudgetStop("unavailable");
    const data = load();
    const d = desktopData(data);
    let basis: ReturnType<typeof readDesktopCostBasis> | null = null;
    try { basis = readDesktopCostBasis(data); } catch { /* no implicit permission */ }
    const historyVerified = basis !== null && basis.sha256 !== null;
    const ownerManagedCosts = d.ownerManagedCostsAcknowledgedAt !== undefined;
    const committed = d.confirmedMicroUsd + d.reservedMicroUsd;
    const bookedRemaining = Math.max(0, PETE_DESKTOP_HISTORY.projectCeilingMicroUsd -
      (basis?.priorMicroUsd ?? PETE_DESKTOP_HISTORY.knownBookedMicroUsd) - data.committedMicroUsd);
    const projectRemaining = historyVerified ? bookedRemaining : null;
    const ownerManagedApprovalAvailable = d.history === null && !d.accountingError && bookedRemaining > 0;
    const remaining = basis === null ? 0 : Math.min(bookedRemaining,
      Math.max(0, d.limitMicroUsd - committed));
    const enabled = basis !== null && !d.accountingError && bookedRemaining > 0 &&
      d.enabledBootId === DESKTOP_BOOT_ID && d.enabledSessionHash === sessionHash;
    return { ok: true as const, enabled, historyVerified, ownerManagedCosts, ownerManagedApprovalAvailable,
      blockReason: d.accountingError ? "accounting_review_required" : bookedRemaining === 0
        ? "project_budget_exhausted" : basis === null ? "historical_spend_unverified" : null,
      knownHistoricalBookedUsd: PETE_DESKTOP_HISTORY.knownBookedMicroUsd / 1_000_000,
      historicalBookedUsd: historyVerified ? basis!.priorMicroUsd / 1_000_000 : null,
      projectRemainingUsd: projectRemaining === null ? null : projectRemaining / 1_000_000,
      authorizedUsd: d.limitMicroUsd / 1_000_000,
      confirmedUsd: d.confirmedMicroUsd / 1_000_000,
      reservedUsd: d.reservedMicroUsd / 1_000_000,
      committedUsd: committed / 1_000_000, remainingUsd: remaining / 1_000_000,
      requestsStarted: data.requestsStarted, requestsMetered: data.requestsMetered,
      inputTokens: data.billedInputTokens, outputTokens: data.billedOutputTokens,
    };
  } catch { return { ok: false as const, enabled: false, historyVerified: false,
    blockReason: "desktop_budget_unavailable" }; }
}

/** Cumulative allowance: OFF/ON, new contacts and restarts NEVER reset spend. */
export function setPeteDesktopBudget(params: {
  enabled: boolean; sessionHash: string; limitMicroUsd?: number;
  ownerManagedCosts?: true;
}): void {
  assertDesktopRuntimeSafe();
  if (!/^[a-f0-9]{64}$/.test(params.sessionHash)) throw new PeteBudgetStop("unavailable");
  locked(() => {
    const data = load();
    const d = desktopData(data);
    if (params.enabled) {
      let basis: ReturnType<typeof readDesktopCostBasis>;
      try { basis = readDesktopCostBasis(data); }
      catch (error) {
        // Preserve any valid existing review and all its known expenditure.
        // Only an unsealed missing/invalid history may use the new approval.
        if (params.ownerManagedCosts !== true || d.history !== null) throw error;
        basis = { sha256: null, priorMicroUsd: PETE_DESKTOP_HISTORY.knownBookedMicroUsd };
      }
      const ownerManaged = basis.sha256 === null;
      if (!PETE_DESKTOP_BUDGET_CHOICES.some(amount => amount === params.limitMicroUsd) || d.accountingError)
        throw new PeteBudgetStop("unavailable");
      if (params.limitMicroUsd! <= d.confirmedMicroUsd + d.reservedMicroUsd ||
          basis.priorMicroUsd + data.committedMicroUsd >= PETE_DESKTOP_HISTORY.projectCeilingMicroUsd)
        throw new PeteBudgetStop("exhausted");
      if (ownerManaged) d.ownerManagedCostsAcknowledgedAt ??= new Date().toISOString();
      else d.history ??= { reviewSha256: basis.sha256!, priorMicroUsd: basis.priorMicroUsd };
      d.limitMicroUsd = params.limitMicroUsd!;
      d.enabledBootId = DESKTOP_BOOT_ID;
      d.enabledSessionHash = params.sessionHash;
    } else {
      d.enabledBootId = null;
      d.enabledSessionHash = null;
    }
    data.desktop = d;
    writePrivateJsonAtomic(LEDGER_FILE, data);
  });
}
