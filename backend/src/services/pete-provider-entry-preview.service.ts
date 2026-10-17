import {
  parseInstagramMessageEvents,
} from "./meta-instagram-webhook.service.js";
import { evaluateInstagramSharedMedia } from "./instagram-shared-media-policy.js";
import {
  evaluateCampaignEntryPreview,
  type CampaignEntryPreview,
  type CampaignEntrySource,
} from "./pete-campaign-entry-preview.service.js";
import type { CampaignRecord } from "../data/campaigns.store.js";

// Offline/owner preview ONLY: this module does not mutate leads, call Pete,
// schedule follow-ups or send to Meta. Never use its result as send authority.
// The deployed Instagram message parser currently cannot establish whether
// a message was a Story reply or which Reel a comment belongs to.
export type ProviderEntryPreviewReason =
  | "instagram_dm_channel_only"
  | "whatsapp_text"
  | "whatsapp_ad_referral"
  | "unsupported_event"
  | "unverified_story_or_reel"
  | "ignored_echo"
  | "unsupported_media"
  | "ambiguous_event"
  | "invalid_provider"
  | "invalid_payload";

export type ProviderEntryPreview = {
  mode: "preview_only";
  sendAllowed: false;
  source: CampaignEntrySource | null;
  reason: ProviderEntryPreviewReason;
  entryPreview: CampaignEntryPreview | null;
};

function blocked(reason: ProviderEntryPreviewReason): ProviderEntryPreview {
  return {
    mode: "preview_only", sendAllowed: false,
    source: null, reason, entryPreview: null,
  };
}

function matched(
  campaigns: readonly CampaignRecord[],
  source: CampaignEntrySource,
  messageText: string,
  reason: ProviderEntryPreviewReason,
): ProviderEntryPreview {
  return {
    mode: "preview_only", sendAllowed: false, source, reason,
    entryPreview: evaluateCampaignEntryPreview(campaigns, {
      source, messageText,
    }),
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function previewProviderCampaignEntry(
  campaigns: readonly CampaignRecord[],
  input: { provider: unknown; payload: unknown },
): ProviderEntryPreview {
  const provider = input.provider;
  const payload = object(input.payload);
  if (provider !== "instagram" && provider !== "whatsapp") {
    return blocked("invalid_provider");
  }
  if (!payload) return blocked("invalid_payload");

  if (provider === "instagram") {
    if (payload.object !== "instagram") return blocked("invalid_payload");
    const entries = array(payload.entry);
    if (!entries.length) return blocked("invalid_payload");
    // A "comments" or other non-message change is NOT equivalent to the
    // messages envelope. Separate provider review is required for Reels.
    const fields = entries.flatMap(entry =>
      array(object(entry)?.changes).map(change => asText(object(change)?.field)));
    if (fields.some(field => field !== "messages")) {
      return blocked("unverified_story_or_reel");
    }
    const parsed = parseInstagramMessageEvents(payload);
    if (parsed.length !== 1) {
      return blocked(parsed.length > 1 ? "ambiguous_event" : "unsupported_event");
    }
    const event = parsed[0];
    if (event.isEcho) return blocked("ignored_echo");
    if (!event.messageId || !event.senderId || !event.recipientId) {
      return blocked("invalid_payload");
    }
    if (event.hasAttachments ||
        evaluateInstagramSharedMedia(event.hasAttachments, event.text) !== "normal_text") {
      return blocked("unsupported_media");
    }
    if (!event.text) return blocked("unsupported_event");
    // Label only the *transport*: story attribution is not available in the
    // current parser. An IG DM may originate from a Story. Never guess it.
    return matched(campaigns, "instagram_dm", event.text,
      "instagram_dm_channel_only");
  }

  if (payload.object !== "whatsapp_business_account") {
    return blocked("invalid_payload");
  }
  const changes = array(payload.entry).flatMap(entry =>
    array(object(entry)?.changes));
  if (!changes.length) return blocked("invalid_payload");
  if (changes.some(change => asText(object(change)?.field) !== "messages")) {
    return blocked("unsupported_event");
  }
  const messages = changes.flatMap(change =>
    array(object(object(change)?.value)?.messages));
  if (messages.length !== 1) {
    return blocked(messages.length > 1 ? "ambiguous_event" : "unsupported_event");
  }
  const message = object(messages[0]);
  if (!message || asText(message.type) !== "text" ||
      !asText(message.id) || !asText(message.from)) {
    return blocked("unsupported_event");
  }
  const text = asText(object(message.text)?.body);
  if (!text) return blocked("unsupported_event");

  const referral = object(message.referral) ??
    object(object(message.context)?.referral);
  const adEvidence = Boolean(referral && (
    asText(referral.ctwa_clid) ||
    asText(referral.ad_id) ||
    asText(referral.source_type).toLowerCase() === "ad"
  ));
  const source: CampaignEntrySource = adEvidence ? "whatsapp_ctwa" : "whatsapp_dm";
  return matched(campaigns, source, text,
    adEvidence ? "whatsapp_ad_referral" : "whatsapp_text");
}
