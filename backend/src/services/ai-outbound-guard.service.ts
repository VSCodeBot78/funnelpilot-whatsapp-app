import { getConversationState } from "../data/store.js";
import { getLeadById } from "../data/leads.store.js";
import { isAiReplyAllowed } from "../core/state-manager.js";

export type AiOutboundGuardReason =
  | "conversation_missing"
  | "human_owned"
  | "ai_paused"
  | "stopped"
  | "lead_bot_disabled"
  | "lead_excluded";

export type AiOutboundGuardResult =
  | { allowed: true; reason: null }
  | { allowed: false; reason: AiOutboundGuardReason };

export function evaluateLatestAiOutboundPermission(params: {
  leadId: string;
  campaignId: string;
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
