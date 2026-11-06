import crypto from "node:crypto";
import { env } from "../config/env.js";
import { decidePeteNextAction } from "../core/pete-decision-layer.js";
import { getAllCampaigns, getCampaignById, normalizePeteCampaignConfig } from "../data/campaigns.store.js";
import { evaluateCampaignEntryPreview } from "./pete-campaign-entry-preview.service.js";
import { appendAssistantMessage, appendUserMessage, persistConversationState } from "../core/state-manager.js";
import { getConversationState } from "../data/store.js";
import type { ConversationState } from "../types/types.js";

type PendingFlow = {
  version: 1;
  campaignId: string;
  campaignFingerprint: string;
  stage: "await_button" | "pete_ready" | "await_delivery" | "delivery_failed";
  deliveryTargetStage?: "await_button" | "pete_ready";
  deliveryAttemptId?: string;
  deliveryConfirmed?: boolean;
  buttonPayload: string | null;
  linkText: string;
  linkUrl: string | null;
  expiresAt: number;
};
type Prepared = {
  kind: "prepared";
  text: string;
  state: ConversationState;
  quickReplies: Array<{ title: string; payload: string }>;
  campaignId: string;
  deliveryAttemptId?: string;
};
type Suppressed = { kind: "suppressed"; reason: string; state: ConversationState };
type Unhandled = { kind: "none" };
export type InstagramV2FlowDecision = Prepared | Suppressed | Unhandled;

const FLOW_KEY = "instagramV2Flow";
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const RESERVED_KEYWORDS = new Set(["CHECK", "KETO", "BULLSHIT"]);

