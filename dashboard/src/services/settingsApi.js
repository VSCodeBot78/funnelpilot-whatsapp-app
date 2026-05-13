import { buildApiUrl } from "./apiBase";

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
