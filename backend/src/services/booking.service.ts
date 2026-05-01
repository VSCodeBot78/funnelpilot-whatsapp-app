import type { BookingPreference } from "../types/types.js";

export type BookingSlot = {
  day: string;
  time: string;
  label: string;
  preference: BookingPreference;
};

const BOOKING_SLOTS: BookingSlot[] = [
  {
    day: "Montag",
    time: "10:00",
    label: "Montag um 10:00",
    preference: "vormittags",
  },
  {
    day: "Montag",
    time: "15:30",
    label: "Montag um 15:30",
    preference: "nachmittags",
  },
  {
    day: "Dienstag",
    time: "11:00",
    label: "Dienstag um 11:00",
    preference: "vormittags",
  },
  {
    day: "Dienstag",
    time: "16:00",
    label: "Dienstag um 16:00",
    preference: "nachmittags",
  },
  {
    day: "Mittwoch",
    time: "09:30",
    label: "Mittwoch um 09:30",
    preference: "vormittags",
  },
  {
    day: "Mittwoch",
    time: "15:00",
    label: "Mittwoch um 15:00",
    preference: "nachmittags",
  },
];

export function getAvailableBookingSlots(): BookingSlot[] {
  return [...BOOKING_SLOTS];
}

export function findBestBookingSlot(
  preference: BookingPreference,
): BookingSlot | null {
  if (preference === "unknown") {
    return BOOKING_SLOTS[0] ?? null;
  }

  const matched = BOOKING_SLOTS.find((slot) => slot.preference === preference);
  return matched ?? BOOKING_SLOTS[0] ?? null;
}
