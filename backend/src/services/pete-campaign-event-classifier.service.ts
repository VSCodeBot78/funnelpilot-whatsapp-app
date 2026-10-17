import type { CampaignEntrySource } from "./pete-campaign-entry-preview.service.js";

// Analyze only admin-supplied webhook examples. This is not wired into the
// provider receivers and cannot create a lead, schedule a job or send a DM.
export type CampaignEventChannel = "instagram" | "whatsapp";
export type ClassifiedCampaignEvent = {
  mode: "preview_only";
  sendAllowed: false;
  status: "recognized" | "invalid_payload" | "manual_review" | "unsupported";
  reason: string;
  source: CampaignEntrySource | null;
  eventId: string | null;
  messageText: string;
  mediaId: string | null;
};

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject : null;
const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";
const field = (value: unknown, key: string): unknown => object(value)?.[key];
const idFrom = (value: unknown): string => str(value);
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const result = (
  status: ClassifiedCampaignEvent["status"],
  reason: string,
  source: CampaignEntrySource | null = null,
  eventId: string | null = null,
  messageText = "",
  mediaId: string | null = null,
): ClassifiedCampaignEvent => ({
  mode: "preview_only", sendAllowed: false, status, reason,
  source, eventId, messageText, mediaId,
});

export function classifyCampaignWebhookExample(
  channel: CampaignEventChannel,
  payload: unknown,
): ClassifiedCampaignEvent {
  const root = object(payload);
  if (!root || !["instagram", "whatsapp"].includes(channel)) {
    return result("invalid_payload", "invalid_root");
  }
  if (channel === "instagram" && str(root.object).toLowerCase() !== "instagram") {
    return result("invalid_payload", "not_instagram_webhook");
  }
  if (channel === "whatsapp" && str(root.object).toLowerCase() !== "whatsapp_business_account") {
    return result("invalid_payload", "not_whatsapp_webhook");
  }

  const entries = list(root.entry);
  if (entries.length !== 1) return result("manual_review", "requires_single_event");

  const entry = object(entries[0]);
  if (!entry) return result("invalid_payload", "invalid_entry");

  if (channel === "instagram") {
    const messages = [
      ...list(entry.messaging),
      ...list(entry.changes).flatMap(change =>
        str(field(change, "field")).toLowerCase() === "messages"
          ? [field(change, "value")] : []),
    ].filter(value => object(value));
    const comments = list(entry.changes)
      .filter(change => str(field(change, "field")).toLowerCase() === "comments")
      .map(change => field(change, "value"));
    if (messages.length + comments.length !== 1) {
      return result("manual_review", "requires_single_instagram_message_or_comment");
    }
    if (comments.length === 1) {
      const comment = object(comments[0]);
      const media = object(comment?.media);
      const kind = str(media?.media_product_type).toUpperCase();
      const mediaId = idFrom(media?.id) || idFrom(comment?.media_id);
      const eventId = idFrom(comment?.id);
      const fromId = idFrom(field(comment?.from, "id"));
      if (!comment || !eventId || !mediaId || !fromId) {
        return result("manual_review", "comment_identity_or_media_missing");
      }
      if (!["REELS", "REEL"].includes(kind)) {
        return result("manual_review", "reel_media_type_not_verified");
      }
      const text = str(comment.text);
      if (!text) return result("manual_review", "empty_comment");
      return result("recognized", "verified_reel_comment",
        "instagram_reel_comment", eventId, text, mediaId);
    }
    const event = object(messages[0]);
    const message = object(event?.message);
    const eventId = idFrom(message?.mid);
    const sender = idFrom(field(event?.sender, "id"));
    if (!eventId || !sender || message?.is_echo === true) {
      return result("manual_review", "missing_identity_or_echo");
    }
    const text = str(message?.text);
    const hasAttachments = list(message?.attachments).length > 0;
    if (!text || (hasAttachments && !/^(CHECK|KETO|BULLSHIT)$/i.test(text))) {
      return result("manual_review", "media_requires_human_review");
    }
    const replyTo = object(message?.reply_to);
    const story = object(replyTo?.story);
    if (replyTo && !story) {
      return result("manual_review", "unverified_reply_context");
    }
    if (story) {
      const storyId = idFrom(story.id);
      if (!storyId) return result("manual_review", "story_id_missing");
      return result("recognized", "verified_story_reply",
        "instagram_story_reply", eventId, text, storyId);
    }
    return result("recognized", "verified_instagram_dm",
      "instagram_dm", eventId, text);
  }

  const changes = list(entry.changes).filter(change =>
    str(field(change, "field")).toLowerCase() === "messages");
  if (changes.length !== 1) return result("manual_review", "requires_single_messages_change");
  const value = object(field(changes[0], "value"));
  const messages = list(value?.messages);
  if (messages.length !== 1) return result("manual_review", "requires_single_whatsapp_message");
  const message = object(messages[0]);
  const eventId = idFrom(message?.id);
  const sender = idFrom(message?.from);
  const text = str(field(message?.text, "body"));
  if (!eventId || !sender || str(message?.type) !== "text" || !text) {
    return result("manual_review", "invalid_whatsapp_text_or_identity");
  }
  const referral = object(message?.referral) ?? object(field(message?.context, "referral"));
  if (referral) {
    const explicitAdEvidence = Boolean(str(referral.ctwa_clid) || str(referral.ad_id)) ||
      str(referral.source_type).toLowerCase() === "ad";
    if (!explicitAdEvidence) return result("manual_review", "referral_not_verified_ctwa");
    return result("recognized", "verified_ctwa", "whatsapp_ctwa", eventId, text);
  }
  return result("recognized", "verified_whatsapp_dm",
    "whatsapp_dm", eventId, text);
}
