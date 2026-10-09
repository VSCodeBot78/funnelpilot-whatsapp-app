import { getConversationState } from "../data/store.js";
import { isAiReplyAllowed } from "../core/state-manager.js";

export type AiOutboundGuardReason =
  | "conversation_missing"
  | "human_owned"
  | "ai_paused"
  | "stopped";

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

  return isAiReplyAllowed(state)
    ? { allowed: true, reason: null }
    : { allowed: false, reason: "ai_paused" };
}
