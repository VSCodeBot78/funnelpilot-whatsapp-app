export function getApiBaseUrl(apiBaseUrl) {
  const configured =
    String(apiBaseUrl || import.meta.env.VITE_API_BASE_URL || "").trim();

  return configured.replace(/\/+$/, "");
}

export function buildApiUrl(path, apiBaseUrl) {
  const cleanPath = String(path || "");
  const normalizedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  const baseUrl = getApiBaseUrl(apiBaseUrl);

  return `${baseUrl}${normalizedPath}`;
}
