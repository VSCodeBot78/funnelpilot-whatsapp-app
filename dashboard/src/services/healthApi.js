import { buildApiUrl } from "./apiBase";

export async function checkBackendHealth(apiBaseUrl) {
  const response = await fetch(buildApiUrl("/health", apiBaseUrl), {
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
