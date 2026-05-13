export function hoursSince(timestamp) {
  if (!timestamp) return 0;
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
}

export function formatRelativeMinutes(timestamp) {
  if (!timestamp) return "gerade eben";
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `vor ${diffDays} Tag${diffDays > 1 ? "en" : ""}`;
}

export function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getCampaignById(campaigns, id) {
  if (!campaigns?.length) return null;
  return campaigns.find((c) => c.id === id) || campaigns[0] || null;
}

export function getPriorityScore(contact) {
  let score = 0;
  if (contact.tags?.includes("Heißer Lead")) score += 50;
  if (contact.tags?.includes("Gespräch läuft")) score += 10;
  if (contact.tags?.includes("Termin gebucht")) score += 15;
  if (contact.readiness === "hot") score += 40;
  if (contact.readiness === "warm") score += 20;
  if (contact.intent === "scheduling") score += 30;
  if (contact.intent === "scale_value") score += 20;
  if (contact.booked) score -= 50;
  if (contact.excluded) score -= 100;
  return score;
}

export function getLastMessage(contact) {
  const messages = contact?.messages || [];
  return messages.length ? messages[messages.length - 1] : null;
}

export function getLeadDisplayName(contact) {
  return contact?.name?.trim() || "(ohne Namen)";
}

export function getLeadStatusLabel(contact) {
  if (contact.booked) return "Terminiert";
  if (contact.tags?.includes("Heißer Lead")) return "Heiß";
  if (contact.tags?.includes("Gespräch läuft")) return "In Kontakt";
  if (contact.tags?.includes("Dummy")) return "Dummy";
  return "Neu";
}

export const AVAILABILITY_DAY_LABELS = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
};

export const AVAILABILITY_DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const BOOKING_PROVIDERS = ["manual", "calendly", "meetergo", "custom"];

const BOOKING_PROVIDER_ALIASES = {
  google: "custom",
  google_calendar: "custom",
  zoom: "custom",
  meet: "custom",
  provider: "custom",
  external_link: "custom",
};

const CAMPAIGN_ID_ALIASES = {
  fit: "eltern-vital-fit",
};

export const DEFAULT_OFFER_CONTEXT = {
  priceInquiryText:
    "Die Preise hängen davon ab, welche Begleitung wirklich zu deiner Situation passt. Wenn du möchtest, schauen wir im Strategiegespräch kurz, was sinnvoll ist.",
  infoLink1Enabled: true,
  infoLink1Label: "Angebot ansehen",
  infoLink1Url: "",
  infoLink2Enabled: false,
  infoLink2Label: "Video ansehen",
  infoLink2Url: "",
  internalNote: "",
};

export function getDefaultOfferContext() {
  return { ...DEFAULT_OFFER_CONTEXT };
}

export function getNormalizedOfferContext(campaign = {}) {
  const context = campaign?.offerContext || {};

  return {
    priceInquiryText:
      typeof context.priceInquiryText === "string"
        ? context.priceInquiryText
        : DEFAULT_OFFER_CONTEXT.priceInquiryText,
    infoLink1Enabled:
      typeof context.infoLink1Enabled === "boolean"
        ? context.infoLink1Enabled
        : DEFAULT_OFFER_CONTEXT.infoLink1Enabled,
    infoLink1Label:
      typeof context.infoLink1Label === "string"
        ? context.infoLink1Label
        : DEFAULT_OFFER_CONTEXT.infoLink1Label,
    infoLink1Url:
      typeof context.infoLink1Url === "string"
        ? context.infoLink1Url
        : DEFAULT_OFFER_CONTEXT.infoLink1Url,
    infoLink2Enabled:
      typeof context.infoLink2Enabled === "boolean"
        ? context.infoLink2Enabled
        : DEFAULT_OFFER_CONTEXT.infoLink2Enabled,
    infoLink2Label:
      typeof context.infoLink2Label === "string"
        ? context.infoLink2Label
        : DEFAULT_OFFER_CONTEXT.infoLink2Label,
    infoLink2Url:
      typeof context.infoLink2Url === "string"
        ? context.infoLink2Url
        : DEFAULT_OFFER_CONTEXT.infoLink2Url,
    internalNote:
      typeof context.internalNote === "string"
        ? context.internalNote
        : DEFAULT_OFFER_CONTEXT.internalNote,
  };
}

