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
const MODEL = "gpt-4.1-mini";
const INPUT_USD_MICROS_PER_TOKEN = 0.4;
const OUTPUT_USD_MICROS_PER_TOKEN = 1.6;
const MAX_OUTPUT_TOKENS = 400;
const LEDGER_FILE = path.join(env.DATA_DIR, "pete-api-budget.json");
const LOCK_FILE = path.join(env.DATA_DIR, "pete-api-budget.lock");

type Reservation = { microUsd: number; createdAt: string };
type Ledger = {
  version: 1;
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
function emptyLedger(): Ledger {
  return {
    version: 1, capMicroUsd: USD_MICROS_CAP, committedMicroUsd: 0,
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
  if (data.version !== 1 || data.capMicroUsd !== USD_MICROS_CAP ||
      !data.pending || typeof data.pending !== "object" || Array.isArray(data.pending) ||
      (data.confirmedMicroUsd as number) + (data.reservedMicroUsd as number) !== data.committedMicroUsd ||
      (data.requestsMetered as number) > (data.requestsStarted as number))
    throw new PeteBudgetStop("unavailable");
  const pending = data.pending as Record<string, unknown>;
  let reserved = 0;
  for (const val of Object.values(pending)) {
    if (!val || typeof val !== "object" ||
        !isWhole((val as Reservation).microUsd) ||
        typeof (val as Reservation).createdAt !== "string")
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
  return {
    model: MODEL, hardCapUsd: USD_MICROS_CAP / 1_000_000,
    committedUsd: data.committedMicroUsd / 1_000_000,
    confirmedUsd: data.confirmedMicroUsd / 1_000_000,
    reservedUsd: data.reservedMicroUsd / 1_000_000,
    remainingUsd: Math.max(0, USD_MICROS_CAP - data.committedMicroUsd) / 1_000_000,
    requestsStarted: data.requestsStarted, requestsMetered: data.requestsMetered,
    inputTokens: data.billedInputTokens, outputTokens: data.billedOutputTokens,
    blocked: data.committedMicroUsd >= USD_MICROS_CAP,
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
  if (params.model !== MODEL || params.maxOutputTokens !== MAX_OUTPUT_TOKENS)
    throw new PeteBudgetStop("model_not_priced");
  // Each token represents >=1 byte of text in the encoded payload; an extra
  // 6k-token overhead covers API wrappers and hidden roles. No tools are enabled.
  // GitHub Phase 3 envelopes reserve 1.50 USD for exactly 100 calls.
  // At most 26k request bytes + 6k wrapper tokens and 400 output tokens
  // cost less than 0.0135 USD per call, safely below the envelope.
  if (process.env.PETE_PHASE3_BUDGET_ENVELOPE === "true" &&
      Buffer.byteLength(params.requestBody, "utf8") > 26000) {
    throw new PeteBudgetStop("exhausted");
  }
  const maximumInputTokens = Buffer.byteLength(params.requestBody, "utf8") + 6000;
  const reservedMicros = Math.ceil(maximumInputTokens * INPUT_USD_MICROS_PER_TOKEN +
    MAX_OUTPUT_TOKENS * OUTPUT_USD_MICROS_PER_TOKEN);
  if (!Number.isSafeInteger(reservedMicros) || reservedMicros <= 0 || reservedMicros > USD_MICROS_CAP)
    throw new PeteBudgetStop("exhausted");
  return locked(() => {
    const data = load();
    if (data.committedMicroUsd + reservedMicros > USD_MICROS_CAP)
      throw new PeteBudgetStop("exhausted");
    const id = crypto.randomUUID();
    data.pending[id] = { microUsd: reservedMicros, createdAt: new Date().toISOString() };
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
    const actualMicros = Math.ceil(u.input_tokens as number * INPUT_USD_MICROS_PER_TOKEN +
      (u.output_tokens as number) * OUTPUT_USD_MICROS_PER_TOKEN);
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
