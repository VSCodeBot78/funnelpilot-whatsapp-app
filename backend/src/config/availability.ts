import type { AvailabilityDayKey, AvailabilitySlot } from "../types/availability.types.js";

export const SLOT_DURATION_MINUTES = 45;
export const SLOT_BUFFER_MINUTES = 15;

export const DAY_LABEL_TO_KEY: Record<string, AvailabilityDayKey> = {
  montag: "monday",
  dienstag: "tuesday",
  mittwoch: "wednesday",
  donnerstag: "thursday",
  freitag: "friday",
  samstag: "saturday",
};

export const DAY_KEY_TO_LABEL: Record<AvailabilityDayKey, string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
};

export const DAY_ORDER: AvailabilityDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const STATIC_AVAILABILITY: Record<AvailabilityDayKey, string[]> = {
  monday: ["19:00", "20:00"],
  tuesday: ["19:00", "20:00"],
  wednesday: ["19:00", "20:00"],
  thursday: ["19:00", "20:00"],
  friday: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
  saturday: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
};

export const DEFAULT_AVAILABILITY_SOURCE_MODE = "static";

export function cloneStaticAvailability(): Record<AvailabilityDayKey, string[]> {
  return {
    monday: [...STATIC_AVAILABILITY.monday],
    tuesday: [...STATIC_AVAILABILITY.tuesday],
    wednesday: [...STATIC_AVAILABILITY.wednesday],
    thursday: [...STATIC_AVAILABILITY.thursday],
    friday: [...STATIC_AVAILABILITY.friday],
    saturday: [...STATIC_AVAILABILITY.saturday],
  };
}

export function buildSlotsFromAvailabilityMap(
  map: Record<AvailabilityDayKey, string[]>,
): AvailabilitySlot[] {
  const result: AvailabilitySlot[] = [];

  for (const day of DAY_ORDER) {
    const times = map[day] ?? [];
    for (const time of times) {
      result.push({ day, time });
    }
  }

  return result;
}

export function getAllStaticSlots(): AvailabilitySlot[] {
  return buildSlotsFromAvailabilityMap(STATIC_AVAILABILITY);
}

export function getStaticSlotsByDay(day: AvailabilityDayKey): AvailabilitySlot[] {
  return (STATIC_AVAILABILITY[day] ?? []).map((time) => ({
    day,
    time,
  }));
}
