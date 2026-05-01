import { getConversationState } from "../data/store.js";
import { getProviderConfig } from "../config/scheduling-providers.js";
import type { ConversationState } from "../types/types.js";
import type {
  SchedulingPreviewResult,
  SchedulingProvider,
  SchedulingRequest,
  SchedulingStatus,
} from "../types/scheduling.types.js";

function getSchedulingStatus(state: ConversationState): SchedulingStatus {
  const bookingStatus = state.answers.bookingRequest?.status;

  if (bookingStatus === "confirmed") {
    return "confirmed";
  }

  if (bookingStatus === "requested") {
    return "requested";
  }

  return "draft";
}

function getRequestedAt(state: ConversationState): string | undefined {
  return state.answers.bookingRequest?.detectedAt;
}

function getConfirmedAt(state: ConversationState): string | undefined {
  if (state.answers.bookingRequest?.status === "confirmed") {
    return state.answers.bookingRequest.detectedAt;
  }

  return undefined;
}

function getProviderLabel(provider: SchedulingProvider): string {
  switch (provider) {
    case "calendly":
      return "Calendly";
    case "meetergo":
      return "Meetergo";
    case "custom":
      return "Custom";
    case "manual":
    default:
      return "Manuell";
  }
}

function buildTrackedBookingUrl(
  rawUrl: string | undefined,
  state: ConversationState,
  provider: SchedulingProvider,
): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);

    if (provider === "calendly") {
      url.searchParams.set("utm_source", "whatsapp_funnel_app");
      url.searchParams.set("utm_campaign", state.campaignId);
      url.searchParams.set("utm_content", state.leadId);

      if (state.answers.name?.trim()) {
        url.searchParams.set("name", state.answers.name.trim());
      }
    }

    if (provider === "meetergo") {
      url.searchParams.set("utm_source", "whatsapp_funnel_app");
      url.searchParams.set("utm_campaign", state.campaignId);
      url.searchParams.set("utm_content", state.leadId);
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

function buildSchedulingRequest(state: ConversationState): SchedulingRequest {
  const status = getSchedulingStatus(state);
  const providerConfig = getProviderConfig(state.campaignId);
  const trackedBookingUrl = buildTrackedBookingUrl(
    providerConfig.bookingUrl,
    state,
    providerConfig.provider,
  );

  return {
    leadId: state.leadId,
    campaignId: state.campaignId,
    leadName: state.answers.name,
    bookingText: state.answers.pendingBookingText?.trim() || "",
    requestedDay: state.answers.pendingBookingDay,
    requestedTimeText: state.answers.pendingBookingTime,
    bookingStatus: status,
    provider: providerConfig.provider,
    meetingType: providerConfig.meetingType,
    platform: providerConfig.platform,
    externalBookingUrl: trackedBookingUrl,
    externalEventId: undefined,
    readyForProvider: status === "confirmed",
    requestedAt: getRequestedAt(state),
    confirmedAt: getConfirmedAt(state),
    providerLabel: getProviderLabel(providerConfig.provider),
    providerMode: trackedBookingUrl ? "booking_link" : "manual",
  };
}

export function buildSchedulingPreviewFromState(
  state: ConversationState,
): SchedulingPreviewResult {
  const bookingText = state.answers.pendingBookingText?.trim();

  if (!bookingText) {
    return {
      ok: false,
      ready: false,
      error: "Kein Terminwunsch im State gefunden.",
    };
  }

  const schedulingRequest = buildSchedulingRequest(state);

  if (!schedulingRequest.readyForProvider) {
    return {
      ok: true,
      ready: false,
      schedulingRequest,
      error: "Terminwunsch vorhanden, aber noch nicht final bestätigt.",
    };
  }

  return {
    ok: true,
    ready: true,
    schedulingRequest,
  };
}

export function buildSchedulingPreviewByLead(
  leadId: string,
  campaignId: string,
): SchedulingPreviewResult {
  const state = getConversationState(leadId, campaignId);

  if (!state) {
    return {
      ok: false,
      ready: false,
      error: "Kein Conversation State gefunden.",
    };
  }

  return buildSchedulingPreviewFromState(state);
}
