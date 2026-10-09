import { env } from "../config/env.js";

export type InstagramAutomationGateReason =
  | "engine_disabled"
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
}): InstagramAutomationGateResult {
  const senderId = normalizeString(params.senderId);
  const engineEnabled =
    params.engineEnabled ?? env.INSTAGRAM_ENGINE_ENABLED;
  const allowedSenderIds =
    params.allowedSenderIds ?? env.INSTAGRAM_ALLOWED_SENDER_IDS;

  if (!engineEnabled) {
    return {
      allowed: false,
      reason: "engine_disabled",
    };
  }

  const allowlist = normalizeAllowedSenderIds(allowedSenderIds);

  if (allowlist.size > 0 && !allowlist.has(senderId)) {
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

export function isInstagramRecipientAllowed(
  recipientId: string,
  allowedSenderIds = env.INSTAGRAM_ALLOWED_SENDER_IDS,
): boolean {
  const allowlist = normalizeAllowedSenderIds(allowedSenderIds);
  return allowlist.size === 0 || allowlist.has(normalizeString(recipientId));
}
