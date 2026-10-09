import type { ConversationMessage } from "../types/types.js";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function markLatestAssistantMessagePrepared(params: {
  messages: ConversationMessage[];
  replyText: string;
  transport: string;
}): boolean {
  const replyText = normalizeString(params.replyText);
  if (!replyText) {
    return false;
  }

  for (let index = params.messages.length - 1; index >= 0; index -= 1) {
    const message = params.messages[index];
    if (
      message.role === "assistant" &&
      normalizeString(message.text) === replyText
    ) {
      message.outboundStatus = "prepared";
      message.transport = params.transport;
      message.dryRun = true;
      message.sentAt = null;
      message.metaMessageId = null;
      message.sent = false;
      message.sendError = null;
      return true;
    }
  }

  return false;
}

export function updateLatestAssistantMessageSendResult(params: {
  messages: ConversationMessage[];
  replyText: string;
  transport: string;
  outboundStatus: "sent" | "send_failed";
  sentAt?: string | null;
  metaMessageId?: string | null;
  sendError?: string | null;
}): boolean {
  const replyText = normalizeString(params.replyText);
  if (!replyText) {
    return false;
  }

  for (let index = params.messages.length - 1; index >= 0; index -= 1) {
    const message = params.messages[index];
    if (
      message.role === "assistant" &&
      normalizeString(message.text) === replyText
    ) {
      message.outboundStatus = params.outboundStatus;
      message.transport = params.transport;
      message.dryRun = params.outboundStatus !== "sent";
      message.sentAt = params.sentAt ?? null;
      message.metaMessageId = params.metaMessageId ?? null;
      message.sent = params.outboundStatus === "sent";
      message.sendError = params.sendError ?? null;
      return true;
    }
  }

  return false;
}
