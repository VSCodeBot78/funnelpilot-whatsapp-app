import {
  DEFAULT_AVAILABILITY_SOURCE_MODE,
  STATIC_AVAILABILITY,
  cloneStaticAvailability,
} from "../config/availability.js";
import type { AvailabilityDayKey } from "../types/availability.types.js";
import type { AvailabilitySourceMode } from "../services/availability-source.service.js";

export type AvailabilityConfig = {
  sourceMode: AvailabilitySourceMode;
  maxSuggestions: number;
  weeklySlots: Record<AvailabilityDayKey, string[]>;
  updatedAt: string | null;
};

const availabilityConfig: AvailabilityConfig = {
  sourceMode: DEFAULT_AVAILABILITY_SOURCE_MODE as AvailabilitySourceMode,
  maxSuggestions: 3,
  weeklySlots: cloneStaticAvailability(),
  updatedAt: null,
};

function uniqueSortedTimes(times: string[]): string[] {
  return [...new Set(times)]
    .filter((value) => /^\d{2}:\d{2}$/.test(value))
    .sort((a, b) => a.localeCompare(b));
}

function normalizeWeeklySlots(
  weeklySlots?: Partial<Record<AvailabilityDayKey, string[]>>,
): Record<AvailabilityDayKey, string[]> {
  return {
    monday: uniqueSortedTimes(weeklySlots?.monday ?? availabilityConfig.weeklySlots.monday ?? STATIC_AVAILABILITY.monday),
    tuesday: uniqueSortedTimes(weeklySlots?.tuesday ?? availabilityConfig.weeklySlots.tuesday ?? STATIC_AVAILABILITY.tuesday),
    wednesday: uniqueSortedTimes(weeklySlots?.wednesday ?? availabilityConfig.weeklySlots.wednesday ?? STATIC_AVAILABILITY.wednesday),
    thursday: uniqueSortedTimes(weeklySlots?.thursday ?? availabilityConfig.weeklySlots.thursday ?? STATIC_AVAILABILITY.thursday),
    friday: uniqueSortedTimes(weeklySlots?.friday ?? availabilityConfig.weeklySlots.friday ?? STATIC_AVAILABILITY.friday),
    saturday: uniqueSortedTimes(weeklySlots?.saturday ?? availabilityConfig.weeklySlots.saturday ?? STATIC_AVAILABILITY.saturday),
  };
}

export function getAvailabilityConfig(): AvailabilityConfig {
  return {
    sourceMode: availabilityConfig.sourceMode,
    maxSuggestions: availabilityConfig.maxSuggestions,
    weeklySlots: {
      monday: [...availabilityConfig.weeklySlots.monday],
      tuesday: [...availabilityConfig.weeklySlots.tuesday],
      wednesday: [...availabilityConfig.weeklySlots.wednesday],
      thursday: [...availabilityConfig.weeklySlots.thursday],
      friday: [...availabilityConfig.weeklySlots.friday],
      saturday: [...availabilityConfig.weeklySlots.saturday],
    },
    updatedAt: availabilityConfig.updatedAt,
  };
}

export function updateAvailabilityConfig(input: {
  sourceMode?: AvailabilitySourceMode;
  maxSuggestions?: number;
  weeklySlots?: Partial<Record<AvailabilityDayKey, string[]>>;
}): AvailabilityConfig {
  if (input.sourceMode) {
    availabilityConfig.sourceMode = input.sourceMode;
  }

  if (typeof input.maxSuggestions === "number" && Number.isFinite(input.maxSuggestions)) {
    availabilityConfig.maxSuggestions = Math.max(1, Math.min(10, Math.floor(input.maxSuggestions)));
  }

  if (input.weeklySlots) {
    availabilityConfig.weeklySlots = normalizeWeeklySlots(input.weeklySlots);
  }

  availabilityConfig.updatedAt = new Date().toISOString();
  return getAvailabilityConfig();
}

export function resetAvailabilityConfig(): AvailabilityConfig {
  availabilityConfig.sourceMode = DEFAULT_AVAILABILITY_SOURCE_MODE as AvailabilitySourceMode;
  availabilityConfig.maxSuggestions = 3;
  availabilityConfig.weeklySlots = cloneStaticAvailability();
  availabilityConfig.updatedAt = new Date().toISOString();

  return getAvailabilityConfig();
}
