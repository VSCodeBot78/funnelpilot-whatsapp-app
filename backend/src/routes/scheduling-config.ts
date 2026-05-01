import { Router } from "express";
import {
  deleteSchedulingConfig,
  getSchedulingConfig,
  saveSchedulingConfig,
} from "../data/scheduling-config.store.js";
import {
  getCampaignSchedulingConfig,
  normalizeSchedulingCampaignId,
  normalizeSchedulingProvider,
  type BookingTextsConfig,
  type CampaignSchedulingConfig,
  type ProviderConfig,
} from "../config/scheduling-providers.js";
import type { MeetingType, SchedulingProvider } from "../types/scheduling.types.js";

const router = Router();

const ALLOWED_PROVIDERS: SchedulingProvider[] = [
  "manual",
  "calendly",
  "meetergo",
  "custom",
];

const ALLOWED_MEETING_TYPES: MeetingType[] = ["phone", "video", "link"];

function isSchedulingProvider(value: unknown): value is SchedulingProvider {
  return typeof value === "string" && ALLOWED_PROVIDERS.includes(value as SchedulingProvider);
}

function isMeetingType(value: unknown): value is MeetingType {
  return typeof value === "string" && ALLOWED_MEETING_TYPES.includes(value as MeetingType);
}

function buildDefaultResponse(campaignId: string): CampaignSchedulingConfig {
  const effectiveCampaignId = normalizeSchedulingCampaignId(campaignId);
  return getSchedulingConfig(effectiveCampaignId) ?? getCampaignSchedulingConfig(effectiveCampaignId);
}

function sanitizeProviderConfig(
  providerKey: string,
  raw: unknown,
): ProviderConfig | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const provider = normalizeSchedulingProvider(value.provider ?? providerKey);

  if (!isSchedulingProvider(provider)) {
    return null;
  }

  const meetingType = isMeetingType(value.meetingType) ? value.meetingType : "phone";

  const platform =
    typeof value.platform === "string" && value.platform.trim()
      ? value.platform.trim()
      : provider;

  const bookingUrl =
    typeof value.bookingUrl === "string" && value.bookingUrl.trim()
      ? value.bookingUrl.trim()
      : undefined;

  return {
    provider,
    platform,
    meetingType,
    bookingUrl,
  };
}

function sanitizeBookingTexts(raw: unknown): BookingTextsConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = raw as Record<string, unknown>;

  const bookingPrompt =
    typeof value.bookingPrompt === "string" && value.bookingPrompt.trim()
      ? value.bookingPrompt.trim()
      : undefined;

  const starterCheckoutUrl =
    typeof value.starterCheckoutUrl === "string" && value.starterCheckoutUrl.trim()
      ? value.starterCheckoutUrl.trim()
      : undefined;

  const onboardingBookingUrl =
    typeof value.onboardingBookingUrl === "string" && value.onboardingBookingUrl.trim()
      ? value.onboardingBookingUrl.trim()
      : undefined;

  return {
    bookingPrompt,
    starterCheckoutUrl,
    onboardingBookingUrl,
  };
}

router.get("/:campaignId", (req, res) => {
  const campaignId = normalizeSchedulingCampaignId(req.params.campaignId);
  const config = buildDefaultResponse(campaignId);

  return res.json({
    ok: true,
    campaignId,
    config,
  });
});

router.post("/:campaignId", (req, res) => {
  try {
    const campaignId = normalizeSchedulingCampaignId(req.params.campaignId);
    const body = req.body as Record<string, unknown>;

    const defaultProvider = normalizeSchedulingProvider(body.defaultProvider);
    const providers = body.providers;
    const texts = body.texts;

    if (!isSchedulingProvider(defaultProvider)) {
      return res.status(400).json({
        ok: false,
        error: "invalid_default_provider",
      });
    }

    if (!providers || typeof providers !== "object") {
      return res.status(400).json({
        ok: false,
        error: "invalid_providers_object",
      });
    }

    const sanitizedProviders: Record<string, ProviderConfig> = {};

    for (const [providerKey, providerValue] of Object.entries(
      providers as Record<string, unknown>,
    )) {
      const sanitized = sanitizeProviderConfig(providerKey, providerValue);

      if (sanitized) {
        sanitizedProviders[providerKey] = sanitized;
      }
    }

    if (!Object.keys(sanitizedProviders).length) {
      return res.status(400).json({
        ok: false,
        error: "no_valid_providers_found",
      });
    }

    if (!sanitizedProviders[defaultProvider]) {
      return res.status(400).json({
        ok: false,
        error: "default_provider_missing_in_providers",
      });
    }

    const sanitizedTexts = sanitizeBookingTexts(texts);

    const nextConfig: CampaignSchedulingConfig = {
      defaultProvider,
      providers: sanitizedProviders,
      texts: sanitizedTexts,
    };

    saveSchedulingConfig(campaignId, nextConfig);

    return res.json({
      ok: true,
      campaignId,
      config: nextConfig,
    });
  } catch (error) {
    console.error("scheduling-config route error:", error);

    return res.status(500).json({
      ok: false,
      error: "scheduling_config_save_failed",
    });
  }
});

router.delete("/:campaignId", (req, res) => {
  const campaignId = normalizeSchedulingCampaignId(req.params.campaignId);
  deleteSchedulingConfig(campaignId);

  return res.json({
    ok: true,
    campaignId,
    config: getCampaignSchedulingConfig(campaignId),
    reset: true,
  });
});

export default router;
