import type { ConversationState } from "../types/types.js";
import { sendMetaInstagramTextMessage } from "./meta-instagram-api.service.js";
import { sendMetaWhatsappTextMessage } from "./meta-whatsapp-api.service.js";
import { normalizeWhatsappPhone } from "./whatsapp-lead-sync.service.js";
import {
  reserveAutomatedFollowUp,
  confirmAutomatedFollowUp,
  cancelUnsentAutomatedFollowUp,
} from "./automated-followup-ledger.service.js";

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


// Fast local barrier plus fail-closed persisted claim shared between workers
// that use the SAME DATA_DIR volume. Neither can undo a provider request that
// was already sent; an indeterminate result requires manual reconciliation.
const automatedFollowUpsInFlight = new Set<string>();

// Automated follow-ups are Pete-originated, never manual/human echo messages.
export async function sendConversationTextOutbound(input: {
  state: ConversationState;
  messageText: string;
  followUpStageKey: string;
}): Promise<ManualOutboundResult> {
  const target = resolveManualOutboundTransport(input.state);
  const key = JSON.stringify([input.state.campaignId, input.state.leadId]);
  const skipped = (reason: string): ManualOutboundResult => ({
    transport: target.transport,
    recipient: target.recipient,
    ok: true,
    sent: false,
    dryRun: true,
    sendSkipped: true,
    reason,
  });

  // Invalid transport or text must not leave permanent claims.
  if (!target.recipient || target.transport === "unsupported" ||
      !normalizeString(input.messageText)) {
    return sendManualConversationOutbound(input, "ai");
  }
  if (automatedFollowUpsInFlight.has(key)) {
    return skipped("followup_already_in_flight");
  }
  automatedFollowUpsInFlight.add(key);
  try {
    const claim = reserveAutomatedFollowUp({
      campaignId: input.state.campaignId,
      leadId: input.state.leadId,
      stageKey: input.followUpStageKey,
    });
    if (!claim.allowed) return skipped(claim.reason);
    // A timeout/5xx can mean Meta received the message. Never retry it
    // automatically; the durable claim remains reserved for manual review.
    let result: ManualOutboundResult;
    try {
      result = await sendManualConversationOutbound(input, "ai");
    } catch {
      return {
        transport: target.transport, recipient: target.recipient,
        ok: false, sent: false, dryRun: false, sendSkipped: false,
        error: "followup_provider_result_uncertain",
      };
    }

    if (result.sent) {
      try {
        confirmAutomatedFollowUp(claim.key);
      } catch {
        // Retain the reservation and report the actual Meta send truthfully.
        // Further automatic sends fail closed until reconciliation.
        console.error("[pete-followup] sent receipt ledger unavailable");
      }
    } else if (result.sendSkipped && result.dryRun) {
      // Provider explicitly guaranteed NO send (disabled/allowlist guard).
      try {
        cancelUnsentAutomatedFollowUp(claim.key);
      } catch {
        console.error("[pete-followup] unsent claim ledger unavailable");
      }
    }
    return result;
  } finally {
    automatedFollowUpsInFlight.delete(key);
  }
}
