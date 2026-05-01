import { getLeadById, saveLead } from "../data/leads.store.js";
import type { LeadRecord } from "../data/leads.store.js";
import type {
  BookingData,
  BookingDataStatus,
  BookingProvider,
  MeetingType,
} from "../types/types.js";

type ProviderBooking = {
  status?: string;
  provider?: string;
  externalEventUri?: string;
  externalInviteeUri?: string;
  bookingUrl?: string;
  bookedAt?: string;
  canceledAt?: string;
};

type BookingSyncState = {
  leadId: string;
  backendLeadId?: string;
  bookingData?: BookingData;
  providerBooking?: ProviderBooking;
  [key: string]: unknown;
};

const ALLOWED_BOOKING_DATA_STATUSES = new Set([
  "inactive",
  "requested",
  "pending_confirmation",
  "booked",
  "cancelled",
  "completed",
]);

const ALLOWED_MEETING_TYPES = new Set(["phone", "video", "in_person", "unknown"]);
const ALLOWED_BOOKING_PROVIDERS = new Set([
  "manual",
  "calendly",
  "google_calendar",
  "meetergo",
  "zoom",
  "meet",
  "",
]);

function normalizeBookingStatus(raw: unknown, booked: boolean): BookingDataStatus {
  const rawValue = String(raw ?? "").trim().toLowerCase();
  const normalized = rawValue === "idle" ? "inactive" : rawValue;
  if (booked || normalized === "booked") {
    return "booked";
  }
  return ALLOWED_BOOKING_DATA_STATUSES.has(normalized)
    ? (normalized as BookingDataStatus)
    : "inactive";
}

function normalizeBookingProvider(raw: unknown): BookingProvider {
  const value = String(raw ?? "").trim().toLowerCase();
  return ALLOWED_BOOKING_PROVIDERS.has(value)
    ? (value as BookingProvider)
    : "";
}

function normalizeMeetingType(raw: unknown): MeetingType {
  const value = String(raw ?? "").trim().toLowerCase();
  return ALLOWED_MEETING_TYPES.has(value)
    ? (value as MeetingType)
    : "unknown";
}

function mapProviderBookingStatus(raw: unknown): BookingDataStatus {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "booked") return "booked";
  if (value === "canceled") return "cancelled";
  if (value === "awaiting_booking") return "pending_confirmation";
  if (value === "inactive") return "inactive";
  if (value === "completed") return "completed";
  return "inactive";
}

export function buildDefaultBookingData(): BookingData {
  return {
    selectedSlot: "",
    startAt: undefined,
    endAt: undefined,
    bookingProvider: "",
    bookingId: "",
    externalBookingId: "",
    calendarEventId: "",
    meetingLink: "",
    meetingType: "unknown",
    status: "inactive",
    confirmedAt: null,
    cancelledAt: null,
    notes: "",
  };
}

export function normalizeBookingData(raw: unknown, booked = false) {
  const payload = (raw ?? {}) as Record<string, unknown>;
  const status = normalizeBookingStatus(payload.status, booked);

  const normalized: BookingData = {
    selectedSlot: String(payload.selectedSlot ?? "").trim(),
    startAt:
      payload.startAt === null || payload.startAt === undefined
        ? undefined
        : String(payload.startAt ?? "").trim() || undefined,
    endAt:
      payload.endAt === null || payload.endAt === undefined
        ? undefined
        : String(payload.endAt ?? "").trim() || undefined,
    bookingProvider: normalizeBookingProvider(payload.bookingProvider),
    bookingId: String(payload.bookingId ?? "").trim(),
    externalBookingId: String(payload.externalBookingId ?? "").trim(),
    calendarEventId: String(payload.calendarEventId ?? "").trim(),
    meetingLink: String(payload.meetingLink ?? "").trim(),
    meetingType: normalizeMeetingType(payload.meetingType),
    status,
    confirmedAt:
      payload.confirmedAt === null || payload.confirmedAt === undefined
        ? null
        : String(payload.confirmedAt ?? "").trim() || null,
    cancelledAt:
      payload.cancelledAt === null || payload.cancelledAt === undefined
        ? null
        : String(payload.cancelledAt ?? "").trim() || null,
    notes:
      payload.notes === null || payload.notes === undefined
        ? ""
        : String(payload.notes),
  };

  if (normalized.status === "booked" && !normalized.bookingProvider) {
    normalized.bookingProvider = "manual";
  }

  if (normalized.status === "booked" && !normalized.confirmedAt) {
    normalized.confirmedAt = new Date().toISOString();
  }

  return normalized;
}