export const DEFAULT_UNKNOWN_ENTRY_FALLBACK_TEXT =
  "Danke dir. Damit ich dich sauber einordne: Geht es bei dir gerade eher um Energie, Bauch, Schlaf/Stress oder Struktur?";

export const DEFAULT_ENTRY_CONFIG = {
  entryChannel: "meta_ctwa",
  starterMode: "prefilled_message",
  suggestedEntryMessage: "",
  matchingMode: "hybrid",
  exactTriggerRequired: false,
  triggerFallbackEnabled: true,
  ctwaAttributionEnabled: true,
  metaAdId: "",
  metaAdName: "",
  metaCampaignId: "",
  metaCampaignName: "",
  unknownEntryFallbackText: DEFAULT_UNKNOWN_ENTRY_FALLBACK_TEXT,
};

function normalizeOptionValue(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

export function getDefaultEntryConfig(trigger = "") {
  return {
    ...DEFAULT_ENTRY_CONFIG,
    suggestedEntryMessage: typeof trigger === "string" ? trigger : "",
  };
}

export function getNormalizedEntryConfig(campaign = {}) {
  const config = campaign?.entryConfig || {};
  const legacyTrigger = typeof campaign?.trigger === "string" ? campaign.trigger : "";

  return {
    entryChannel: normalizeOptionValue(
      config.entryChannel,
      ["meta_ctwa", "website_whatsapp_link", "qr_shortlink", "organic_dm", "manual"],
      DEFAULT_ENTRY_CONFIG.entryChannel,
    ),
    starterMode: normalizeOptionValue(
      config.starterMode,
      ["prefilled_message", "start_conversation_prompt", "whatsapp_flow", "free_text"],
      DEFAULT_ENTRY_CONFIG.starterMode,
    ),
    suggestedEntryMessage:
      typeof config.suggestedEntryMessage === "string" &&
      config.suggestedEntryMessage.trim()
        ? config.suggestedEntryMessage
        : legacyTrigger,
    matchingMode: normalizeOptionValue(
      config.matchingMode,
      ["hybrid", "referral_only", "text_only", "fallback_only"],
      DEFAULT_ENTRY_CONFIG.matchingMode,
    ),
    exactTriggerRequired:
      typeof config.exactTriggerRequired === "boolean"
        ? config.exactTriggerRequired
        : DEFAULT_ENTRY_CONFIG.exactTriggerRequired,
    triggerFallbackEnabled:
      typeof config.triggerFallbackEnabled === "boolean"
        ? config.triggerFallbackEnabled
        : DEFAULT_ENTRY_CONFIG.triggerFallbackEnabled,
    ctwaAttributionEnabled:
      typeof config.ctwaAttributionEnabled === "boolean"
        ? config.ctwaAttributionEnabled
        : DEFAULT_ENTRY_CONFIG.ctwaAttributionEnabled,
    metaAdId:
      typeof config.metaAdId === "string" ? config.metaAdId : DEFAULT_ENTRY_CONFIG.metaAdId,
    metaAdName:
      typeof config.metaAdName === "string"
        ? config.metaAdName
        : DEFAULT_ENTRY_CONFIG.metaAdName,
    metaCampaignId:
      typeof config.metaCampaignId === "string"
        ? config.metaCampaignId
        : DEFAULT_ENTRY_CONFIG.metaCampaignId,
    metaCampaignName:
      typeof config.metaCampaignName === "string"
        ? config.metaCampaignName
        : DEFAULT_ENTRY_CONFIG.metaCampaignName,
    unknownEntryFallbackText:
      typeof config.unknownEntryFallbackText === "string" &&
      config.unknownEntryFallbackText.trim()
        ? config.unknownEntryFallbackText
        : DEFAULT_ENTRY_CONFIG.unknownEntryFallbackText,
  };
}

export function normalizeBookingProvider(value, fallback = "manual") {
  const raw = String(value || "").trim().toLowerCase();
  const aliased = BOOKING_PROVIDER_ALIASES[raw] || raw;

  if (BOOKING_PROVIDERS.includes(aliased)) {
    return aliased;
  }

  return BOOKING_PROVIDERS.includes(fallback) ? fallback : "manual";
}

export function getDefaultBookingConfig(settings = {}) {
  return {
    provider: normalizeBookingProvider(settings.defaultBookingProvider),
    bookingMode: "",
    calendarId: settings.calendarId || "",
    externalBookingUrl: settings.defaultBookingUrl || "",
    videoProvider: "none",
    meetingType: "phone",
    durationMinutes: 15,
    maxSuggestions: Number(settings.maxSuggestions || 2),
    notes: "",
    bookingPrompt: settings.bookingPrompt || "",
    starterCheckoutUrl: settings.starterCheckoutUrl || "",
    onboardingBookingUrl: settings.onboardingBookingUrl || "",
  };
}

export function getNormalizedBookingConfig(campaign, settings = {}) {
  const config = {
    ...getDefaultBookingConfig(settings),
    ...(campaign?.booking || {}),
  };

  return {
    ...config,
    provider: normalizeBookingProvider(config.provider),
    bookingMode: config.bookingMode || "",
  };
}

function getGlobalBookingUrl(settings = {}, provider = "manual") {
  const normalizedProvider = normalizeBookingProvider(provider);

  if (normalizedProvider === "calendly") {
    return settings.calendlyBookingUrl || settings.defaultBookingUrl || "";
  }

  if (normalizedProvider === "meetergo") {
    return settings.meetergoBookingUrl || settings.defaultBookingUrl || "";
  }

  if (normalizedProvider === "custom") {
    return settings.customBookingUrl || settings.defaultBookingUrl || "";
  }

  return settings.defaultBookingUrl || "";
}

function normalizeBookingMode(value, provider, bookingUrl) {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "calendly" || raw === "provider") return "provider";
  if (raw === "external_link") return "external_link";
  if (raw === "manual") return "manual";

  if (provider && provider !== "manual") return "provider";
  if (bookingUrl) return "external_link";
  return "manual";
}

