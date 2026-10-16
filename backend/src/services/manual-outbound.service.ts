import type { ConversationState } from "../types/types.js";
import { sendMetaInstagramTextMessage } from "./meta-instagram-api.service.js";
import { sendMetaWhatsappTextMessage } from "./meta-whatsapp-api.service.js";
import { normalizeWhatsappPhone } from "./whatsapp-lead-sync.service.js";
import {
  beginAutomatedFollowUpClaim,
  finalizeAutomatedFollowUpClaim,
} from "./automated-followup-claims.service.js";

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
}, origin: "human" | "ai" = "human"): Promise<ManualOutboundResult> {
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
      origin,
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


// Both Ghosting and provider-booking sends share durable per-conversation
// serialization and a unique, persistent claim for every follow-up stage.
// Only a *verified* no-send outcome may clear its claim. Unknown outcomes and
// crashed processes require reconciliation: never auto-retry a possible send.
export async function sendConversationTextOutbound(input: {
  state: ConversationState;
  messageText: string;
  idempotencyKey: string;
}): Promise<ManualOutboundResult> {
  const reservation = beginAutomatedFollowUpClaim({
    leadId: input.state.leadId,
    campaignId: input.state.campaignId,
    stage: input.idempotencyKey,
  });
  if (!reservation.allowed) {
    const target = resolveManualOutboundTransport(input.state);
    return {
      transport: target.transport,
      recipient: target.recipient,
      ok: true,
      sent: false,
      dryRun: true,
      sendSkipped: true,
      reason: reservation.reason,
    };
  }
  let outbound: ManualOutboundResult;
  try {
    // AI origin registers Instagram Meta echo IDs. Actual dashboard messages
    // continue using sendManualConversationOutbound(...), defaulting to human.
    outbound = await sendManualConversationOutbound(input, "ai");
  } catch (error) {
    finalizeAutomatedFollowUpClaim(reservation.claim, "uncertain");
    throw error;
  }
  if (outbound.ok && outbound.sent) {
    finalizeAutomatedFollowUpClaim(reservation.claim, "sent");
  } else if (outbound.dryRun && outbound.sendSkipped) {
    finalizeAutomatedFollowUpClaim(reservation.claim, "not_sent");
  } else {
    finalizeAutomatedFollowUpClaim(reservation.claim, "uncertain");
  }
  return outbound;
}
