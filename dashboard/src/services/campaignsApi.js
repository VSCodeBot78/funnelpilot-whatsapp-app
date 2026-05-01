import {
  getBackendCampaignId,
  getNormalizedBookingConfig,
  buildSchedulingConfigPayloadFromCampaign,
  normalizeBookingProvider,
} from "../utils/dashboardHelpers";

const FALLBACK_API_BASE_URL = "http://localhost:3001";

function getApiBaseUrl(apiBaseUrl) {
  return apiBaseUrl || FALLBACK_API_BASE_URL;
}

export async function loadCampaignSchedulingConfigFromApi({
  apiBaseUrl,
  campaign,
  settings,
}) {
  if (!campaign?.id) {
    throw new Error("campaign_missing_id");
  }

  const backendCampaignId = getBackendCampaignId(campaign.id);

  const response = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/scheduling-config/${backendCampaignId}`,
  );

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.config) {
    throw new Error(data?.error || "scheduling_config_load_failed");
  }

  const config = data.config;
  const defaultProvider = normalizeBookingProvider(config.defaultProvider);
  const activeProviderConfig = config.providers?.[defaultProvider] || {};
  const activeProviderUrl = activeProviderConfig.bookingUrl || "";
  const texts = config.texts || {};

  return {
    ...getNormalizedBookingConfig(campaign, settings),
    provider: defaultProvider,
    externalBookingUrl: activeProviderUrl,
    bookingPrompt: texts.bookingPrompt || "",
    starterCheckoutUrl: texts.starterCheckoutUrl || "",
    onboardingBookingUrl: texts.onboardingBookingUrl || "",
  };
}

export async function saveCampaignSchedulingConfigToApi({
  apiBaseUrl,
  campaign,
  settings,
}) {
  if (!campaign?.id) {
    throw new Error("campaign_missing_id");
  }

  const backendCampaignId = getBackendCampaignId(campaign.id);
  const payload = buildSchedulingConfigPayloadFromCampaign(campaign, settings);

  const response = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/scheduling-config/${backendCampaignId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.config) {
    throw new Error(data?.error || "scheduling_config_save_failed");
  }

  return data.config;
}

export async function loadCampaignsFromApi(apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/campaigns`);
  const data = await response.json();

  if (!response.ok || !data?.ok || !Array.isArray(data?.campaigns)) {
    throw new Error(data?.error || "campaigns_load_failed");
  }

  return data.campaigns;
}

export async function createCampaignInApi(campaign, apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(campaign),
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.campaign) {
    throw new Error(data?.error || "campaign_create_failed");
  }

  return data.campaign;
}

export async function updateCampaignInApi(campaign, apiBaseUrl) {
  if (!campaign?.id) {
    throw new Error("campaign_missing_id");
  }

  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/campaigns/${encodeURIComponent(campaign.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(campaign),
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.campaign) {
    throw new Error(data?.error || "campaign_update_failed");
  }

  return data.campaign;
}

export async function deleteCampaignInApi(campaignId, apiBaseUrl) {
  if (!campaignId) {
    throw new Error("campaign_missing_id");
  }

  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/campaigns/${encodeURIComponent(campaignId)}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "campaign_delete_failed");
  }

  return true;
}
