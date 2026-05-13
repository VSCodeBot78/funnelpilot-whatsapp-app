import {
  mapAvailabilityConfigToForm,
  parseWeeklySlotsTextMap,
} from "../utils/dashboardHelpers";
import { buildApiUrl } from "./apiBase";

function buildAvailabilityPayload(form) {
  return {
    sourceMode: form.sourceMode,
    maxSuggestions: Number(form.maxSuggestions || 3),
    weeklySlots: parseWeeklySlotsTextMap(form.weeklySlotsText),
  };
}

export async function loadAvailabilityConfigFromApi(apiBaseUrl) {
  const response = await fetch(buildApiUrl("/availability-config", apiBaseUrl));
  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.config) {
    throw new Error(data?.error || "availability_config_load_failed");
  }

  return mapAvailabilityConfigToForm(data.config);
}

export async function saveAvailabilityConfigToApi({ apiBaseUrl, form }) {
  const payload = buildAvailabilityPayload(form);

  const response = await fetch(buildApiUrl("/availability-config", apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.config) {
    throw new Error(data?.error || "availability_config_save_failed");
  }

  return mapAvailabilityConfigToForm(data.config);
}

export async function resetAvailabilityConfigInApi(apiBaseUrl) {
  const response = await fetch(
    buildApiUrl("/availability-config/reset", apiBaseUrl),
    {
      method: "POST",
    },
  );

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.config) {
    throw new Error(data?.error || "availability_config_reset_failed");
  }

  return mapAvailabilityConfigToForm(data.config);
}