export function getEffectiveCampaignBookingConfig(campaign, settings = {}) {
  const useGlobalBookingDefaults = campaign?.useGlobalBookingDefaults === true;
  const campaignBooking = getNormalizedBookingConfig(campaign, settings);
  const globalProvider = normalizeBookingProvider(settings.defaultBookingProvider);
  const source = useGlobalBookingDefaults ? "global" : "campaign";

  if (useGlobalBookingDefaults) {
    const globalBookingUrl = getGlobalBookingUrl(settings, globalProvider);

    return {
      effectiveProvider: globalProvider,
      effectiveBookingMode: normalizeBookingMode(
        settings.bookingMode,
        globalProvider,
        globalBookingUrl,
      ),
      effectiveBookingUrl: globalBookingUrl,
      effectiveMeetingType: settings.defaultMeetingType || "phone",
      effectiveVideoProvider: settings.videoProvider || "none",
      effectiveDurationMinutes: Number(settings.durationMinutes || 15),
      effectiveMaxSuggestions: Number(settings.maxSuggestions || 2),
      source,
    };
  }

  return {
    effectiveProvider: normalizeBookingProvider(campaignBooking.provider),
    effectiveBookingMode: normalizeBookingMode(
      campaignBooking.bookingMode,
      campaignBooking.provider,
      campaignBooking.externalBookingUrl,
    ),
    effectiveBookingUrl: campaignBooking.externalBookingUrl || "",
    effectiveMeetingType: campaignBooking.meetingType || "phone",
    effectiveVideoProvider: campaignBooking.videoProvider || "none",
    effectiveDurationMinutes: Number(campaignBooking.durationMinutes || 15),
    effectiveMaxSuggestions: Number(campaignBooking.maxSuggestions || 2),
    source,
  };
}

