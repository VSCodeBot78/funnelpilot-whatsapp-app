import type { ConversationState } from "../types/types.js";

type PendingAiInstagramOutbound = {
  token: string;
  recipientId: string;
  text: string;
  metaMessageId?: string;
  createdAtMs: number;
};

const PENDING_TTL_MS = 2 * 60 * 1000;
const pending = new Map<string, PendingAiInstagramOutbound>();

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function prune(nowMs = Date.now()): void {
  for (const [token, item] of pending.entries()) {
    if (nowMs - item.createdAtMs > PENDING_TTL_MS) {
      pending.delete(token);
    }
  }
}

export function registerPendingAiInstagramOutbound(input: {
  recipientId: string;
  text: string;
}): string {
  prune();

  const token = crypto.randomUUID();
  pending.set(token, {
    token,
    recipientId: normalizeString(input.recipientId),
    text: normalizeString(input.text),
    createdAtMs: Date.now(),
  });

  return token;
}

export function confirmPendingAiInstagramOutbound(input: {
  token: string;
  metaMessageId?: string | null;
}): void {
  prune();

  const item = pending.get(input.token);
  if (!item) {
    return;
  }

  item.metaMessageId = normalizeString(input.metaMessageId) || undefined;
}

export function clearPendingAiInstagramOutbound(token: string): void {
  pending.delete(token);
}

function stateContainsAiMessageId(
  state: ConversationState | undefined,
  messageId: string,
): boolean {
  if (!state || !messageId) {
    return false;
  }

  return state.messages.some(
    (message) =>
      message.actor === "ai" &&
      normalizeString(message.metaMessageId) === messageId,
  );
}

export function consumeKnownAiInstagramEcho(input: {
  recipientId: string;
  messageId: string;
  text?: string;
  state?: ConversationState;
}): boolean {
  prune();

  const recipientId = normalizeString(input.recipientId);
  const messageId = normalizeString(input.messageId);
  const text = normalizeString(input.text);

  if (stateContainsAiMessageId(input.state, messageId)) {
    return true;
  }

  for (const [token, item] of pending.entries()) {
    if (item.recipientId !== recipientId) {
      continue;
    }

    const idMatches =
      Boolean(messageId) &&
      Boolean(item.metaMessageId) &&
      item.metaMessageId === messageId;

    const pendingTextMatches =
      Boolean(text) &&
      item.text === text;

    if (idMatches || pendingTextMatches) {
      pending.delete(token);
      return true;
    }
  }

  return false;
}

export function clearPendingAiInstagramOutboundRegistry(): void {
  pending.clear();
}
