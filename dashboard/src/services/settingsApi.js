import { buildApiUrl } from "./apiBase.js";

export async function loadSettingsConfig(apiBaseUrl) {
  const response = await fetch(buildApiUrl("/settings-config", apiBaseUrl));
  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.settings) {
    throw new Error(data?.error || "settings_config_load_failed");
  }

  return {
    ...data.settings,
    openAiApiKeyConfigured: Boolean(data.openAiApiKeyConfigured),
    openAiModelConfigured: Boolean(data.openAiModelConfigured),
  };
}

export async function saveSettings(settings) {
  const {
    openAiApiKeyConfigured,
    openAiModelConfigured,
    aiBotSettingsConfigured,
    ...persistableSettings
  } = settings || {};

  const response = await fetch(buildApiUrl("/settings-config", persistableSettings.apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(persistableSettings),
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.settings) {
    throw new Error(data?.error || "settings_save_failed");
  }

  return {
    ...data.settings,
    openAiApiKeyConfigured: Boolean(data.openAiApiKeyConfigured),
    openAiModelConfigured: Boolean(data.openAiModelConfigured),
  };
}

// Save ONLY the review draft. Never transmit unsaved live Pete, campaigns,
// booking URLs, channel settings or other fields from the wizard form.
export async function saveCoachDraftOnly(draft, apiBaseUrl) {
  const response = await fetch(buildApiUrl("/settings-config", apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coachOnboardingDraft: draft }),
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !data?.settings?.coachOnboardingDraft) {
    throw new Error(data?.error || "coach_draft_save_failed");
  }
  return data.settings.coachOnboardingDraft;
}

export async function resetSettings(apiBaseUrl) {
  const response = await fetch(buildApiUrl("/settings-config/reset", apiBaseUrl), {
    method: "POST",
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.settings) {
    throw new Error(data?.error || "settings_reset_failed");
  }

  return {
    ...data.settings,
    openAiApiKeyConfigured: Boolean(data.openAiApiKeyConfigured),
    openAiModelConfigured: Boolean(data.openAiModelConfigured),
  };
}
