import {
  DAY_ORDER,
  STATIC_AVAILABILITY,
} from "../config/availability.js";
import { DEFAULT_CAMPAIGN_ID } from "../config/campaigns.js";
import { getAvailabilityConfig } from "../data/availability-config.store.js";
import { getCalendlyAvailableSlots } from "./calendly-availability.service.js";
import type {
  AvailabilityDayKey,
  AvailabilitySlot,
} from "../types/availability.types.js";

export type AvailabilitySourceMode = "static" | "dashboard" | "calendar";

export type AvailabilitySourceResult = {
  mode: AvailabilitySourceMode;
  slots: AvailabilitySlot[];
};

function uniqueSortedTimes(times: string[]): string[] {
  return [...new Set(times)]
    .filter((value) => /^\d{2}:\d{2}$/.test(value))
    .sort((a, b) => a.localeCompare(b));
}

function buildSlotsFromWeeklyMap(
  weeklySlots: Partial<Record<AvailabilityDayKey, string[]>>,
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];

  for (const day of DAY_ORDER) {
    const times = uniqueSortedTimes(weeklySlots[day] ?? []);
    for (const time of times) {
      slots.push({ day, time });
    }
  }

  return slots;
}

function buildStaticSlots(): AvailabilitySlot[] {
  return buildSlotsFromWeeklyMap(STATIC_AVAILABILITY);
}

function buildDashboardSlots(): AvailabilitySlot[] {
  const config = getAvailabilityConfig();
  return buildSlotsFromWeeklyMap(config.weeklySlots);
}

/**
 * Aktuelle Logik:
 * - static    => feste config/availability.js Slots
 * - dashboard => Slots aus availability-config.store
 * - calendar  => live Calendly-Slots, bei Fehler/Fallback Dashboard-Slots
 */
export async function getAvailabilitySource(params?: {
  campaignId?: string;
}): Promise<AvailabilitySourceResult> {
  const config = getAvailabilityConfig();
  const campaignId = params?.campaignId ?? DEFAULT_CAMPAIGN_ID;

  if (config.sourceMode === "dashboard") {
    return {
      mode: "dashboard",
      slots: buildDashboardSlots(),
    };
  }

  if (config.sourceMode === "calendar") {
    try {
      const calendlySlots = await getCalendlyAvailableSlots({
        campaignId,
        daysAhead: 7,
      });

      if (calendlySlots.length > 0) {
        return {
          mode: "calendar",
          slots: calendlySlots,
        };
      }
    } catch (error) {
      console.error("calendar availability fallback to dashboard:", error);
    }

    return {
      mode: "calendar",
      slots: buildDashboardSlots(),
    };
  }

  return {
    mode: "static",
    slots: buildStaticSlots(),
  };
}

export async function getAvailableSlots(params?: {
  campaignId?: string;
}): Promise<AvailabilitySlot[]> {
  const result = await getAvailabilitySource(params);
  return result.slots;
}

export async function getAvailableSlotsByDay(
  day: AvailabilityDayKey,
  params?: {
    campaignId?: string;
  },
): Promise<AvailabilitySlot[]> {
  const slots = await getAvailableSlots(params);
  return slots.filter((slot) => slot.day === day);
}
