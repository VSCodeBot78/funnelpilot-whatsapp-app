export type GhostingCycle = 0 | 1 | 2 | 3;

export type GhostingStage =
  | "inactive"
  | "cycle1_day1_0700"
  | "cycle1_day1_1400"
  | "cycle1_day1_2100"
  | "cycle2_day2_0900"
  | "cycle2_day2_1800"
  | "cycle3_day3_1700"
  | "dead";

export type GhostingMessageSlot = {
  cycle: GhostingCycle;
  stage: GhostingStage;
  dayOffsetHours: 24 | 48 | 72;
  sendHour: number;
  sendMinute: number;
};

export type GhostingSentEntry = {
  stage: GhostingStage;
  sentAt: string;
};

export type GhostingState = {
  active: boolean;
  cycle: GhostingCycle;
  stage: GhostingStage;
  startedAt?: string;
  nextDueAt?: string;
  stoppedAt?: string;
  stoppedReason?: "lead_replied" | "manual_stop";
  completedAt?: string;
  isDead: boolean;
  lastSentStage?: GhostingStage;
  sentHistory?: GhostingSentEntry[];
};

export type GhostingEvaluationResult = {
  shouldActivate: boolean;
  active: boolean;
  cycle: GhostingCycle;
  stage: GhostingStage;
  nextDueAt?: string;
  dueNow: boolean;
  isDead: boolean;
  reason?: string;
};

export type GhostingSchedulePreview = {
  cycle: GhostingCycle;
  slots: GhostingMessageSlot[];
};
