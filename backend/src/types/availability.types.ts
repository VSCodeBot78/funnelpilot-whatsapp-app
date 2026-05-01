export type AvailabilityDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type AvailabilitySlot = {
  day: AvailabilityDayKey;
  time: string;
};

export type AvailabilityCheckResult = {
  requestedDayLabel?: string;
  requestedTimeText?: string;
  isBookable: boolean;
  matchedSlot?: AvailabilitySlot;
  suggestions: AvailabilitySlot[];
  reason?: string;
};
