/**
 * Pete campaign engagement policy, Phase 64.
 *
 * Pure decisions only: absolutely no Meta API calls, follow-up scheduler,
 * real account messages or spend. A comment is not a user-authored DM.
 * Live transport can only follow after explicit separate authorization.
 */

export type PeteCommentCampaignJourney = {
  campaignId: string;
  commentId: string;
  commenterId: string;
  commentCreatedAtMs: number;
  firstPrivateReplySentAtMs?: number;
  firstPrivateReplyMessageId?: string;
  lastInboundUserDmAtMs?: number;
  linkSentAtMs?: number;
  lastFollowupSentAtMs?: number;
  stopped?: boolean;
  humanOwned?: boolean;
  aiPaused?: boolean;
  optedOut?: boolean;
  botEnabled?: boolean;
};

export type PeteCampaignDecision =
  | { allowed: true; reason: "allowed" }
  | { allowed: false; reason:
      "not_enabled" | "no_comment" | "already_sent" | "comment_too_old" |
      "missing_confirmed_private_reply" | "no_user_dm" |
      "outside_24h_window" | "not_due" | "already_followed_up" |
      "human_owned" | "ai_paused" | "stopped" | "opted_out" |
      "bot_disabled" | "invalid_timestamp" };

const HOUR_MS = 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * HOUR_MS;
const SAFE_INBOUND_DM_WINDOW_MS = 23 * HOUR_MS + 55 * 60 * 1000;

function blockByOwner(journey: PeteCommentCampaignJourney): PeteCampaignDecision | null {
  if (journey.stopped) return { allowed: false, reason: "stopped" };
  if (journey.optedOut) return { allowed: false, reason: "opted_out" };
  if (journey.humanOwned) return { allowed: false, reason: "human_owned" };
  if (journey.aiPaused) return { allowed: false, reason: "ai_paused" };
  if (journey.botEnabled === false) return { allowed: false, reason: "bot_disabled" };
  return null;
}

const timestampValid = (value: number | undefined) =>
  value !== undefined && Number.isSafeInteger(value) && value > 0;

/** At most ONE private reply to a given Instagram comment, within seven days. */
export function canPrepareFirstCommentPrivateReply(input: {
  journey: PeteCommentCampaignJourney;
  nowMs: number;
  enabled: boolean;
}): PeteCampaignDecision {
  if (!input.enabled) return { allowed: false, reason: "not_enabled" };
  const ownerBlock = blockByOwner(input.journey);
  if (ownerBlock) return ownerBlock;
  if (!input.journey.commentId || !input.journey.commenterId)
    return { allowed: false, reason: "no_comment" };
  if (input.journey.firstPrivateReplySentAtMs || input.journey.firstPrivateReplyMessageId)
    return { allowed: false, reason: "already_sent" };
  if (!timestampValid(input.nowMs) || !timestampValid(input.journey.commentCreatedAtMs) ||
      input.nowMs < input.journey.commentCreatedAtMs)
    return { allowed: false, reason: "invalid_timestamp" };
  if (input.nowMs - input.journey.commentCreatedAtMs >= SEVEN_DAYS_MS)
    return { allowed: false, reason: "comment_too_old" };
  return { allowed: true, reason: "allowed" };
}

/**
 * Sending the first private reply is NOT a consent or a new 24h DM window.
 * A positive confirmation must be authored by the user AFTER the reply.
 * Buttons/postbacks are accepted only after their authenticity is verified.
 */
export function evaluateCampaignResourceConfirmation(input: {
  journey: PeteCommentCampaignJourney;
  userMessage: string;
  userMessageAtMs: number;
  enabled: boolean;
  verifiedInboundUserEvent: boolean;
}): PeteCampaignDecision {
  if (!input.enabled) return { allowed: false, reason: "not_enabled" };
  const ownerBlock = blockByOwner(input.journey);
  if (ownerBlock) return ownerBlock;
  if (!timestampValid(input.journey.firstPrivateReplySentAtMs))
    return { allowed: false, reason: "missing_confirmed_private_reply" };
  if (timestampValid(input.journey.linkSentAtMs))
    return { allowed: false, reason: "already_sent" };
  if (!input.verifiedInboundUserEvent)
    return { allowed: false, reason: "no_user_dm" };
  if (!timestampValid(input.userMessageAtMs) ||
      input.userMessageAtMs < input.journey.firstPrivateReplySentAtMs!)
    return { allowed: false, reason: "invalid_timestamp" };
  const text = input.userMessage.toLocaleLowerCase("de-DE")
    .replace(/[.,!?]+/g, " ").replace(/\s+/g, " ").trim();
  const simpleConfirm = /^(?:ja(?: bitte)?|ok|okay|gerne|bitte|klar)$/u.test(text);
  const askingForResource =
    /^(?:ja )?(?:schick(?:e)?|send(?:e)?) ?(?:mir )?(?:(?:den|die|das) )?(?:link|guide|check)?$/u.test(text) ||
    /^ich (?:möchte|will) (?:(?:den|die|das) )?(?:link|guide|check)$/u.test(text);
  const confirms = simpleConfirm || askingForResource;
  if (!confirms) return { allowed: false, reason: "no_user_dm" };
  return { allowed: true, reason: "allowed" };
}

/** The follow-up needs a real user DM and must still fit in its 24h window. */
export function canPrepareOrganicCampaignFollowup(input: {
  journey: PeteCommentCampaignJourney;
  nowMs: number;
  automationEnabled: boolean;
  configuredDelayHours: number;
}): PeteCampaignDecision {
  if (!input.automationEnabled) return { allowed: false, reason: "not_enabled" };
  const ownerBlock = blockByOwner(input.journey);
  if (ownerBlock) return ownerBlock;
  if (!timestampValid(input.journey.firstPrivateReplySentAtMs))
    return { allowed: false, reason: "missing_confirmed_private_reply" };
  if (!timestampValid(input.journey.linkSentAtMs))
    return { allowed: false, reason: "not_due" };
  if (timestampValid(input.journey.lastFollowupSentAtMs))
    return { allowed: false, reason: "already_followed_up" };
  const userDm = input.journey.lastInboundUserDmAtMs;
  if (!timestampValid(userDm)) return { allowed: false, reason: "no_user_dm" };
  if (!timestampValid(input.nowMs) || input.nowMs < userDm! ||
      input.journey.linkSentAtMs! < userDm!)
    return { allowed: false, reason: "invalid_timestamp" };
  if (input.nowMs - userDm! >= SAFE_INBOUND_DM_WINDOW_MS)
    return { allowed: false, reason: "outside_24h_window" };
  if (!Number.isInteger(input.configuredDelayHours) ||
      input.configuredDelayHours < 1 || input.configuredDelayHours > 24)
    return { allowed: false, reason: "not_due" };
  if (input.nowMs < input.journey.linkSentAtMs! + input.configuredDelayHours * HOUR_MS)
    return { allowed: false, reason: "not_due" };
  return { allowed: true, reason: "allowed" };
}