export function getDefaultBookingData() {
  return {
    selectedSlot: "",
    startAt: undefined,
    endAt: undefined,
    bookingProvider: "",
    bookingId: "",
    externalBookingId: "",
    calendarEventId: "",
    meetingLink: "",
    meetingType: "unknown",
    status: "inactive",
    confirmedAt: null,
    cancelledAt: null,
    notes: "",
  };
}

export function formatBookingSlot(bookingData = {}) {
  const data = bookingData || {};
  if (typeof data.selectedSlot === "string" && data.selectedSlot.trim()) {
    return data.selectedSlot.trim();
  }

  const startAt = data.startAt;
  if (typeof startAt === "string" && startAt.trim()) {
    const date = new Date(startAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return startAt.trim();
  }

  return "";
}

export function getEmptyAvailabilityForm() {
  return {
    sourceMode: "static",
    maxSuggestions: 3,
    weeklySlotsText: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
    },
    updatedAt: null,
  };
}

export function mapAvailabilityConfigToForm(config) {
  return {
    sourceMode: config?.sourceMode || "static",
    maxSuggestions: Number(config?.maxSuggestions || 3),
    weeklySlotsText: {
      monday: (config?.weeklySlots?.monday || []).join(", "),
      tuesday: (config?.weeklySlots?.tuesday || []).join(", "),
      wednesday: (config?.weeklySlots?.wednesday || []).join(", "),
      thursday: (config?.weeklySlots?.thursday || []).join(", "),
      friday: (config?.weeklySlots?.friday || []).join(", "),
      saturday: (config?.weeklySlots?.saturday || []).join(", "),
    },
    updatedAt: config?.updatedAt || null,
  };
}

export function parseWeeklySlotsTextMap(weeklySlotsText) {
  const result = {};
  AVAILABILITY_DAY_KEYS.forEach((dayKey) => {
    const raw = weeklySlotsText?.[dayKey] || "";
    result[dayKey] = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });
  return result;
}

export function getBackendCampaignId(frontendCampaignId) {
  const raw = String(frontendCampaignId || "").trim();
  return CAMPAIGN_ID_ALIASES[raw] || raw;
}

export function buildSchedulingConfigPayloadFromCampaign(campaign, settings = {}) {
  const booking = getNormalizedBookingConfig(campaign, settings);
  const effectiveBooking = getEffectiveCampaignBookingConfig(campaign, settings);
  const externalUrl = (effectiveBooking.effectiveBookingUrl || "").trim();
  const defaultProvider = normalizeBookingProvider(effectiveBooking.effectiveProvider);
  const fallbackBookingUrl =
    externalUrl ||
    settings.defaultBookingUrl ||
    "https://calendly.com/eltern-fitundvital/strategiegespraech";

  return {
    defaultProvider,
    providers: {
      manual: {
        provider: "manual",
        platform: "manual",
        meetingType: "phone",
      },
      calendly: {
        provider: "calendly",
        platform: "calendly",
        meetingType: "link",
        bookingUrl: defaultProvider === "calendly" ? fallbackBookingUrl : undefined,
      },
      meetergo: {
        provider: "meetergo",
        platform: "meetergo",
        meetingType: "link",
        bookingUrl:
          defaultProvider === "meetergo" && externalUrl
            ? externalUrl
            : "https://cal.meetergo.com/jochen-kammerer/strategie-gesprach",
      },
      custom: {
        provider: "custom",
        platform: "custom",
        meetingType: externalUrl ? "link" : "phone",
        bookingUrl: defaultProvider === "custom" ? externalUrl : undefined,
      },
    },
    texts: {
      bookingPrompt: booking.bookingPrompt?.trim() || "",
      starterCheckoutUrl: booking.starterCheckoutUrl?.trim() || "",
      onboardingBookingUrl: booking.onboardingBookingUrl?.trim() || "",
    },
  };
}