function mapProviderEventTypeToStatus(eventType: unknown): string {
  const value = String(eventType ?? "").trim().toLowerCase();

  if (
    value === "booking.cancelled" ||
    value === "booking.canceled" ||
    value === "invitee.canceled" ||
    value === "invitee.cancelled"
  ) {
    return "cancelled";
  }

  if (
    value === "booking.created" ||
    value === "booking.rescheduled" ||
    value === "invitee.created"
  ) {
    return "booked";
  }

  return "";
}

function hasOwnPropertyKey(object: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function mergeBookingDataFromProviderEvent(
  existing: BookingData,
  raw: unknown,
  provider?: unknown,
  eventType?: unknown,
): BookingData {
  const payload = (raw ?? {}) as Record<string, unknown>;
  const useEventStatus = mapProviderEventTypeToStatus(eventType);
  const shouldUseEventStatus = !hasOwnPropertyKey(payload, "status") && Boolean(useEventStatus);

  const rawStatus = hasOwnPropertyKey(payload, "status")
    ? payload.status
    : shouldUseEventStatus
    ? useEventStatus
    : existing.status;

  const status = normalizeBookingStatus(rawStatus, false);
  const hasProviderField = hasOwnPropertyKey(payload, "bookingProvider");
  const bookingProvider = hasProviderField
    ? normalizeBookingProvider(payload.bookingProvider)
    : normalizeBookingProvider(provider) || existing.bookingProvider;

  const merged: BookingData = {
    selectedSlot: hasOwnPropertyKey(payload, "selectedSlot")
      ? String(payload.selectedSlot ?? "").trim()
      : existing.selectedSlot,
    startAt: hasOwnPropertyKey(payload, "startAt")
      ? payload.startAt === null || payload.startAt === undefined
        ? undefined
        : String(payload.startAt ?? "").trim() || undefined
      : existing.startAt,
    endAt: hasOwnPropertyKey(payload, "endAt")
      ? payload.endAt === null || payload.endAt === undefined
        ? undefined
        : String(payload.endAt ?? "").trim() || undefined
      : existing.endAt,
    bookingProvider: bookingProvider || existing.bookingProvider,
    bookingId: hasOwnPropertyKey(payload, "bookingId")
      ? String(payload.bookingId ?? "").trim()
      : existing.bookingId,
    externalBookingId: hasOwnPropertyKey(payload, "externalBookingId")
      ? String(payload.externalBookingId ?? "").trim()
      : existing.externalBookingId,
    calendarEventId: hasOwnPropertyKey(payload, "calendarEventId")
      ? String(payload.calendarEventId ?? "").trim()
      : existing.calendarEventId,
    meetingLink: hasOwnPropertyKey(payload, "meetingLink")
      ? String(payload.meetingLink ?? "").trim()
      : existing.meetingLink,
    meetingType: hasOwnPropertyKey(payload, "meetingType")
      ? normalizeMeetingType(payload.meetingType)
      : existing.meetingType || "unknown",
    status,
    confirmedAt: hasOwnPropertyKey(payload, "confirmedAt")
      ? payload.confirmedAt === null || payload.confirmedAt === undefined
        ? null
        : String(payload.confirmedAt ?? "").trim() || null
      : existing.confirmedAt ?? null,
    cancelledAt: hasOwnPropertyKey(payload, "cancelledAt")
      ? payload.cancelledAt === null || payload.cancelledAt === undefined
        ? null
        : String(payload.cancelledAt ?? "").trim() || null
      : existing.cancelledAt ?? null,
    notes: hasOwnPropertyKey(payload, "notes")
      ? String(payload.notes ?? "")
      : existing.notes,
  };

  if (merged.status === "booked" && !merged.bookingProvider) {
    merged.bookingProvider = "manual";
  }

  if (merged.status === "booked" && !merged.confirmedAt) {
    merged.confirmedAt = new Date().toISOString();
  }

  if (merged.status === "cancelled" && !merged.cancelledAt) {
    merged.cancelledAt = new Date().toISOString();
  }

  return merged;
}

export function buildBookingDataFromConversationState(state: BookingSyncState) {
  const existing = state.bookingData ?? buildDefaultBookingData();
  const providerBooking = state.providerBooking;

  const base: BookingData = {
    selectedSlot: existing.selectedSlot,
    startAt: existing.startAt,
    endAt: existing.endAt,
    bookingProvider: existing.bookingProvider,
    bookingId: existing.bookingId,
    externalBookingId: existing.externalBookingId,
    calendarEventId: existing.calendarEventId,
    meetingLink: existing.meetingLink,
    meetingType: existing.meetingType || "unknown",
    status: existing.status || "inactive",
    confirmedAt: existing.confirmedAt ?? null,
    cancelledAt: existing.cancelledAt ?? null,
    notes: existing.notes || "",
  };

  if (providerBooking?.status && providerBooking.status !== "inactive") {
    const status = providerBooking.status;
    const bookingProvider = normalizeBookingProvider(
      (providerBooking.provider ?? existing.bookingProvider) || "manual",
    );

    return {
      ...base,
      bookingProvider,
      bookingId: String(existing.bookingId ?? "").trim(),
      externalBookingId: String(providerBooking.externalEventUri ?? existing.externalBookingId ?? "").trim(),
      meetingLink: String(
        providerBooking.bookingUrl ??
          providerBooking.externalInviteeUri ??
          existing.meetingLink ??
          ""
      ).trim(),
      status: mapProviderBookingStatus(status),
      confirmedAt:
        status === "booked"
          ? String(providerBooking.bookedAt ?? existing.confirmedAt ?? "").trim() || null
          : existing.confirmedAt ?? null,
      cancelledAt:
        status === "canceled"
          ? String(providerBooking.canceledAt ?? existing.cancelledAt ?? "").trim() || null
          : existing.cancelledAt ?? null,
    };
  }

  return base;
}

export function syncLeadBookingFromConversationState(state: BookingSyncState) {
  const leadId = String(state.backendLeadId ?? state.leadId).trim();
  if (!leadId) {
    return;
  }

  const lead = getLeadById(leadId);
  if (!lead) {
    return;
  }

  const bookingData = buildBookingDataFromConversationState(state);
  const booked = bookingData.status === "booked";

  if (
    lead.booked === booked &&
    lead.bookingData?.selectedSlot === bookingData.selectedSlot &&
    lead.bookingData?.startAt === bookingData.startAt &&
    lead.bookingData?.endAt === bookingData.endAt &&
    lead.bookingData?.bookingProvider === bookingData.bookingProvider &&
    lead.bookingData?.bookingId === bookingData.bookingId &&
    lead.bookingData?.externalBookingId === bookingData.externalBookingId &&
    lead.bookingData?.calendarEventId === bookingData.calendarEventId &&
    lead.bookingData?.meetingLink === bookingData.meetingLink &&
    lead.bookingData?.meetingType === bookingData.meetingType &&
    lead.bookingData?.status === bookingData.status &&
    lead.bookingData?.confirmedAt === bookingData.confirmedAt &&
    lead.bookingData?.cancelledAt === bookingData.cancelledAt &&
    lead.bookingData?.notes === bookingData.notes
  ) {
    return;
  }

  saveLead({
    ...lead,
    booked,
    bookingData,
  });
}

export function syncConversationBookingFromLead(
  state: BookingSyncState,
  lead: LeadRecord
) {
  return {
    ...state,
    bookingData: lead.bookingData ?? buildDefaultBookingData(),
  };
}
