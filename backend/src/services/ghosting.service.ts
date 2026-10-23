import type { ConversationState } from "../types/types.js";
import type {
  GhostingCycle,
  GhostingEvaluationResult,
  GhostingMessageSlot,
  GhostingSchedulePreview,
  GhostingStage,
  GhostingState,
} from "../types/ghosting.types.js";
import { getGhostingConfig } from "../data/ghosting-config.store.js";

function parseIso(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function setTime(date: Date, hour: number, minute: number): Date {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function toIso(date: Date): string {
  return date.toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function getReferenceOutboundAt(state: ConversationState): Date | null {
  return parseIso(state.lastAssistantMessageAt) ?? parseIso(state.updatedAt);
}

function getReferenceInboundAt(state: ConversationState): Date | null {
  return parseIso(state.lastUserMessageAt);
}

// Ordinary automated Instagram/WhatsApp follow-ups require a fresh inbound
// message. This is a fail-closed local guard, not a provider permission check.
const AUTOMATED_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

function slotDueAt(outboundAt: Date, slot: GhostingMessageSlot): Date {
  // The default gentle reminder is relative to the last outbound. Legacy
  // custom clock-time slots remain readable but never override the 24h guard.
  if (slot.stage === "cycle1_within24h_6h") return addHours(outboundAt, slot.dayOffsetHours);
  return setTime(addHours(outboundAt, slot.dayOffsetHours), slot.sendHour, slot.sendMinute);
}

function getSlotsForCycle(cycle: GhostingCycle): GhostingMessageSlot[] {
  const schedules = getGhostingConfig().schedules;
  const match = schedules.find((entry) => entry.cycle === cycle);
  return (match?.slots ?? []) as GhostingMessageSlot[];
}

function hasLeadRepliedAfterOutbound(state: ConversationState): boolean {
  // No inbound timestamp, no automated proactive sale. 24h is measured from
  // the last USER message, not the last bot message or first campaign trigger.
  const inboundAt = getReferenceInboundAt(state);
  if (!inboundAt || inboundAt.getTime() > now.getTime()) {
    return buildInactiveResult("Kein gültiger letzter Kundeneingang: Nachfassen gesperrt.");
  }
  if (now.getTime() >= inboundAt.getTime() + AUTOMATED_REPLY_WINDOW_MS) {
    return buildInactiveResult("24-Stunden-Nachrichtenfenster abgelaufen: normales automatisches Nachfassen gesperrt.");
  }

  const outboundAt = getReferenceOutboundAt(state);
  const inboundAt = getReferenceInboundAt(state);

  if (!outboundAt || !inboundAt) {
    return false;
  }

  return inboundAt.getTime() > outboundAt.getTime();
}

function wasStageAlreadySent(
  ghosting: GhostingState | undefined,
  stage: GhostingStage,
): boolean {
  if (!ghosting?.sentHistory || ghosting.sentHistory.length === 0) {
    return false;
  }

  return ghosting.sentHistory.some((entry) => entry.stage === stage);
}

function getNextDueSlot(params: {
  now: Date;
  outboundAt: Date;
  cycle: GhostingCycle;
  ghosting?: GhostingState;
}): GhostingMessageSlot | null {
  const slots = getSlotsForCycle(params.cycle);

  for (const slot of slots) {
    if (wasStageAlreadySent(params.ghosting, slot.stage)) {
      continue;
    }

    const dueDate = slotDueAt(params.outboundAt, slot);

    if (params.now.getTime() < dueDate.getTime()) {
      return slot;
    }
  }

  return null;
}

function getCurrentDueSlot(params: {
  now: Date;
  outboundAt: Date;
  cycle: GhostingCycle;
  ghosting?: GhostingState;
}): GhostingMessageSlot | null {
  const slots = getSlotsForCycle(params.cycle);
  let latestDue: GhostingMessageSlot | null = null;

  for (const slot of slots) {
    if (wasStageAlreadySent(params.ghosting, slot.stage)) {
      continue;
    }

    const dueDate = slotDueAt(params.outboundAt, slot);

    if (params.now.getTime() >= dueDate.getTime()) {
      latestDue = slot;
    }
  }

  return latestDue;
}

function buildInactiveResult(reason: string): GhostingEvaluationResult {
  return {
    shouldActivate: false,
    active: false,
    cycle: 0,
    stage: "inactive",
    dueNow: false,
    isDead: false,
    reason,
  };
}

function resolveEvaluationCycle(
  currentGhosting: GhostingState | undefined,
): GhostingCycle {
  if (!currentGhosting) {
    return 1;
  }

  if (currentGhosting.active && currentGhosting.cycle > 0) {
    return currentGhosting.cycle;
  }

  if (currentGhosting.cycle === 0) {
    return 1;
  }

  if (currentGhosting.cycle === 1) {
    return 2;
  }

  if (currentGhosting.cycle === 2) {
    return 3;
  }

  return 3;
}

export function getGhostingSchedules(): GhostingSchedulePreview[] {
  return getGhostingConfig().schedules as GhostingSchedulePreview[];
}

export function createInitialGhostingState(): GhostingState {
  return {
    active: false,
    cycle: 0,
    stage: "inactive",
    isDead: false,
    sentHistory: [],
  };
}

export function stopGhostingState(
  current: GhostingState | undefined,
  reason: "lead_replied" | "manual_stop",
): GhostingState {
  return {
    ...(current ?? createInitialGhostingState()),
    active: false,
    stage: "inactive",
    nextDueAt: undefined,
    stoppedAt: nowIso(),
    stoppedReason: reason,
  };
}

export function getNextGhostingCycle(
  current: GhostingState | undefined,
): GhostingCycle {
  if (!current || current.cycle === 0) {
    return 1;
  }

  if (current.cycle === 1) {
    return 2;
  }

  if (current.cycle === 2) {
    return 3;
  }

  return 3;
}

export function evaluateGhostingState(
  state: ConversationState,
  currentGhosting: GhostingState | undefined,
  now = new Date(),
): GhostingEvaluationResult {
  if (state.owner === "human" || state.aiPaused === true) {
    return buildInactiveResult("Human Takeover aktiv. Ghosting pausiert.");
  }

  if (state.flags?.stopped) {
    return buildInactiveResult("Automation gestoppt. Ghosting pausiert.");
  }

  if (state.flags?.salesFollowUpsOptedOut) {
    return buildInactiveResult("Lead lehnt Verkaufsnachfassnachrichten ab. Ghosting pausiert.");
  }

  const outboundAt = getReferenceOutboundAt(state);

  if (!outboundAt) {
    return buildInactiveResult("Keine letzte Bot-Nachricht gefunden.");
  }

  if (hasLeadRepliedAfterOutbound(state)) {
    return buildInactiveResult(
      "Lead hat nach der letzten Bot-Nachricht geantwortet.",
    );
  }

  if (currentGhosting?.isDead) {
    return {
      shouldActivate: false,
      active: false,
      cycle: currentGhosting.cycle || 3,
      stage: "dead",
      dueNow: false,
      isDead: true,
      reason: "Lead ist aktuell als tot markiert.",
    };
  }

  const cycle = resolveEvaluationCycle(currentGhosting);

  const currentDueSlot = getCurrentDueSlot({
    now,
    outboundAt,
    cycle,
    ghosting: currentGhosting,
  });

  const nextDueSlot = getNextDueSlot({
    now,
    outboundAt,
    cycle,
    ghosting: currentGhosting,
  });

  if (currentDueSlot) {
    const dueDate = slotDueAt(outboundAt, currentDueSlot);

    return {
      shouldActivate: true,
      active: true,
      cycle,
      stage: currentDueSlot.stage,
      nextDueAt: toIso(dueDate),
      dueNow: true,
      isDead: false,
    };
  }

  if (nextDueSlot) {
    const dueDate = slotDueAt(outboundAt, nextDueSlot);

    return {
      shouldActivate: true,
      active: true,
      cycle,
      stage: nextDueSlot.stage,
      nextDueAt: toIso(dueDate),
      dueNow: false,
      isDead: false,
    };
  }

  if (cycle === 3) {
    return {
      shouldActivate: false,
      active: false,
      cycle: 3,
      stage: "dead",
      dueNow: false,
      isDead: true,
      reason: "Dritter Ghosting-Zyklus abgeschlossen, Lead ist aktuell tot.",
    };
  }

  return buildInactiveResult("Noch keine Ghosting-Stufe fällig.");
}

export function markGhostingStageAsSent(
  ghosting: GhostingState,
  stage: GhostingStage,
  sentAt = nowIso(),
): GhostingState {
  const history = ghosting.sentHistory ?? [];

  if (history.some((entry) => entry.stage === stage)) {
    return ghosting;
  }

  return {
    ...ghosting,
    active: true,
    stage,
    lastSentStage: stage,
    nextDueAt: undefined,
    sentHistory: [
      ...history,
      {
        stage,
        sentAt,
      },
    ],
  };
}

export function applyGhostingEvaluationToState(
  ghosting: GhostingState,
  evaluation: GhostingEvaluationResult,
): GhostingState {
  if (evaluation.isDead) {
    return {
      ...ghosting,
      active: false,
      cycle: 3,
      stage: "dead",
      nextDueAt: undefined,
      isDead: true,
      completedAt: nowIso(),
    };
  }

  return {
    ...ghosting,
    active: evaluation.active,
    cycle: evaluation.cycle,
    stage: evaluation.dueNow ? evaluation.stage : "inactive",
    nextDueAt: evaluation.nextDueAt,
    isDead: false,
  };
}

export function getGhostingMessageText(stage: GhostingStage): string | null {
  return getGhostingConfig().messages[stage] ?? null;
}
