import type {
  GhostingMessageSlot,
  GhostingSchedulePreview,
} from "../types/ghosting.types.js";

export const GHOSTING_CYCLE_1_SLOTS: GhostingMessageSlot[] = [
  {
    cycle: 1,
    stage: "cycle1_day1_0700",
    dayOffsetHours: 24,
    sendHour: 7,
    sendMinute: 0,
  },
  {
    cycle: 1,
    stage: "cycle1_day1_1400",
    dayOffsetHours: 24,
    sendHour: 14,
    sendMinute: 0,
  },
  {
    cycle: 1,
    stage: "cycle1_day1_2100",
    dayOffsetHours: 24,
    sendHour: 21,
    sendMinute: 0,
  },
  {
    cycle: 2,
    stage: "cycle2_day2_0900",
    dayOffsetHours: 48,
    sendHour: 9,
    sendMinute: 0,
  },
  {
    cycle: 2,
    stage: "cycle2_day2_1800",
    dayOffsetHours: 48,
    sendHour: 18,
    sendMinute: 0,
  },
  {
    cycle: 3,
    stage: "cycle3_day3_1700",
    dayOffsetHours: 72,
    sendHour: 17,
    sendMinute: 0,
  },
];

export const GHOSTING_CYCLE_2_SLOTS: GhostingMessageSlot[] = [
  {
    cycle: 2,
    stage: "cycle2_day2_0900",
    dayOffsetHours: 48,
    sendHour: 9,
    sendMinute: 0,
  },
  {
    cycle: 2,
    stage: "cycle2_day2_1800",
    dayOffsetHours: 48,
    sendHour: 18,
    sendMinute: 0,
  },
];

export const GHOSTING_SCHEDULES: GhostingSchedulePreview[] = [
  {
    cycle: 1,
    slots: GHOSTING_CYCLE_1_SLOTS,
  },
  {
    cycle: 2,
    slots: GHOSTING_CYCLE_2_SLOTS,
  },
];
