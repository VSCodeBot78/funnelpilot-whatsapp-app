import type { ConversationState } from "../types/types.js";
import type {
  ProviderBookingState,
  ProviderFollowUpEvaluationResult,
  ProviderFollowUpStage,
} from "../types/provider-booking.types.js";

type ProviderFollowUpSlot = {
  stage: ProviderFollowUpStage;
  offsetHours: number;
};

const PROVIDER_FOLLOW_UP_SLOTS: ProviderFollowUpSlot[] = [
  { stage: "reminder_6h", offsetHours: 6 },
  { stage: "reminder_24h", offsetHours: 24 },
  { stage: "reminder_48h", offsetHours: 48 },
];

function nowIso(): string {
  return new Date().toISOString();
}

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

function toIso(date: Date): string {
  return date.toISOString();
}

function wasStageAlreadySent(
  state: ProviderBookingState | undefined,
  stage: ProviderFollowUpStage,
): boolean {
  if (!state?.sentHistory?.length) {
    return false;
  }

  return state.sentHistory.some((entry) => entry.stage === stage);
}

export function createInitialProviderBookingState(): ProviderBookingState {
  return {
    status: "inactive",
    active: false,
    stage: "inactive",
    sentHistory: [],
  };
}

export function activateProviderBookingState(params: {
  current?: ProviderBookingState;
  provider?: string;
  bookingUrl?: string;
  linkSentAt?: string;
}): ProviderBookingState {
  return {
    ...(params.current ?? createInitialProviderBookingState()),
    status: "awaiting_booking",
    provider: params.provider,
    bookingUrl: params.bookingUrl,
    linkSentAt: params.linkSentAt ?? nowIso(),
    bookedAt: undefined,
    canceledAt: undefined,
    active: true,
    stage: "inactive",
    nextDueAt: undefined,
    sentHistory: params.current?.sentHistory ?? [],
  };
}

export function markProviderBookingBooked(
  current?: ProviderBookingState,
  bookedAt?: string,
): ProviderBookingState {
  return {
    ...(current ?? createInitialProviderBookingState()),
    status: "booked",
    active: false,
    stage: "inactive",
    nextDueAt: undefined,
    bookedAt: bookedAt ?? nowIso(),
  };
}

export function markProviderBookingCanceled(
  current?: ProviderBookingState,
  canceledAt?: string,
): ProviderBookingState {
  return {
    ...(current ?? createInitialProviderBookingState()),
    status: "canceled",
    active: false,
    stage: "inactive",
    nextDueAt: undefined,
    canceledAt: canceledAt ?? nowIso(),
  };
}

export function getProviderFollowUpMessage(stage: ProviderFollowUpStage): string | null {
  switch (stage) {
    case "reminder_6h":
      return (
        "Kurze Erinnerung von mir 😊\n" +
        "Hast du es geschafft, dir den Termin über den Link einzutragen?"
      );
    case "reminder_24h":
      return (
        "Ich hake nur kurz nach:\n" +
        "Hat es mit dem Buchungslink geklappt oder soll ich ihn dir nochmal schicken?"
      );
    case "reminder_48h":
      return (
        "Kurze letzte Nachfrage dazu:\n" +
        "Wenn du den Termin noch eintragen willst, sag kurz Bescheid, dann schicke ich dir den Link direkt nochmal."
      );
    default:
      return null;
  }
}

export function evaluateProviderBookingFollowUp(
  state: ConversationState,
  now = new Date(),
): ProviderFollowUpEvaluationResult {
  const providerBooking = state.providerBooking;

  if (!providerBooking || providerBooking.status === "inactive") {
    return {
      shouldActivate: false,
      active: false,
      status: "inactive",
      stage: "inactive",
      dueNow: false,
      reason: "Kein Provider-Booking aktiv.",
    };
  }

  if (providerBooking.status === "booked") {
    return {
      shouldActivate: false,
      active: false,
      status: "booked",
      stage: "inactive",
      dueNow: false,
      reason: "Termin bereits gebucht.",
    };
  }

  if (providerBooking.status === "canceled") {
    return {
      shouldActivate: false,
      active: false,
      status: "canceled",
      stage: "inactive",
      dueNow: false,
      reason: "Provider-Buchung wurde storniert.",
    };
  }

  const linkSentAt = parseIso(providerBooking.linkSentAt);

  if (!linkSentAt) {
    return {
      shouldActivate: false,
      active: false,
      status: providerBooking.status,
      stage: "inactive",
      dueNow: false,
      reason: "Kein linkSentAt vorhanden.",
    };
  }

  let latestDue: ProviderFollowUpSlot | null = null;
  let nextDue: ProviderFollowUpSlot | null = null;

  for (const slot of PROVIDER_FOLLOW_UP_SLOTS) {
    if (wasStageAlreadySent(providerBooking, slot.stage)) {
      continue;
    }

    const dueAt = addHours(linkSentAt, slot.offsetHours);

    if (now.getTime() >= dueAt.getTime()) {
      latestDue = slot;
    } else if (!nextDue) {
      nextDue = slot;
    }
  }

  if (latestDue) {
    const dueAt = addHours(linkSentAt, latestDue.offsetHours);

    return {
      shouldActivate: true,
      active: true,
      status: "awaiting_booking",
      stage: latestDue.stage,
      nextDueAt: toIso(dueAt),
      dueNow: true,
      messagePreview: getProviderFollowUpMessage(latestDue.stage),
    };
  }

  if (nextDue) {
    const dueAt = addHours(linkSentAt, nextDue.offsetHours);

    return {
      shouldActivate: true,
      active: true,
      status: "awaiting_booking",
      stage: "inactive",
      nextDueAt: toIso(dueAt),
      dueNow: false,
      messagePreview: null,
    };
  }

  return {
    shouldActivate: false,
    active: false,
    status: "awaiting_booking",
    stage: "inactive",
    dueNow: false,
    reason: "Alle Booking-Follow-ups wurden bereits durchlaufen.",
  };
}

export function markProviderFollowUpAsSent(
  current: ProviderBookingState,
  stage: ProviderFollowUpStage,
  sentAt = nowIso(),
): ProviderBookingState {
  if (stage === "inactive") {
    return current;
  }

  if (current.sentHistory.some((entry) => entry.stage === stage)) {
    return current;
  }

  return {
    ...current,
    active: true,
    stage,
    nextDueAt: undefined,
    sentHistory: [...current.sentHistory, { stage, sentAt }],
  };
}
