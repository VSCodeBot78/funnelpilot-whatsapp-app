import { env } from "../config/env.js";

export type InstagramAutomationGateReason =
  | "engine_disabled"
  | "allowlist_required"
  | "sender_not_allowlisted";

export type InstagramAutomationGateResult =
  | {
      allowed: true;
      reason: null;
    }
  | {
      allowed: false;
      reason: InstagramAutomationGateReason;
    };

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeAllowedSenderIds(values: string[]): Set<string> {
  return new Set(values.map(normalizeString).filter(Boolean));
}

export function evaluateInstagramAutomationGate(params: {
  senderId: string;
  engineEnabled?: boolean;
  allowedSenderIds?: string[];
  allowAllSenders?: boolean;
}): InstagramAutomationGateResult {
  const senderId = normalizeString(params.senderId);
  const engineEnabled =
    params.engineEnabled ?? env.INSTAGRAM_ENGINE_ENABLED;
  const allowedSenderIds =
    params.allowedSenderIds ?? env.INSTAGRAM_ALLOWED_SENDER_IDS;
  const allowAllSenders =
    params.allowAllSenders ?? env.INSTAGRAM_ALLOW_ALL_SENDERS;

  if (!engineEnabled) {
    return {
      allowed: false,
      reason: "engine_disabled",
    };
  }

  const allowlist = normalizeAllowedSenderIds(allowedSenderIds);

  if (allowlist.size > 0) {
    if (!allowlist.has(senderId)) {
      return {
        allowed: false,
        reason: "sender_not_allowlisted",
      };
    }

    return {
      allowed: true,
      reason: null,
    };
  }

  if (!allowAllSenders) {
    return {
      allowed: false,
      reason: "allowlist_required",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

export function isInstagramRecipientAllowed(
  recipientId: string,
  allowedSenderIds = env.INSTAGRAM_ALLOWED_SENDER_IDS,
  allowAllSenders = env.INSTAGRAM_ALLOW_ALL_SENDERS,
): boolean {
  const allowlist = normalizeAllowedSenderIds(allowedSenderIds);

  if (allowlist.size > 0) {
    return allowlist.has(normalizeString(recipientId));
  }

  return allowAllSenders;
}
