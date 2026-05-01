import { DEFAULT_CAMPAIGN_ID } from "../config/campaigns.js";
import { getProviderConfig } from "../config/scheduling-providers.js";
import type {
  AvailabilityDayKey,
  AvailabilitySlot,
} from "../types/availability.types.js";

type CalendlyMeResponse = {
  resource: {
    uri: string;
    current_organization?: string;
  };
};

type CalendlyEventType = {
  uri: string;
  slug?: string;
  scheduling_url?: string;
  active?: boolean;
};

type CalendlyEventTypesResponse = {
  collection: CalendlyEventType[];
};

type CalendlyAvailableTime = {
  start_time: string;
  status?: string;
};

type CalendlyAvailableTimesResponse = {
  collection: CalendlyAvailableTime[];
};

const CALENDLY_API_BASE = "https://api.calendly.com";
const CALENDLY_TIMEZONE = "Europe/Berlin";

function getCalendlyPat(): string | null {
  const token = process.env.CALENDLY_PAT?.trim();
  return token ? token : null;
}

function normalizeUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return rawUrl.replace(/\/+$/, "");
  }
}

function extractSlugFromUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1)?.toLowerCase();
  } catch {
    return undefined;
  }
}

async function calendlyGet<T>(path: string): Promise<T> {
  const token = getCalendlyPat();

  if (!token) {
    throw new Error("CALENDLY_PAT fehlt.");
  }

  const response = await fetch(`${CALENDLY_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Calendly API Fehler (${response.status}): ${body || "unbekannt"}`,
    );
  }

  return (await response.json()) as T;
}

function mapWeekdayToAvailabilityKey(
  weekday: string,
): AvailabilityDayKey | null {
  switch (weekday.toLowerCase()) {
    case "monday":
      return "monday";
    case "tuesday":
      return "tuesday";
    case "wednesday":
      return "wednesday";
    case "thursday":
      return "thursday";
    case "friday":
      return "friday";
    case "saturday":
      return "saturday";
    default:
      return null;
  }
}

function isoToAvailabilitySlot(iso: string): AvailabilitySlot | null {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: CALENDLY_TIMEZONE,
  }).format(date);

  const mappedDay = mapWeekdayToAvailabilityKey(weekday);
  if (!mappedDay) {
    return null;
  }

  const time = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: CALENDLY_TIMEZONE,
  }).format(date);

  return {
    day: mappedDay,
    time,
  };
}

function uniqueSortedSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const uniqueMap = new Map<string, AvailabilitySlot>();

  for (const slot of slots) {
    uniqueMap.set(`${slot.day}-${slot.time}`, slot);
  }

  return [...uniqueMap.values()].sort((a, b) => {
    if (a.day !== b.day) {
      const dayOrder: AvailabilityDayKey[] = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];

      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    }

    return a.time.localeCompare(b.time);
  });
}

async function resolveCalendlyEventTypeUri(
  campaignId: string,
): Promise<string | null> {
  const providerConfig = getProviderConfig(campaignId, "calendly");

  if (providerConfig.provider !== "calendly") {
    return null;
  }

  const bookingUrl = normalizeUrl(providerConfig.bookingUrl);
  const bookingSlug = extractSlugFromUrl(providerConfig.bookingUrl);

  const me = await calendlyGet<CalendlyMeResponse>("/users/me");
  const encodedUserUri = encodeURIComponent(me.resource.uri);

  const eventTypes = await calendlyGet<CalendlyEventTypesResponse>(
    `/event_types?user=${encodedUserUri}&count=100&active=true`,
  );

  const directMatch = eventTypes.collection.find(
    (eventType) =>
      normalizeUrl(eventType.scheduling_url) === bookingUrl,
  );

  if (directMatch?.uri) {
    return directMatch.uri;
  }

  const slugMatch = eventTypes.collection.find(
    (eventType) =>
      bookingSlug &&
      eventType.slug &&
      eventType.slug.toLowerCase() === bookingSlug,
  );

  return slugMatch?.uri ?? null;
}

export async function getCalendlyAvailableSlots(params?: {
  campaignId?: string;
  daysAhead?: number;
}): Promise<AvailabilitySlot[]> {
  const campaignId = params?.campaignId ?? DEFAULT_CAMPAIGN_ID;
  const daysAhead = Math.min(Math.max(params?.daysAhead ?? 7, 1), 7);

  const eventTypeUri = await resolveCalendlyEventTypeUri(campaignId);
  if (!eventTypeUri) {
    return [];
  }

  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60 * 1000);
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const encodedEventType = encodeURIComponent(eventTypeUri);
  const encodedStart = encodeURIComponent(start.toISOString());
  const encodedEnd = encodeURIComponent(end.toISOString());

  const availability = await calendlyGet<CalendlyAvailableTimesResponse>(
    `/event_type_available_times?event_type=${encodedEventType}&start_time=${encodedStart}&end_time=${encodedEnd}`,
  );

  const mappedSlots = availability.collection
    .map((entry) => isoToAvailabilitySlot(entry.start_time))
    .filter((slot): slot is AvailabilitySlot => Boolean(slot));

  return uniqueSortedSlots(mappedSlots);
}
