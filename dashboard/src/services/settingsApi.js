const FALLBACK_API_BASE_URL = "http://localhost:3001";

function getApiBaseUrl(apiBaseUrl) {
  return apiBaseUrl || FALLBACK_API_BASE_URL;
}

export async function loadSettingsConfig(apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/settings-config`);
  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.settings) {
    throw new Error(data?.error || "settings_config_load_failed");
  }

  return data.settings;
}

export async function saveSettings(settings) {
  const response = await fetch(`${getApiBaseUrl(settings.apiBaseUrl)}/settings-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.settings) {
    throw new Error(data?.error || "settings_save_failed");
  }

  return data.settings;
}

export async function resetSettings(apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/settings-config/reset`, {
    method: "POST",
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.settings) {
    throw new Error(data?.error || "settings_reset_failed");
  }

  return data.settings;
}
