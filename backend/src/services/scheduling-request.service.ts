import { getConversationState } from "../data/store.js";
import { getSchedulingConfig } from "../data/scheduling-config.store.js";
import {
  getProviderConfig,
  normalizeSchedulingCampaignId,
  normalizeSchedulingProvider,
} from "../config/scheduling-providers.js";
import { getCampaignById as getDashboardCampaignById } from "../data/campaigns.store.js";
import { readSettings } from "./settings-store.js";
import type { ConversationState } from "../types/types.js";
import type {
  MeetingType,
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

function isHttpUrl(value: string | undefined): value is string {
  const url = value?.trim();
  return Boolean(url && (url.startsWith("http://") || url.startsWith("https://")));
}

function asSafeHttpUrl(value: unknown): string | undefined {
  const url = typeof value === "string" ? value.trim() : "";
  return isHttpUrl(url) ? url : undefined;
}

type BookingTarget = {
  bookingUrl: string;
  provider: SchedulingProvider;
  meetingType: MeetingType;
  platform: string;
};

function inferProviderFromUrl(
  bookingUrl: string | undefined,
  fallback: SchedulingProvider = "manual",
): SchedulingProvider {
  const normalized = String(bookingUrl ?? "").toLowerCase();

  if (normalized.includes("calendly.")) {
    return "calendly";
  }

  if (normalized.includes("meetergo.")) {
    return "meetergo";
  }

  return fallback;
}

function buildBookingTarget(params: {
  rawUrl: unknown;
  state: ConversationState;
  provider?: unknown;
  meetingType?: unknown;
  platform?: unknown;
}): BookingTarget | undefined {
  const rawUrl = asSafeHttpUrl(params.rawUrl);
  if (!rawUrl) {
    return undefined;
  }

  const configuredProvider = normalizeSchedulingProvider(params.provider);
  const provider = inferProviderFromUrl(rawUrl, configuredProvider);
  const trackedUrl = asSafeHttpUrl(
    buildTrackedBookingUrl(rawUrl, params.state, provider),
  );

  return {
    bookingUrl: trackedUrl ?? rawUrl,
    provider,
    meetingType:
      params.meetingType === "video" || params.meetingType === "link"
        ? params.meetingType
        : provider === "manual"
          ? "phone"
          : "link",
    platform:
      typeof params.platform === "string" && params.platform.trim()
        ? params.platform.trim()
        : provider,
  };
}

function getCampaignIdCandidates(campaignId: string): string[] {
  const normalized = String(campaignId || "").trim();
  const candidates = [normalized, normalizeSchedulingCampaignId(normalized)];

  if (normalized === "eltern-vital-fit") {
    candidates.push("fit");
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function resolveEffectiveCampaignBookingTarget(
  state: ConversationState,
): BookingTarget | undefined {
  for (const candidateId of getCampaignIdCandidates(state.campaignId)) {
    const schedulingConfig = getSchedulingConfig(
      normalizeSchedulingCampaignId(candidateId),
    );
    const defaultProvider = normalizeSchedulingProvider(
      schedulingConfig?.defaultProvider,
    );
    const activeProviderConfig =
      schedulingConfig?.providers?.[defaultProvider] ??
      Object.values(schedulingConfig?.providers ?? {}).find(
        (providerConfig) =>
          normalizeSchedulingProvider(providerConfig?.provider) === defaultProvider,
      );

    const target = buildBookingTarget({
      rawUrl: activeProviderConfig?.bookingUrl,
      state,
      provider: activeProviderConfig?.provider ?? defaultProvider,
      meetingType: activeProviderConfig?.meetingType,
      platform: activeProviderConfig?.platform,
    });

    if (target) {
      return target;
    }
  }

  return undefined;
}

function resolveCampaignBookingTarget(
  state: ConversationState,
): BookingTarget | undefined {
  for (const candidateId of getCampaignIdCandidates(state.campaignId)) {
    const campaign = getDashboardCampaignById(candidateId);
    const booking =
      campaign?.booking && typeof campaign.booking === "object"
        ? (campaign.booking as Record<string, unknown>)
        : undefined;

    const target =
      buildBookingTarget({
        rawUrl: booking?.externalBookingUrl,
        state,
        provider: booking?.provider,
        meetingType: booking?.meetingType,
        platform: booking?.provider,
      }) ??
      buildBookingTarget({
        rawUrl: booking?.bookingUrl,
        state,
        provider: booking?.provider,
        meetingType: booking?.meetingType,
        platform: booking?.provider,
      }) ??
      buildBookingTarget({
        rawUrl: booking?.standardBookingUrl,
        state,
        provider: booking?.provider,
        meetingType: booking?.meetingType,
        platform: booking?.provider,
      });

    if (target) {
      return target;
    }
  }

  return undefined;
}

function resolveGlobalBookingTarget(
  state: ConversationState,
): BookingTarget | undefined {
  const settings = readSettings() as Record<string, unknown>;
  const provider = normalizeSchedulingProvider(settings.defaultBookingProvider);

  if (provider === "calendly") {
    return (
      buildBookingTarget({
        rawUrl: settings.calendlyBookingUrl,
        state,
        provider,
        meetingType: "link",
        platform: "calendly",
      }) ??
      buildBookingTarget({
        rawUrl: settings.defaultBookingUrl,
        state,
        provider,
        meetingType: "link",
        platform: "calendly",
      })
    );
  }

  if (provider === "meetergo") {
    return (
      buildBookingTarget({
        rawUrl: settings.meetergoBookingUrl,
        state,
        provider,
        meetingType: "link",
        platform: "meetergo",
      }) ??
      buildBookingTarget({
        rawUrl: settings.defaultBookingUrl,
        state,
        provider,
        meetingType: "link",
        platform: "meetergo",
      })
    );
  }

  if (provider === "custom") {
    return (
      buildBookingTarget({
        rawUrl: settings.customBookingUrl,
        state,
        provider,
        meetingType: "link",
        platform: "custom",
      }) ??
      buildBookingTarget({
        rawUrl: settings.defaultBookingUrl,
        state,
        provider,
        meetingType: "link",
        platform: "custom",
      })
    );
  }

  return (
    buildBookingTarget({
      rawUrl: settings.defaultBookingUrl,
      state,
      provider: inferProviderFromUrl(asSafeHttpUrl(settings.defaultBookingUrl)),
    }) ??
    buildBookingTarget({
      rawUrl: settings.bookingUrl,
      state,
      provider: inferProviderFromUrl(asSafeHttpUrl(settings.bookingUrl)),
    }) ??
    buildBookingTarget({
      rawUrl: settings.standardBookingUrl,
      state,
      provider: inferProviderFromUrl(asSafeHttpUrl(settings.standardBookingUrl)),
    })
  );
}

function resolveFallbackProviderBookingTarget(
  state: ConversationState,
): BookingTarget | undefined {
  const providerConfig = getProviderConfig(state.campaignId);

  return buildBookingTarget({
    rawUrl: providerConfig.bookingUrl,
    state,
    provider: providerConfig.provider,
    meetingType: providerConfig.meetingType,
    platform: providerConfig.platform,
  });
}

function resolveProviderBookingTargetFromState(
  state: ConversationState,
): BookingTarget | undefined {
  return (
    resolveEffectiveCampaignBookingTarget(state) ??
    resolveCampaignBookingTarget(state) ??
    resolveGlobalBookingTarget(state) ??
    resolveFallbackProviderBookingTarget(state)
  );
}

export function resolveProviderBookingUrlFromState(
  state: ConversationState,
): string | undefined {
  return resolveProviderBookingTargetFromState(state)?.bookingUrl;
}

function buildSchedulingRequest(state: ConversationState): SchedulingRequest {
  const status = getSchedulingStatus(state);
  const providerConfig = getProviderConfig(state.campaignId);
  const bookingTarget = resolveProviderBookingTargetFromState(state);

  return {
    leadId: state.leadId,
    campaignId: state.campaignId,
    leadName: state.answers.name,
    bookingText: state.answers.pendingBookingText?.trim() || "",
    requestedDay: state.answers.pendingBookingDay,
    requestedTimeText: state.answers.pendingBookingTime,
    bookingStatus: status,
    provider: bookingTarget?.provider ?? providerConfig.provider,
    meetingType: bookingTarget?.meetingType ?? providerConfig.meetingType,
    platform: bookingTarget?.platform ?? providerConfig.platform,
    externalBookingUrl: bookingTarget?.bookingUrl,
    externalEventId: undefined,
    readyForProvider: status === "confirmed",
    requestedAt: getRequestedAt(state),
    confirmedAt: getConfirmedAt(state),
    providerLabel: getProviderLabel(bookingTarget?.provider ?? providerConfig.provider),
    providerMode: bookingTarget?.bookingUrl ? "booking_link" : "manual",
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