function exactKeyword(text: string): string {
  return text.trim().replace(/^#/, "").replace(/[.!?]+$/, "").trim().toLocaleUpperCase("de-DE");
}
function validMetaText(text: string): boolean {
  return Boolean(text.trim()) && Buffer.byteLength(text, "utf8") <= 1000;
}
function validHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password &&
      !["localhost", "127.0.0.1", "::1"].includes(u.hostname.toLowerCase());
  } catch { return false; }
}
function fingerprint(campaignId: string): string | null {
  const campaign = getCampaignById(campaignId);
  if (!campaign) return null;
  const normalized = normalizePeteCampaignConfig(campaign.peteCampaign);
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
function parseFlow(state: ConversationState): PendingFlow | null {
  const value = state.answers[FLOW_KEY];
  if (typeof value !== "string") return null;
  try {
    const data = JSON.parse(value) as Partial<PendingFlow>;
    if (data.version !== 1 || typeof data.campaignId !== "string" ||
      typeof data.campaignFingerprint !== "string" ||
      !["await_button", "pete_ready", "await_delivery", "delivery_failed"].includes(String(data.stage)) ||
      (data.stage === "await_delivery" &&
        (!["await_button", "pete_ready"].includes(String(data.deliveryTargetStage)) ||
         typeof data.deliveryAttemptId !== "string")) ||
      !Number.isFinite(data.expiresAt) ||
      typeof data.linkText !== "string" ||
      !(data.linkUrl === null || typeof data.linkUrl === "string") ||
      !(data.buttonPayload === null || typeof data.buttonPayload === "string")) return null;
    return data as PendingFlow;
  } catch { return null; }
}
function recordReply(state: ConversationState, messageText: string, reply: string, pending: PendingFlow): string | undefined {
  // A real send must receive provider acknowledgement before the next V2
  // stage becomes actionable. NoSend simulations remain independently testable.
  const deliveryAttemptId = env.INSTAGRAM_SEND_ENABLED ? crypto.randomUUID() : undefined;
  appendUserMessage(state, messageText);
  appendAssistantMessage(state, reply);
  state.answers[FLOW_KEY] = JSON.stringify(deliveryAttemptId
    ? { ...pending, stage: "await_delivery", deliveryTargetStage: pending.stage,
        deliveryAttemptId, deliveryConfirmed: false }
    : { ...pending, deliveryConfirmed: false });
  persistConversationState(state);
  return deliveryAttemptId;
}

/** Settle ONLY the matching outstanding attempt on the latest persisted state.
 * A failed/uncertain send requires human review, never an implied button/CTA.
 * Do not overwrite STOP, human ownership or a newer inbound while awaiting ACK.
 */
export function settleInstagramV2Delivery(input: {
  leadId: string;
  campaignId: string;
  deliveryAttemptId?: string;
  assistantMessageId?: string;
  delivered: boolean;
}): boolean {
  if (!input.deliveryAttemptId) return false;
  const latest = getConversationState(input.leadId, input.campaignId);
  if (!latest) return false;
  const pending = parseFlow(latest);
  if (pending?.stage !== "await_delivery" ||
      pending.deliveryAttemptId !== input.deliveryAttemptId) return false;
  const assistantStillLatest = Boolean(input.assistantMessageId) &&
    latest.messages.at(-1)?.id === input.assistantMessageId;
  const safeToAdvance = input.delivered && assistantStillLatest &&
    latest.owner !== "human" && latest.aiPaused !== true && !latest.flags.stopped;
  pending.stage = safeToAdvance ? pending.deliveryTargetStage! : "delivery_failed";
  pending.deliveryConfirmed = safeToAdvance;
  delete pending.deliveryAttemptId;
  delete pending.deliveryTargetStage;
  latest.answers[FLOW_KEY] = JSON.stringify(pending);
  persistConversationState(latest);
  return true;
}
function suppress(state: ConversationState, text: string, reason: string): Suppressed {
  // A stale/replayed delivery is retained in the signed webhook audit, NOT
  // inserted as a fresh chat message or a new 24-hour permission window.
  if (reason !== "message_window_unverified_or_expired") {
    appendUserMessage(state, text);
    persistConversationState(state);
  }
  return { kind: "suppressed", reason, state };
}

/** A narrowly gated real-Instagram adapter. Not the desktop NoSend simulator.
 * The saved V2 record provides content ONLY, never delivery authorization.
 * Production remains disabled unless the separate opt-in flag is explicitly set.
 */
export function resolveInstagramV2Inbound(input: {
  state: ConversationState;
  senderId: string;
  recipientId: string;
  messageText: string;
  quickReplyPayload?: string;
  timestampMs?: number;
}): InstagramV2FlowDecision {
  if (!env.INSTAGRAM_V2_FLOW_ENABLED) return { kind: "none" };
  const { state, senderId, messageText } = input;
  const keyword = exactKeyword(messageText);
  // Hard STOP, explicit Human request, safety and privacy always run through
  // Pete's existing higher-priority engine, even with an old Meta timestamp.
  const intent = decidePeteNextAction(messageText).decisionType;
  if (["hard_stop", "human_request", "medical_critical", "medical_soft",
       "emotional_crisis", "legal_privacy"].includes(intent)) {
    return { kind: "none" };
  }

  // Fail closed if someone accidentally turns on generic ManyChat coexistence:
  // only an explicitly enabled, *existing* lead on a specific sender allowlist
  // may enter a real V2 flow. The outer webhook still enforces lead ownership.
  const ownsRecipient = !env.INSTAGRAM_ALLOW_ALL_SENDERS &&
    !env.INSTAGRAM_AUTO_ENABLE_NEW_LEADS &&
    Boolean(env.INSTAGRAM_ACCOUNT_ID) &&
    input.recipientId === env.INSTAGRAM_ACCOUNT_ID &&
    env.INSTAGRAM_ALLOWED_SENDER_IDS.includes(senderId);
  if (!ownsRecipient) return suppress(state, messageText, "owner_allowlist_required");

  const now = Date.now();
  const timestamp = input.timestampMs;
  if (!Number.isFinite(timestamp) || !timestamp ||
      timestamp > now + MAX_FUTURE_SKEW_MS ||
      timestamp <= now - WINDOW_MS) {
    return suppress(state, messageText, "message_window_unverified_or_expired");
  }

  if (state.flags.stopped || state.owner === "human" || state.aiPaused === true) {
    return { kind: "none" }; // Pete's existing STOP/Human handling remains authoritative.
  }
  const previous = parseFlow(state);
  if (env.INSTAGRAM_SEND_ENABLED &&
      (previous?.stage === "await_button" || previous?.stage === "pete_ready") &&
      previous.deliveryConfirmed !== true) {
    // Never promote a persisted local NoSend preview (or legacy unverified
    // state) into a real Meta-delivered flow simply by switching SEND on.
    previous.stage = "delivery_failed";
    state.answers[FLOW_KEY] = JSON.stringify(previous);
    return suppress(state, messageText, "v2_previous_preview_not_delivered");
  }
  if (previous?.stage === "await_delivery" || previous?.stage === "delivery_failed") {
    // A queued, refused or unknown provider delivery never proves the CTA was seen.
    return suppress(state, messageText, "v2_delivery_unconfirmed_human_review");
  }
  if (previous?.stage === "await_button") {
    if (previous.expiresAt <= now ||
        previous.campaignFingerprint !== fingerprint(previous.campaignId)) {
      delete state.answers[FLOW_KEY];
      return suppress(state, messageText, "saved_flow_changed_or_expired");
    }
    // No guessed clicks: only the payload of a signed Meta quick-reply event
    // can advance the CTA. A merely typed label is ordinary natural dialogue.
    if (!input.quickReplyPayload || input.quickReplyPayload !== previous.buttonPayload) {
      delete state.answers[FLOW_KEY];
      persistConversationState(state);
      return { kind: "none" };
    }
    if (!previous.linkUrl || !validHttpsUrl(previous.linkUrl)) {
      delete state.answers[FLOW_KEY];
      return suppress(state, messageText, "link_not_configured");
    }
    const text = [previous.linkText, previous.linkUrl].filter(Boolean).join("\n");
    if (!validMetaText(text)) {
      delete state.answers[FLOW_KEY];
      return suppress(state, messageText, "link_message_unsupported");
    }
    const next: PendingFlow = {
      ...previous, stage: "pete_ready", buttonPayload: null,
    };
    const deliveryAttemptId = recordReply(state, messageText, text, next);
    return { kind: "prepared", text, state, quickReplies: [], campaignId: next.campaignId, deliveryAttemptId };
  }
  if (previous?.stage === "pete_ready") {
    if (previous.expiresAt <= now ||
        previous.campaignFingerprint !== fingerprint(previous.campaignId)) {
      delete state.answers[FLOW_KEY];
      return suppress(state, messageText, "saved_flow_changed_or_expired");
    }
    // Ordinary free-form follower messages now go to the existing Pete engine.
    return { kind: "none" };
  }
  // No silent catch-all or demo example. Only an explicitly configured
  // and unambiguous keyword can start an actual Instagram V2 flow.
  const preview = evaluateCampaignEntryPreview(getAllCampaigns(), {
    source: "instagram_dm", messageText,
  });
  const draft = preview.draftContext;
  if (preview.status !== "matched" || !draft ||
      !draft.matchedKeyword || draft.matchedKeyword !== keyword) {
    if (RESERVED_KEYWORDS.has(keyword) ||
        preview.status === "ambiguous" || preview.status === "manual_review") {
      return suppress(state, messageText, "saved_draft_unavailable_or_ambiguous");
    }
    return { kind: "none" };
  }
  const flow = draft.flowDraft;
  if (draft.mode !== "preview_only" || draft.sendAllowed !== false ||
      flow.sendAllowed !== false || !flow.enabled ||
      !flow.autoReplyEnabled || !flow.peteHandoffEnabled ||
      !flow.text || !validMetaText(flow.text) ||
      draft.source !== "instagram_dm") {
    return suppress(state, messageText, "saved_draft_disabled_or_invalid");
  }
  const variants = [flow.text, ...flow.openingDmVariants].filter(validMetaText);
  const variantIndex = crypto.createHash("sha256")
    .update(senderId + ":" + draft.campaignId).digest().readUInt32BE(0) % variants.length;
  const opener = variants[variantIndex];
  const withButton = flow.openingDmButtonEnabled;
  const label = flow.openingDmButtonLabel.trim();
  const withLink = flow.linkEnabled;
  if ((withButton && (!label || label.length > 20 || !withLink)) ||
      (withLink && (!flow.linkUrl || !validHttpsUrl(flow.linkUrl)))) {
    return suppress(state, messageText, "meta_button_or_link_invalid");
  }
  const link = withLink ? flow.linkUrl : null;
  const linkText = flow.linkMessageText.trim();
  const output = !withButton && link ? [opener, linkText, link].filter(Boolean).join("\n") : opener;
  if (!validMetaText(output)) return suppress(state, messageText, "meta_message_too_long");
  const buttonPayload = withButton ? "fp_v2_" + crypto.randomBytes(16).toString("hex") : null;
  const digest = fingerprint(draft.campaignId);
  if (!digest) return suppress(state, messageText, "saved_campaign_missing");
  const pending: PendingFlow = {
    version: 1, campaignId: draft.campaignId,
    campaignFingerprint: digest,
    stage: buttonPayload ? "await_button" : "pete_ready",
    buttonPayload, linkText, linkUrl: link,
    expiresAt: Math.min(now + WINDOW_MS, timestamp + WINDOW_MS),
  };
  const deliveryAttemptId = recordReply(state, messageText, output, pending);
  return {
    kind: "prepared", text: output, state,
    quickReplies: buttonPayload ? [{ title: label, payload: buttonPayload }] : [],
    campaignId: draft.campaignId, deliveryAttemptId,
  };
}
