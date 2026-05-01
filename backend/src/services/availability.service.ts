import {
  DAY_KEY_TO_LABEL,
  DAY_LABEL_TO_KEY,
  DAY_ORDER,
} from "../config/availability.js";
import { getAvailabilityConfig } from "../data/availability-config.store.js";
import { getAvailableSlots } from "./availability-source.service.js";
import type {
  AvailabilityCheckResult,
  AvailabilityDayKey,
  AvailabilitySlot,
} from "../types/availability.types.js";

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeTimeText(value: string): string {
  const input = normalizeText(value);

  const fullTimeMatch =
    input.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (fullTimeMatch) {
    const hour = String(fullTimeMatch[1]).padStart(2, "0");
    const minutes = String(fullTimeMatch[2]).padStart(2, "0");
    return `${hour}:${minutes}`;
  }

  const withUhrMatch = input.match(/\b([01]?\d|2[0-3])\s*uhr\b/);
  if (withUhrMatch) {
    const hour = String(withUhrMatch[1]).padStart(2, "0");
    return `${hour}:00`;
  }

  const looseHourMatch = input.match(/\b([01]?\d|2[0-3])\b/);
  if (looseHourMatch) {
    const hour = String(looseHourMatch[1]).padStart(2, "0");
    return `${hour}:00`;
  }

  return input;
}

function parseRequestedDay(dayLabel?: string): AvailabilityDayKey | undefined {
  if (!dayLabel) {
    return undefined;
  }

  const normalized = normalizeText(dayLabel);
  return DAY_LABEL_TO_KEY[normalized];
}

function parseRequestedTime(timeText?: string): string | undefined {
  if (!timeText) {
    return undefined;
  }

  const normalized = normalizeTimeText(timeText);
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : undefined;
}

function getDayIndex(day: AvailabilityDayKey): number {
  return DAY_ORDER.indexOf(day);
}

function getPreferenceBucket(
  preference?: "vormittags" | "nachmittags" | "unknown",
): ((time: string) => boolean) | null {
  if (preference === "vormittags") {
    return (time: string) => {
      const hour = Number(time.slice(0, 2));
      return hour < 12;
    };
  }

  if (preference === "nachmittags") {
    return (time: string) => {
      const hour = Number(time.slice(0, 2));
      return hour >= 12;
    };
  }

  return null;
}

function sortSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  return [...slots].sort((a, b) => {
    const dayDiff = getDayIndex(a.day) - getDayIndex(b.day);
    if (dayDiff !== 0) {
      return dayDiff;
    }

    return a.time.localeCompare(b.time);
  });
}

function findSlot(
  slots: AvailabilitySlot[],
  day: AvailabilityDayKey,
  time: string,
): AvailabilitySlot | undefined {
  return slots.find((slot) => slot.day === day && slot.time === time);
}

function buildSuggestionsFromSlots(params: {
  slots: AvailabilitySlot[];
  requestedDay?: AvailabilityDayKey;
  limit?: number;
  preference?: "vormittags" | "nachmittags" | "unknown";
}): AvailabilitySlot[] {
  const { slots, requestedDay, preference } = params;
  const limit = params.limit ?? 3;

  const bucketFilter = getPreferenceBucket(preference);
  const sortedSlots = sortSlots(slots);

  const filteredByRange = requestedDay
    ? sortedSlots.filter((slot) => {
        const requestedIndex = getDayIndex(requestedDay);
        const slotIndex = getDayIndex(slot.day);

        if (requestedIndex < 0 || slotIndex < 0) {
          return false;
        }

        return slotIndex >= requestedIndex && slotIndex <= requestedIndex + 3;
      })
    : sortedSlots;

  const preferredSlots = bucketFilter
    ? filteredByRange.filter((slot) => bucketFilter(slot.time))
    : filteredByRange;

  const remainingSlots = bucketFilter
    ? filteredByRange.filter((slot) => !bucketFilter(slot.time))
    : [];

  const combined = bucketFilter
    ? [...preferredSlots, ...remainingSlots]
    : filteredByRange;

  return combined.slice(0, limit);
}

export function formatAvailabilitySlot(slot: AvailabilitySlot): string {
  return `${DAY_KEY_TO_LABEL[slot.day]} um ${slot.time}`;
}

/**
 * Rückwärtskompatibler Name:
 * Die bestehende Engine ruft weiterhin checkStaticAvailability(...)
 * auf.
 * Intern läuft das jetzt über die aktive Slot-Quelle:
 * static / dashboard / calendar
 */
export async function checkStaticAvailability(params: {
  requestedDayLabel?: string;
  requestedTimeText?: string;
  requestedPreference?: "vormittags" | "nachmittags" | "unknown";
  campaignId?: string;
}): Promise<AvailabilityCheckResult> {
  const requestedDay = parseRequestedDay(params.requestedDayLabel);
  const requestedTime = parseRequestedTime(params.requestedTimeText);
  const config = getAvailabilityConfig();

  const availableSlots = await getAvailableSlots({
    campaignId: params.campaignId,
  });

  const suggestionLimit = config.maxSuggestions ?? 3;

  if (!requestedDay && !requestedTime) {
    return {
      requestedDayLabel: params.requestedDayLabel,
      requestedTimeText: params.requestedTimeText,
      isBookable: false,
      suggestions: buildSuggestionsFromSlots({
        slots: availableSlots,
        requestedDay: undefined,
        limit: suggestionLimit,
        preference: params.requestedPreference,
      }),
      reason: "Kein auswertbarer Tag oder keine auswertbare Uhrzeit erkannt.",
    };
  }

  if (!requestedDay) {
    return {
      requestedDayLabel: params.requestedDayLabel,
      requestedTimeText: params.requestedTimeText,
      isBookable: false,
      suggestions: buildSuggestionsFromSlots({
        slots: availableSlots,
        requestedDay: undefined,
        limit: suggestionLimit,
        preference: params.requestedPreference,
      }),
      reason: "Kein buchbarer Wochentag erkannt.",
    };
  }

  if (!requestedTime) {
    return {
      requestedDayLabel: params.requestedDayLabel,
      requestedTimeText: params.requestedTimeText,
      isBookable: false,
      suggestions: buildSuggestionsFromSlots({
        slots: availableSlots,
        requestedDay,
        limit: suggestionLimit,
        preference: params.requestedPreference,
      }),
      reason: "Keine auswertbare Uhrzeit erkannt.",
    };
  }

  const matchedSlot = findSlot(availableSlots, requestedDay, requestedTime);

  if (matchedSlot) {
    return {
      requestedDayLabel: params.requestedDayLabel,
      requestedTimeText: params.requestedTimeText,
      isBookable: true,
      matchedSlot,
      suggestions: [],
    };
  }

  return {
    requestedDayLabel: params.requestedDayLabel,
    requestedTimeText: params.requestedTimeText,
    isBookable: false,
    suggestions: buildSuggestionsFromSlots({
      slots: availableSlots,
      requestedDay,
      limit: suggestionLimit,
      preference: params.requestedPreference,
    }),
    reason: "Der angefragte Termin liegt außerhalb deiner Verfügbarkeit.",
  };
}
