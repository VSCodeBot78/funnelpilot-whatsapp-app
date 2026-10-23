import { getConversationState } from "../data/store.js";
import { getLeadById } from "../data/leads.store.js";
import { isAiReplyAllowed } from "../core/state-manager.js";

export type AiOutboundGuardReason =
  | "conversation_missing"
  | "human_owned"
  | "ai_paused"
  | "stopped"
  | "lead_bot_disabled"
  | "lead_excluded"
  | "sales_followup_opt_out"
  | "message_window_unverified_or_expired";

export type AiOutboundGuardResult =
  | { allowed: true; reason: null }
  | { allowed: false; reason: AiOutboundGuardReason };

export function evaluateLatestAiOutboundPermission(params: {
  leadId: string;
  campaignId: string;
  purpose?: "conversation_reply" | "automated_followup";
}): AiOutboundGuardResult {
  const state = getConversationState(params.leadId, params.campaignId);

  if (!state) {
    return { allowed: false, reason: "conversation_missing" };
  }

  if (state.flags.stopped) {
    return { allowed: false, reason: "stopped" };
  }

  if (state.owner === "human") {
    return { allowed: false, reason: "human_owned" };
  }

  if (state.aiPaused === true) {
    return { allowed: false, reason: "ai_paused" };
  }

  // A late opt-out also blocks already-prepared reminders at send time.
  if (params.purpose === "automated_followup" && state.flags.salesFollowUpsOptedOut) {
    return { allowed: false, reason: "sales_followup_opt_out" };
  }

  const lead = getLeadById(params.leadId);
  if (lead?.excluded) {
    return { allowed: false, reason: "lead_excluded" };
  }

  if (lead && !lead.botEnabled) {
    return { allowed: false, reason: "lead_bot_disabled" };
  }

  // All existing automated follow-up transports send ordinary text, NOT
  // approved WhatsApp templates. Their Meta 24h window needs a real inbound
  // timestamp; a bot response and a comment alone never renew this window.
  if (params.purpose === "automated_followup") {
    const inboundMs = Date.parse(state.lastUserMessageAt ?? "");
    const nowMs = Date.now();
    if (!Number.isFinite(inboundMs) || inboundMs > nowMs ||
        nowMs >= inboundMs + 24 * 60 * 60 * 1000) {
      return { allowed: false, reason: "message_window_unverified_or_expired" };
    }
  }

  return isAiReplyAllowed(state)
    ? { allowed: true, reason: null }
    : { allowed: false, reason: "ai_paused" };
}
