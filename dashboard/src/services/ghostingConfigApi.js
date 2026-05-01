const FALLBACK_API_BASE_URL = "http://localhost:3001";

function getApiBaseUrl(apiBaseUrl) {
  return apiBaseUrl || FALLBACK_API_BASE_URL;
}

function normalizeGhostingConfig(config) {
  return {
    schedules: Array.isArray(config?.schedules) ? config.schedules : [],
    messages:
      config?.messages && typeof config.messages === "object"
        ? config.messages
        : {},
  };
}

export async function loadGhostingConfigFromApi(apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/ghosting-config`);
  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.config) {
    throw new Error(data?.error || "ghosting_config_load_failed");
  }

  return normalizeGhostingConfig(data.config);
}

export async function saveGhostingConfigToApi({ apiBaseUrl, config }) {
  const safeConfig = normalizeGhostingConfig(config);

  const schedulesResponse = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/ghosting-config/schedules`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedules: safeConfig.schedules,
      }),
    },
  );

  const schedulesData = await schedulesResponse.json();

  if (!schedulesResponse.ok || !schedulesData?.ok) {
    throw new Error(schedulesData?.error || "ghosting_schedules_save_failed");
  }

  const messagesResponse = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/ghosting-config/messages`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: safeConfig.messages,
      }),
    },
  );

  const messagesData = await messagesResponse.json();

  if (!messagesResponse.ok || !messagesData?.ok) {
    throw new Error(messagesData?.error || "ghosting_messages_save_failed");
  }

  return normalizeGhostingConfig(
    messagesData.config || schedulesData.config || safeConfig,
  );
}

export async function resetGhostingConfigInApi(apiBaseUrl) {
  const response = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/ghosting-config/reset`,
    {
      method: "POST",
    },
  );

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.config) {
    throw new Error(data?.error || "ghosting_config_reset_failed");
  }

  return normalizeGhostingConfig(data.config);
}
