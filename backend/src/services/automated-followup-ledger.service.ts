/**
 * Fail-closed write-ahead ledger for automatic follow-ups.
 *
 * Reserve BEFORE the external provider call. An uncertain result or process
 * crash deliberately retains the reservation until a human reconciles it.
 * This guarantees neither exactly-once provider delivery nor cross-volume
 * coordination. All workers must use the same DATA_DIR on a shared filesystem.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { writePrivateJsonAtomic } from "../data/private-json-file.js";

type Entry = {
  conversation: string;
  status: "reserved" | "sent";
  createdAt: string;
  confirmedAt?: string;
};
type Ledger = { version: 1; entries: Record<string, Entry> };
type Claim =
  | { allowed: true; key: string }
  | { allowed: false; reason: string };

const LEDGER_FILE = path.join(env.DATA_DIR, "pete-automated-followup-ledger.json");
const LOCK_FILE = path.join(env.DATA_DIR, "pete-automated-followup-ledger.lock");

function digest(items: string[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(items)).digest("hex");
}

function locked<T>(fn: () => T): T {
  // An orphaned lock deliberately stops sends rather than risking a replay.
  fs.mkdirSync(env.DATA_DIR, { recursive: true, mode: 0o700 });
  const fd = fs.openSync(LOCK_FILE, "wx", 0o600);
  try {
    return fn();
  } finally {
    try {
      fs.closeSync(fd);
    } finally {
      fs.unlinkSync(LOCK_FILE);
    }
  }
}

function read(): Ledger {
  if (!fs.existsSync(LEDGER_FILE)) return { version: 1, entries: {} };
  const data: unknown = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      (data as Ledger).version !== 1 ||
      !(data as Ledger).entries || typeof (data as Ledger).entries !== "object" ||
      Array.isArray((data as Ledger).entries)) {
    throw new Error("followup_ledger_invalid");
  }
  const parsed = data as Ledger;
  for (const [key, item] of Object.entries(parsed.entries)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !item ||
        typeof item.conversation !== "string" ||
        !/^[a-f0-9]{64}$/.test(item.conversation) ||
        (item.status !== "reserved" && item.status !== "sent") ||
        typeof item.createdAt !== "string") {
      throw new Error("followup_ledger_invalid");
    }
  }
  return parsed;
}

export function reserveAutomatedFollowUp(input: {
  leadId: string;
  campaignId: string;
  stageKey: string;
}): Claim {
  if (!input.leadId.trim() || !input.campaignId.trim() ||
      !/^(ghosting|provider_booking):[a-z0-9_-]{1,80}$/.test(input.stageKey)) {
    return { allowed: false, reason: "followup_stage_invalid" };
  }
  const conversation = digest([input.campaignId, input.leadId]);
  const key = digest([input.campaignId, input.leadId, input.stageKey]);
  try {
    return locked(() => {
      const data = read();
      if (data.entries[key]) {
        return { allowed: false, reason: "followup_stage_already_claimed" };
      }
      if (Object.values(data.entries).some(entry =>
        entry.conversation === conversation && entry.status === "reserved")) {
        return { allowed: false, reason: "followup_pending_reconciliation" };
      }
      data.entries[key] = {
        conversation, status: "reserved", createdAt: new Date().toISOString(),
      };
      writePrivateJsonAtomic(LEDGER_FILE, data);
      return { allowed: true, key };
    });
  } catch {
    return { allowed: false, reason: "followup_ledger_unavailable" };
  }
}

/** Confirm an actual provider send; reservation remains fail-closed if this fails. */
export function confirmAutomatedFollowUp(key: string): void {
  locked(() => {
    const data = read();
    const entry = data.entries[key];
    if (!entry || entry.status !== "reserved") {
      throw new Error("followup_claim_missing");
    }
    entry.status = "sent";
    entry.confirmedAt = new Date().toISOString();
    writePrivateJsonAtomic(LEDGER_FILE, data);
  });
}

/** Release only when the provider explicitly SKIPPED without contacting Meta. */
export function cancelUnsentAutomatedFollowUp(key: string): void {
  locked(() => {
    const data = read();
    if (!data.entries[key] || data.entries[key].status !== "reserved") {
      throw new Error("followup_claim_missing");
    }
    delete data.entries[key];
    writePrivateJsonAtomic(LEDGER_FILE, data);
  });
}
