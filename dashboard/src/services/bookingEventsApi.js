const FALLBACK_API_BASE_URL = "http://localhost:3001";

function getApiBaseUrl(apiBaseUrl) {
  return apiBaseUrl || FALLBACK_API_BASE_URL;
}

export async function getBookingEvents(apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/booking-events`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`booking_events_fetch_failed:${response.status}`);
  }

  const data = await response.json();

  if (!data?.ok) {
    throw new Error(data?.error || "booking_events_fetch_failed");
  }

  return data;
}
