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
import { writePrivateJsonAtomic } from "../data/private-json-file.js";

const USD_MICROS_CAP = 8_000_000; // Conservative internal limit for 10 EUR authorization.
// Oct 13 approval: an ADDITIONAL, separate 2 USD cap for this private mobile
// laboratory only. Earlier Phase 3 GitHub charges are preserved in the
// cumulative project floor; NEVER reset a ledger or increase the old 8 USD cap.
// The 4.583900 USD floor was reconciled with GitHub's shared budget ledger
// BEFORE this additional user authorization (4.323801 + 0.260099 USD).
const PRIVATE_LAB_TEST_CAP_MICROS = 2_000_000;
const PROJECT_CONFIRMED_PRIOR_FLOOR_MICROS = 4_583_900;
const privateLabRequested = () =>
  process.env.PETE_MOBILE_LAB_ENABLED === "true" &&
  process.env.PETE_LAB_GPT54_USD2_APPROVED === "true";

export function isApprovedPrivateLabGpt54(): boolean {
  return privateLabRequested() &&
    process.env.PETE_MOBILE_LAB_ISOLATED_DATA === "true" &&
    process.env.PETE_LLM_CONVERSATION_ENABLED === "true" &&
    process.env.PETE_LLM_API_CALLS_APPROVED === "true" &&
    process.env.OPENAI_MODEL === "gpt-5.4" &&
    process.env.INSTAGRAM_ENGINE_ENABLED === "false" &&
    process.env.INSTAGRAM_SEND_ENABLED === "false" &&
    process.env.WHATSAPP_SEND_ENABLED === "false" &&
    process.env.INSTAGRAM_ALLOW_ALL_SENDERS === "false" &&
    process.env.WHATSAPP_ALLOW_ALL_RECIPIENTS === "false";
}

// The lab's ORIGINAL prior spend must remain unchanged to match its existing
// on-disk ledger. This adds ONLY previously uncounted GitHub charges to the
// cap, without modifying/replacing its persistent ledger.
function additionalVerifiedProjectSpendMicros(): number {
  return isApprovedPrivateLabGpt54()
    ? Math.max(0, PROJECT_CONFIRMED_PRIOR_FLOOR_MICROS - priorSpentMicros())
    : 0;
}

const MODEL = "gpt-4.1-mini"; // backward compatible default
// Official OpenAI pay-as-you-go prices in USD per million tokens, checked 2026-10-11.
const MODEL_PRICES = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-5.4": { input: 2.5, output: 15.0 },
} as const;
type PricedModel = keyof typeof MODEL_PRICES;
function priceFor(name: string): typeof MODEL_PRICES[PricedModel] | null {
  return Object.prototype.hasOwnProperty.call(MODEL_PRICES, name)
    ? MODEL_PRICES[name as PricedModel] : null;
}
const MAX_OUTPUT_BY_MODEL: Record<PricedModel, number> = {
  "gpt-4.1-mini": 400,
  "gpt-5.4": 800,
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
  const data = load();
  if (privateLabRequested() && !isApprovedPrivateLabGpt54())
    throw new PeteBudgetStop("unavailable");
  const privateLab = isApprovedPrivateLabGpt54();
  const verifiedPrior = priorSpentMicros() + additionalVerifiedProjectSpendMicros();
  const globalRemaining = Math.max(0, USD_MICROS_CAP - verifiedPrior - data.committedMicroUsd);
  const testRemaining = Math.max(0, PRIVATE_LAB_TEST_CAP_MICROS - data.committedMicroUsd);
  const remaining = privateLab ? Math.min(globalRemaining, testRemaining) : globalRemaining;
  return {
    model: privateLab ? "gpt-5.4" : MODEL,
    hardCapUsd: USD_MICROS_CAP / 1_000_000,
    priorConfirmedUsd: verifiedPrior / 1_000_000,
    committedUsd: (verifiedPrior + data.committedMicroUsd) / 1_000_000,
    confirmedUsd: (verifiedPrior + data.confirmedMicroUsd) / 1_000_000,
    reservedUsd: data.reservedMicroUsd / 1_000_000,
    remainingUsd: remaining / 1_000_000,
    testCapUsd: privateLab ? PRIVATE_LAB_TEST_CAP_MICROS / 1_000_000 : null,
    testSpentUsd: privateLab ? data.committedMicroUsd / 1_000_000 : null,
    testRemainingUsd: privateLab ? testRemaining / 1_000_000 : null,
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
  // A lab opt-in is only valid for the approved GPT-5.4 model and isolated
  // environment. A typo or disabled social guard fails CLOSED before billing.
  if (privateLabRequested() &&
      (!isApprovedPrivateLabGpt54() || params.model !== "gpt-5.4"))
    throw new PeteBudgetStop("unavailable");
  return locked(() => {
    const data = load();
    const projectPrior = priorSpentMicros() + additionalVerifiedProjectSpendMicros();
    if (projectPrior + data.committedMicroUsd + reservedMicros > USD_MICROS_CAP)
      throw new PeteBudgetStop("exhausted");
    if (isApprovedPrivateLabGpt54() &&
        data.committedMicroUsd + reservedMicros > PRIVATE_LAB_TEST_CAP_MICROS)
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
