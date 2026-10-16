import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

// A persisted per-stage *attempt* marker, not an exactly-once delivery receipt.
// A crash between the provider accepting the send and us recording its ID must
// never make an automatic retry look safe. Uncertain attempts stay blocked until
// an operator has reconciled them. The directory must be on a persistent volume.
const ATTEMPTS_DIR = path.join(env.DATA_DIR, "pete-automated-followup-attempts");

export type AutomatedFollowUpClaim =
  | { claimed: false; reason: "followup_attempt_exists" | "followup_claim_unavailable" }
  | { claimed: true; releaseIfNoProviderAttempt: () => void };

export function claimAutomatedFollowUpAttempt(params: {
  leadId: string;
  campaignId: string;
  attemptKey: string;
}): AutomatedFollowUpClaim {
  if (!params.leadId.trim() || !params.campaignId.trim() ||
      !params.attemptKey.trim() || params.attemptKey.length > 180) {
    return { claimed: false, reason: "followup_claim_unavailable" };
  }

  // The filename contains no personal identifiers.
  const hash = crypto.createHash("sha256").update(JSON.stringify([
    params.campaignId, params.leadId, params.attemptKey,
  ])).digest("hex");
  const marker = path.join(ATTEMPTS_DIR, hash + ".json");
  try {
    fs.mkdirSync(ATTEMPTS_DIR, { recursive: true, mode: 0o700 });
    // Exclusive create prevents concurrent attempts at the same stage even
    // across processes using the SAME filesystem. Never overwrite a marker.
    fs.writeFileSync(marker, JSON.stringify({
      version: 1, state: "provider_outcome_unconfirmed",
      attemptKey: params.attemptKey, createdAt: new Date().toISOString(),
    }), { flag: "wx", mode: 0o600, encoding: "utf8" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { claimed: false,
      reason: code === "EEXIST" ? "followup_attempt_exists" : "followup_claim_unavailable" };
  }
  return {
    claimed: true,
    // Only permitted if the provider was definitely never contacted, e.g.
    // Instagram/WhatsApp send disabled or allowlist dry run. Uncertain failures
    // and real sends retain the marker and require manual reconciliation.
    releaseIfNoProviderAttempt: () => {
      try { fs.unlinkSync(marker); } catch { /* fail closed: keep blocked */ }
    },
  };
}
