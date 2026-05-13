import { buildApiUrl } from "./apiBase";

export async function getBookingEvents(apiBaseUrl) {
  const response = await fetch(buildApiUrl("/booking-events", apiBaseUrl), {
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
