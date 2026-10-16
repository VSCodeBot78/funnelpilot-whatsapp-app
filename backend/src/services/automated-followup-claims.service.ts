import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { writePrivateJsonAtomic } from "../data/private-json-file.js";

/**
 * Persistent, fail-closed reservations for automated sales follow-ups.
 *
 * Assumes the same private DATA_DIR is mounted by every sender. An O_EXCL file
 * serializes sends to one conversation, while a distinct persistent stage
 * marker prevents a confirmed or uncertain send being retried after restart.
 * Never automatically expire a lock/claim: after a crash or ambiguous provider
 * outcome a human must reconcile delivery before any retry.
 *
 * This cannot guarantee exactly-once delivery if different instances do not
 * share a filesystem, or if the transport returns an ambiguous result.
 */
export type FollowUpClaim = {
  lockPath: string;
  markerPath: string;
  lockFd: number;
  stage: string;
};
export type FollowUpBeginResult =
  | { allowed: true; claim: FollowUpClaim }
  | { allowed: false; reason: "followup_claim_exists" | "followup_conversation_locked" };

function existsError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "EEXIST";
}

function hash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function closeAndUnlock(claim: FollowUpClaim): void {
  fs.closeSync(claim.lockFd);
  fs.unlinkSync(claim.lockPath);
}

export function beginAutomatedFollowUpClaim(input: {
  campaignId: string;
  leadId: string;
  stage: string;
}): FollowUpBeginResult {
  if (!input.campaignId || !input.leadId ||
      !/^[a-z0-9:_-]{1,96}$/.test(input.stage)) {
    throw Error("followup_claim_invalid_identity");
  }

  const dir = path.join(env.DATA_DIR, "automated-followup-claims");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const identity = hash(JSON.stringify([input.campaignId, input.leadId]));
  const markerPath = path.join(dir, identity + "." + hash(input.stage) + ".json");
  const lockPath = path.join(dir, identity + ".lock");

  let lockFd: number;
  try {
    lockFd = fs.openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if (existsError(error)) {
      return { allowed: false, reason: "followup_conversation_locked" };
    }
    throw error;
  }

  const claim: FollowUpClaim = { lockFd, lockPath, markerPath, stage: input.stage };
  let markerFd: number;
  try {
    markerFd = fs.openSync(markerPath, "wx", 0o600);
  } catch (error) {
    if (existsError(error)) {
      closeAndUnlock(claim);
      return { allowed: false, reason: "followup_claim_exists" };
    }
    // Unexpected storage error: block further sends until manually reviewed.
    fs.closeSync(lockFd);
    throw error;
  }
  try {
    fs.writeFileSync(markerFd, JSON.stringify({
      version: 1, stage: input.stage, status: "pending",
      startedAt: new Date().toISOString(),
    }), { encoding: "utf8" });
    fs.fsyncSync(markerFd);
  } catch (error) {
    // Leave the marker and the conversation lock on disk. It is unknown
    // whether the claim reached persistent storage, so fail closed.
    fs.closeSync(markerFd);
    fs.closeSync(lockFd);
    throw error;
  }
  fs.closeSync(markerFd);
  return { allowed: true, claim };
}

export function finalizeAutomatedFollowUpClaim(
  claim: FollowUpClaim,
  result: "sent" | "not_sent" | "uncertain",
): void {
  if (result === "sent") {
    // The claim exists even if updating the receipt fails. In that case the
    // lock also remains, so a later process cannot silently send again.
    writePrivateJsonAtomic(claim.markerPath, {
      version: 1, stage: claim.stage, status: "sent",
      confirmedAt: new Date().toISOString(),
    });
    closeAndUnlock(claim);
    return;
  }
  if (result === "not_sent") {
    // Only a known skipped/dry-run transport may release its attempted stage.
    fs.unlinkSync(claim.markerPath);
    closeAndUnlock(claim);
    return;
  }
  // Unknown network outcome: do NOT unlock or clear the marker. Both require
  // explicit human reconciliation, rather than automatic retry on reboot.
  fs.closeSync(claim.lockFd);
}
