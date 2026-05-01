const FALLBACK_API_BASE_URL = "http://localhost:3001";

function getApiBaseUrl(apiBaseUrl) {
  return apiBaseUrl || FALLBACK_API_BASE_URL;
}

export async function checkBackendHealth(apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/health`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`health_check_failed:${response.status}`);
  }

  const data = await response.json();

  if (!data?.ok || data?.status !== "healthy") {
    throw new Error(data?.error || "backend_unhealthy");
  }

  return data;
}
