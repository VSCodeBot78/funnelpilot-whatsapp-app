import { getConversationState } from "../data/store.js";
import { getLeadById } from "../data/leads.store.js";
import {
  appendHumanMessage,
  getOrCreateConversationState,
  persistConversationState,
  takeOverByHuman,
} from "../core/state-manager.js";
import { buildInstagramLeadId } from "./instagram-lead-sync.service.js";
import type { ParsedInstagramMessageEvent } from "./meta-instagram-webhook.service.js";
import type { ConversationState } from "../types/types.js";

export type InstagramEchoHandoffAction =
  | "ignored_bot_echo"
  | "human_takeover"
  | "ignored_unknown_echo";

export type InstagramEchoHandoffResult = {
  action: InstagramEchoHandoffAction;
  leadId?: string;
  campaignId?: string;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function isKnownAiEcho(
  state: ConversationState,
  event: ParsedInstagramMessageEvent,
): boolean {
  const messageId = normalizeString(event.messageId);
  const text = normalizeString(event.text);
  const eventTimestampMs =
    typeof event.timestampMs === "number" && Number.isFinite(event.timestampMs)
      ? event.timestampMs
      : Date.now();

  return state.messages.some((message) => {
    if (message.actor !== "ai") {
      return false;
    }

    const knownMetaMessageId = normalizeString(message.metaMessageId);
    if (messageId && knownMetaMessageId && knownMetaMessageId === messageId) {
      return true;
    }

    if (!text || normalizeString(message.text) !== text) {
      return false;
    }

    const createdAtMs = Date.parse(message.createdAt);
    if (!Number.isFinite(createdAtMs)) {
      return false;
    }

    // Covers the small race where Meta emits the echo before the send response
    // (and therefore metaMessageId) has been persisted.
    return Math.abs(eventTimestampMs - createdAtMs) <= 2 * 60 * 1000;
  });
}

export function handleInstagramEcho(
  event: ParsedInstagramMessageEvent,
): InstagramEchoHandoffResult {
  if (!event.isEcho) {
    return { action: "ignored_unknown_echo" };
  }

  const recipientId = normalizeString(event.recipientId);
  if (!recipientId) {
    return { action: "ignored_unknown_echo" };
  }

  const leadId = buildInstagramLeadId(recipientId);
  const lead = getLeadById(leadId);

  if (!lead) {
    return { action: "ignored_unknown_echo" };
  }

  const campaignId = normalizeString(lead.campaignId);
  if (!campaignId) {
    return { action: "ignored_unknown_echo" };
  }

  const existingState = getConversationState(leadId, campaignId);
  const state =
    existingState ??
    getOrCreateConversationState(leadId, campaignId);

  if (isKnownAiEcho(state, event)) {
    return {
      action: "ignored_bot_echo",
      leadId,
      campaignId,
    };
  }

  const text = normalizeString(event.text);
  if (text) {
    appendHumanMessage(state, text);
  } else {
    takeOverByHuman(state);
  }

  persistConversationState(state);

  return {
    action: "human_takeover",
    leadId,
    campaignId,
  };
}
