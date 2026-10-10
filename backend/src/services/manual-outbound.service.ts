import type { ConversationState } from "../types/types.js";
import { sendMetaInstagramTextMessage } from "./meta-instagram-api.service.js";
import { sendMetaWhatsappTextMessage } from "./meta-whatsapp-api.service.js";
import { normalizeWhatsappPhone } from "./whatsapp-lead-sync.service.js";

export type ManualOutboundTransport =
  | "meta_instagram"
  | "meta_whatsapp"
  | "unsupported";

export type ManualOutboundResult = {
  transport: ManualOutboundTransport;
  recipient?: string;
  ok: boolean;
  sent: boolean;
  dryRun: boolean;
  sendSkipped: boolean;
  reason?: string;
  error?: string;
  metaMessageId?: string | null;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function getInstagramRecipient(state: ConversationState): string {
  const leadId = normalizeString(state.leadId);
  if (leadId.startsWith("instagram:")) {
    return leadId.slice("instagram:".length).trim();
  }
  return "";
}

function getWhatsappRecipient(state: ConversationState): string {
  const fromPhone = normalizeWhatsappPhone(state.phone);
  if (fromPhone) {
    return fromPhone;
  }

  const leadId = normalizeString(state.leadId);
  if (leadId.startsWith("whatsapp:")) {
    return normalizeWhatsappPhone(
      leadId.slice("whatsapp:".length),
    );
  }

  return "";
}

export function resolveManualOutboundTransport(
  state: ConversationState,
): {
  transport: ManualOutboundTransport;
  recipient?: string;
} {
  const source = normalizeString(state.source).toLowerCase();
  const leadId = normalizeString(state.leadId).toLowerCase();

  if (source.includes("instagram") || leadId.startsWith("instagram:")) {
    const recipient = getInstagramRecipient(state);
    return {
      transport: "meta_instagram",
      recipient: recipient || undefined,
    };
  }

  if (source.includes("whatsapp") || leadId.startsWith("whatsapp:")) {
    const recipient = getWhatsappRecipient(state);
    return {
      transport: "meta_whatsapp",
      recipient: recipient || undefined,
    };
  }

  return { transport: "unsupported" };
}

export async function sendManualConversationOutbound(input: {
  state: ConversationState;
  messageText: string;
}): Promise<ManualOutboundResult> {
  const messageText = normalizeString(input.messageText);
  const target = resolveManualOutboundTransport(input.state);

  if (!messageText) {
    return {
      transport: target.transport,
      recipient: target.recipient,
      ok: false,
      sent: false,
      dryRun: false,
      sendSkipped: false,
      error: "message_text_missing",
    };
  }

  if (!target.recipient) {
    return {
      transport: target.transport,
      ok: false,
      sent: false,
      dryRun: false,
      sendSkipped: false,
      error:
        target.transport === "unsupported"
          ? "unsupported_conversation_transport"
          : "recipient_missing",
    };
  }

  if (target.transport === "meta_instagram") {
    const result = await sendMetaInstagramTextMessage({
      to: target.recipient,
      body: messageText,
    });

    return {
      transport: target.transport,
      recipient: target.recipient,
      ok: result.ok,
      sent: result.sent,
      dryRun: result.dryRun,
      sendSkipped: result.sendSkipped,
      reason: result.sendSkipped ? result.reason : undefined,
      error: result.ok ? undefined : result.error,
      metaMessageId:
        result.ok && result.sent ? result.metaMessageId : undefined,
    };
  }

  if (target.transport === "meta_whatsapp") {
    const result = await sendMetaWhatsappTextMessage({
      to: target.recipient,
      body: messageText,
    });

    return {
      transport: target.transport,
      recipient: target.recipient,
      ok: result.ok,
      sent: result.sent,
      dryRun: result.dryRun,
      sendSkipped: result.sendSkipped,
      reason: result.sendSkipped ? result.reason : undefined,
      error: result.ok ? undefined : result.error,
      metaMessageId:
        result.ok && result.sent ? result.metaMessageId : undefined,
    };
  }

  return {
    transport: "unsupported",
    ok: false,
    sent: false,
    dryRun: false,
    sendSkipped: false,
    error: "unsupported_conversation_transport",
  };
}


// Generic alias for automated follow-ups that use the same channel routing.
export const sendConversationTextOutbound = sendManualConversationOutbound;
