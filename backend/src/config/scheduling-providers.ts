import { getSchedulingConfig } from "../data/scheduling-config.store.js";
import type { MeetingType, SchedulingProvider } from "../types/scheduling.types.js";

const CAMPAIGN_ID_ALIASES: Record<string, string> = {
  fit: "eltern-vital-fit",
};

export type ProviderConfig = {
  provider: SchedulingProvider;
  platform: string;
  meetingType: MeetingType;
  bookingUrl?: string;
};

export type BookingTextsConfig = {
  bookingPrompt?: string;
  starterCheckoutUrl?: string;
  onboardingBookingUrl?: string;
};

export type CampaignSchedulingConfig = {
  defaultProvider: SchedulingProvider;
  providers: Record<string, ProviderConfig>;
  texts?: BookingTextsConfig;
};

const CALENDLY_URL =
  "https://calendly.com/eltern-fitundvital/strategiegespraech";

const MEETERGO_URL =
  "https://cal.meetergo.com/jochen-kammerer/strategie-gesprach";

export const CAMPAIGN_SCHEDULING_CONFIG: Record<string, CampaignSchedulingConfig> = {
  "eltern-vital-fit": {
    defaultProvider: "calendly",
    providers: {
      calendly: {
        provider: "calendly",
        platform: "calendly",
        meetingType: "link",
        bookingUrl: CALENDLY_URL,
      },
      meetergo: {
        provider: "meetergo",
        platform: "meetergo",
        meetingType: "link",
        bookingUrl: MEETERGO_URL,
      },
      manual: {
        provider: "manual",
        platform: "manual",
        meetingType: "phone",
      },
      custom: {
        provider: "custom",
        platform: "custom",
        meetingType: "phone",
      },
    },
    texts: {
      bookingPrompt:
        "Ein kurzer Austausch ist hier am sinnvollsten.\nWann passt es dir eher?\n" +
        "a) unter der Woche um 19:00\n" +
        "b) unter der Woche um 19:45\n" +
        "c) ich bin flexibel",
      starterCheckoutUrl:
        "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
      onboardingBookingUrl:
        "https://calendly.com/eltern-fitundvital/strategiegespraech",
    },
  },
};

function buildFallbackSchedulingConfig(): CampaignSchedulingConfig {
  return {
    defaultProvider: "manual",
    providers: {
      manual: {
        provider: "manual",
        platform: "manual",
        meetingType: "phone",
      },
      custom: {
        provider: "custom",
        platform: "custom",
        meetingType: "phone",
      },
    },
    texts: {
      bookingPrompt:
        "Ein kurzer Austausch ist hier am sinnvollsten.\nWann passt es dir eher?\n" +
        "a) unter der Woche um 19:00\n" +
        "b) unter der Woche um 19:45\n" +
        "c) ich bin flexibel",
      starterCheckoutUrl:
        "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
      onboardingBookingUrl:
        "https://calendly.com/eltern-fitundvital/strategiegespraech",
    },
  };
}

export function normalizeSchedulingCampaignId(campaignId: string): string {
  const normalized = String(campaignId || "").trim();
  return CAMPAIGN_ID_ALIASES[normalized] ?? normalized;
}

export function normalizeSchedulingProvider(
  provider: unknown,
  fallback: SchedulingProvider = "manual",
): SchedulingProvider {
  const value = String(provider ?? "").trim().toLowerCase();

  if (
    value === "manual" ||
    value === "calendly" ||
    value === "meetergo" ||
    value === "custom"
  ) {
    return value;
  }

  if (
    value === "google" ||
    value === "google_calendar" ||
    value === "zoom" ||
    value === "meet" ||
    value === "provider" ||
    value === "external_link"
  ) {
    return "custom";
  }

  return fallback;
}

function normalizeProviderConfig(
  providerKey: string,
  config: ProviderConfig,
): ProviderConfig {
  const provider = normalizeSchedulingProvider(config.provider ?? providerKey);

  return {
    ...config,
    provider,
    platform: String(config.platform || provider),
  };
}

function normalizeCampaignSchedulingConfig(
  config: CampaignSchedulingConfig,
): CampaignSchedulingConfig {
  const providers: Record<string, ProviderConfig> = {};

  Object.entries(config.providers || {}).forEach(([providerKey, providerConfig]) => {
    const normalized = normalizeProviderConfig(providerKey, providerConfig);
    providers[normalized.provider] = {
      ...providers[normalized.provider],
      ...normalized,
    };
  });

  if (!providers.manual) {
    providers.manual = {
      provider: "manual",
      platform: "manual",
      meetingType: "phone",
    };
  }

  const defaultProvider = normalizeSchedulingProvider(config.defaultProvider);

  return {
    ...config,
    defaultProvider: providers[defaultProvider] ? defaultProvider : "manual",
    providers,
  };
}

export function getCampaignSchedulingConfig(campaignId: string): CampaignSchedulingConfig {
  const effectiveCampaignId = normalizeSchedulingCampaignId(campaignId);
  const editableConfig = getSchedulingConfig(effectiveCampaignId);
  if (editableConfig) {
    return normalizeCampaignSchedulingConfig(editableConfig);
  }

  return normalizeCampaignSchedulingConfig(
    CAMPAIGN_SCHEDULING_CONFIG[effectiveCampaignId] ?? buildFallbackSchedulingConfig(),
  );
}

export function getProviderConfig(
  campaignId: string,
  provider?: SchedulingProvider,
): ProviderConfig {
  const campaignConfig = getCampaignSchedulingConfig(campaignId);
  const resolvedProvider = normalizeSchedulingProvider(
    provider ?? campaignConfig.defaultProvider,
    campaignConfig.defaultProvider,
  );

  return (
    campaignConfig.providers[resolvedProvider] ??
    campaignConfig.providers[campaignConfig.defaultProvider]
  );
}

export function getSchedulingTextsConfig(campaignId: string): BookingTextsConfig {
  const campaignConfig = getCampaignSchedulingConfig(campaignId);
  return campaignConfig.texts ?? {};
}
