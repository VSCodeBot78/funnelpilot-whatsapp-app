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
  | "sales_followup_opt_out";

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

  return isAiReplyAllowed(state)
    ? { allowed: true, reason: null }
    : { allowed: false, reason: "ai_paused" };
}
