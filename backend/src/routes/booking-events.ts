import crypto from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { RawBodyRequest } from "../app.js";
import { getAllLeads, getLeadById, saveLead } from "../data/leads.store.js";
import { getConversationState, saveConversationState } from "../data/store.js";
import { getAllBookingEvents, getBookingEventByIdempotencyKey, saveBookingEventLogEntry } from "../data/booking-events.store.js";
import { buildDefaultBookingData, mergeBookingDataFromProviderEvent } from "../domain/booking-sync.js";
import { markProviderBookingBooked, markProviderBookingCanceled } from "../services/provider-booking.service.js";
import { stopGhostingState } from "../services/ghosting.service.js";
import { appendAssistantMessage, setCurrentStep } from "../core/state-manager.js";
import { buildGoogleCalendarTemplateLink } from "../services/calendly-webhook.service.js";
import { env } from "../config/env.js";
import type { BookingEventLogEntry } from "../types/types.js";
import type { ProviderBookingState } from "../types/provider-booking.types.js";

const router = Router();

const ALLOWED_PROVIDER_NAMES = new Set([
  "manual",
  "calendly",
  "google_calendar",
  "meetergo",
  "zoom",
  "meet",
]);

function providerWebhookGuard(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (env.NODE_ENV === "production" && !env.ENABLE_GENERIC_WEBHOOKS) {
    res.status(404).json({
      ok: false,
      error: "provider_webhook_disabled",
      message:
        "Generische Provider-Webhooks sind in production standardmäßig deaktiviert. Calendly bleibt unter /booking-events/calendly separat.",
    });
    return;
  }

  next();
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[\s\-\.]/g, "")
    .toLowerCase();
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function extractString(value: unknown): string {
  return typeof value === "string" ? normalizeString(value) : "";
}

function getRawWebhookPayload(req: Request): string {
  const rawBody = (req as RawBodyRequest).rawBody;
  if (rawBody) {
    return rawBody.toString("utf8");
  }

  if (typeof req.body === "string") {
    return req.body;
  }

  try {
    return JSON.stringify(req.body);
  } catch {
    return "";
  }
}

function getCalendlySignatureHeader(req: Request): string | undefined {
  const headerNames = [
    "calendly-webhook-signature",
    "x-calendly-signature",
    "x-webhook-signature",
  ];

  for (const headerName of headerNames) {
    const headerValue = req.get(headerName);
    if (headerValue) {
      return normalizeString(headerValue);
    }
  }

  return undefined;
}

function verifyCalendlyWebhookSignature(req: Request): WebhookVerificationResult {
  // Production must fail closed even if the environment accidentally uses "off".
  const mode = env.NODE_ENV === "production" ? "strict" : env.CALENDLY_WEBHOOK_VERIFY_MODE;
  const secret = env.CALENDLY_WEBHOOK_SECRET;
  const signature = getCalendlySignatureHeader(req);

  if (mode === "off") {
    return { ok: true, reason: "local signature verification disabled" };
  }
  if (!secret) {
    if (mode === "strict") {
      return { ok: false, statusCode: 503, error: "calendly_webhook_secret_not_configured" };
    }
    return { ok: true, reason: "local dev without signature secret" };
  }
  if (!signature) {
    if (mode === "strict") {
      return { ok: false, statusCode: 401, error: "calendly_signature_missing" };
    }
    return { ok: true, reason: "local dev without signature" };
  }

  // Calendly: Calendly-Webhook-Signature: t=<unix_seconds>,v1=<hmac_sha256>.
  // The signed data is exactly `timestamp + "." + rawBody`.
  const parts = Object.fromEntries(signature.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator > 0
      ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
      : ["", ""];
  }));
  const timestamp = parts.t || "";
  const digest = parts.v1 || "";
  const timestampSeconds = Number(timestamp);
  const skew = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (
    !/^\d{10,13}$/.test(timestamp) ||
    !Number.isSafeInteger(timestampSeconds) ||
    !Number.isFinite(skew) ||
    skew > 180 ||
    !/^[0-9a-f]{64}$/i.test(digest)
  ) {
    return { ok: false, statusCode: 401, error: "calendly_signature_invalid_or_expired" };
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(timestamp + "." + getRawWebhookPayload(req))
    .digest("hex");
  const actual = Buffer.from(digest, "hex");
  const expected = Buffer.from(computed, "hex");
  const matches =
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected);

  if (!matches) {
    return { ok: false, statusCode: 401, error: "calendly_signature_invalid" };
  }
  return { ok: true, reason: "valid_calendly_signature" };
}

function formatReadableSlot(startAt: string): string {
  if (!startAt) {
    return "";
  }

  const parsed = new Date(startAt);
  if (Number.isNaN(parsed.getTime())) {
    return startAt;
  }

  return parsed.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type BookingEventInput = {
  provider: string;
  eventType: string;
  campaignId: string;
  leadId?: string;
  phone?: string;
  leadName?: string;
  bookingData: Record<string, unknown>;
};

type BookingEventResult =
  | {
      ok: true;
      payload: BookingEventInput;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
    };

type CalendlyPayload = Record<string, unknown>;

type WebhookVerificationResult =
  | {
      ok: true;
      reason: string;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
    };

function mapCalendlyEventType(rawEventType: string): string {
  const normalized = normalizeString(rawEventType).toLowerCase();

  if (normalized === "invitee.created") {
    return "booking.created";
  }

  if (normalized === "invitee.canceled" || normalized === "invitee.cancelled") {
    return "booking.cancelled";
  }

  if (
    normalized === "invitee.rescheduled" ||
    normalized === "rescheduled" ||
    normalized === "booking.rescheduled"
  ) {
    return "booking.rescheduled";
  }

  if (normalized === "booking.created" || normalized === "booking.cancelled") {
    return normalized;
  }

  return "";
}

function mapCalendlyPayloadToBookingEvent(payload: CalendlyPayload): BookingEventResult {
  const body = getObject(payload);
  const nested = getObject(body.payload);
  // Calendly's actual envelope uses body.event as the event *name* and
  // body.payload.event as the scheduled-event object. Do not discard the latter.
  const event = getObject(typeof body.event === "object" ? body.event : nested.event);
  const invitee = getObject(body.invitee ?? nested.invitee);
  const tracking = getObject(body.tracking ?? nested.tracking);

  const rawEventType =
    extractString(body.eventType) ||
    extractString(body.event) ||
    extractString(nested.eventType) ||
    extractString(event.type) ||
    extractString(event.event);

  const eventType = mapCalendlyEventType(rawEventType);
  if (!eventType) {
    return {
      ok: false,
      statusCode: 400,
      error: "Ungültiger Calendly eventType. Unterstützt: invitee.created, invitee.canceled, invitee.cancelled, invitee.rescheduled, rescheduled.",
    };
  }

  const campaignId = normalizeString(body.campaignId ?? tracking.utm_campaign);
  if (!campaignId) {
    return {
      ok: false,
      statusCode: 400,
      error: "campaignId ist erforderlich.",
    };
  }

  const leadId = normalizeString(body.leadId ?? tracking.utm_content);
  const phone = normalizePhone(body.phone ?? invitee.phone);
  const leadName = normalizeString(body.leadName ?? invitee.name ?? invitee.full_name ?? invitee.first_name ?? invitee.last_name);

  const selectedSlot = extractString(
    body.selectedSlot ?? body.selected_slot ?? event.name,
  );
  const startAt = extractString(body.startAt ?? body.start_at ?? event.start_time);
  const endAt = extractString(body.endAt ?? body.end_time ?? event.end_time);
  const meetingLink = extractString(
    body.meetingLink ?? body.meeting_link ?? event.location,
  );
  const notes = extractString(body.notes ?? body.note);
  const externalBookingId = extractString(
    body.externalBookingId ?? body.external_booking_id ?? event.uri ?? invitee.uri,
  );

  const bookingData: Record<string, unknown> = {};

  if (selectedSlot) {
    bookingData.selectedSlot = selectedSlot;
  } else if (startAt) {
    bookingData.selectedSlot = formatReadableSlot(startAt);
  }

  if (startAt) {
    bookingData.startAt = startAt;
  }
  if (endAt) {
    bookingData.endAt = endAt;
  }
  if (meetingLink) {
    bookingData.meetingLink = meetingLink;
  }
  if (notes) {
    bookingData.notes = notes;
  }
  if (externalBookingId) {
    bookingData.externalBookingId = externalBookingId;
  }

  return {
    ok: true,
    payload: {
      provider: "calendly",
      eventType,
      campaignId,
      leadId: leadId || undefined,
      phone: phone || undefined,
      leadName: leadName || undefined,
      bookingData,
    } as BookingEventInput,
  };
}

type BookingEventProcessingResult = {
  statusCode: number;
  response: unknown;
};

type BookingEventReference = {
  provider: string;
  eventType: string;
  campaignId: string;
  leadId?: string;
  externalBookingId?: string;
  calendarEventId?: string;
};

function buildBookingEventIdempotencyKey(params: BookingEventReference): string {
  const parts = [
    normalizeString(params.provider).toLowerCase(),
    normalizeString(params.eventType).toLowerCase(),
  ];

  const externalBookingId = normalizeString(params.externalBookingId);
  const calendarEventId = normalizeString(params.calendarEventId);

  if (externalBookingId) {
    parts.push(`external:${externalBookingId}`);
  }

  if (calendarEventId) {
    parts.push(`calendar:${calendarEventId}`);
  }

  if (!externalBookingId && !calendarEventId) {
    parts.push(`lead:${normalizeString(params.leadId).toLowerCase()}`);
    parts.push(`campaign:${normalizeString(params.campaignId).toLowerCase()}`);
  }

  return parts.filter(Boolean).join("|");
}

function getBookingEventReferenceFromPayload(
  body: unknown,
): BookingEventReference {
  const payload = getObject(body);
  const bookingData = getObject(payload.bookingData);

  return {
    provider: normalizeString(payload.provider),
    eventType: normalizeString(payload.eventType),
    campaignId: normalizeString(payload.campaignId),
    leadId: normalizeString(payload.leadId) || undefined,
    externalBookingId: normalizeString(bookingData.externalBookingId) || undefined,
    calendarEventId: normalizeString(bookingData.calendarEventId) || undefined,
  };
}

function processBookingEventWithLogging(
  rawPayload: unknown,
  eventResult: BookingEventResult,
): BookingEventProcessingResult {
  const receivedAt = new Date().toISOString();
  const reference = eventResult.ok
    ? {
        provider: eventResult.payload.provider,
        eventType: eventResult.payload.eventType,
        campaignId: eventResult.payload.campaignId,
        leadId: eventResult.payload.leadId,
        externalBookingId: normalizeString(
          eventResult.payload.bookingData.externalBookingId,
        ) || undefined,
        calendarEventId: normalizeString(
          eventResult.payload.bookingData.calendarEventId,
        ) || undefined,
      }
    : getBookingEventReferenceFromPayload(rawPayload);

  const idempotencyKey = buildBookingEventIdempotencyKey(reference);
  const existingEvent = getBookingEventByIdempotencyKey(idempotencyKey);

  if (existingEvent && existingEvent.status !== "failed") {
    const ignoredEntry: BookingEventLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      provider: reference.provider,
      eventType: reference.eventType,
      campaignId: reference.campaignId,
      leadId: reference.leadId,
      externalBookingId: reference.externalBookingId,
      calendarEventId: reference.calendarEventId,
      status: "ignored_duplicate",
      receivedAt,
      processedAt: receivedAt,
      error: "Duplicate event ignored",
      rawPayload,
      idempotencyKey,
    };

    saveBookingEventLogEntry(ignoredEntry);

    return {
      statusCode: 200,
      response: {
        ok: true,
        message: "Duplicate event ignored",
        eventLog: ignoredEntry,
      },
    };
  }

  if (!eventResult.ok) {
    const failedEntry: BookingEventLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      provider: reference.provider,
      eventType: reference.eventType,
      campaignId: reference.campaignId,
      leadId: reference.leadId,
      externalBookingId: reference.externalBookingId,
      calendarEventId: reference.calendarEventId,
      status: "failed",
      receivedAt,
      processedAt: receivedAt,
      error: eventResult.error,
      rawPayload,
      idempotencyKey,
    };

    saveBookingEventLogEntry(failedEntry);

    return {
      statusCode: eventResult.statusCode,
      response: {
        ok: false,
        error: eventResult.error,
      },
    };
  }

  const execution = executeBookingEvent(eventResult.payload);
  const processedAt = new Date().toISOString();
  const successful = execution.statusCode === 200 && (execution.response as any)?.ok === true;
  const status = successful ? "processed" : "failed";
  const error = !successful ? (execution.response as any)?.error : undefined;

  const entry: BookingEventLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    provider: reference.provider,
    eventType: reference.eventType,
    campaignId: reference.campaignId,
    leadId: reference.leadId,
    externalBookingId: reference.externalBookingId,
    calendarEventId: reference.calendarEventId,
    status,
    receivedAt,
    processedAt,
    error,
    rawPayload,
    idempotencyKey,
  };

  saveBookingEventLogEntry(entry);

  return {
    statusCode: execution.statusCode,
    response: execution.response,
  };
}

function createBookingEventInput(body: unknown): BookingEventResult {
  const payload = getObject(body);
  const provider = normalizeString(payload.provider);
  const eventType = normalizeString(payload.eventType);
  const campaignId = normalizeString(payload.campaignId);
  const leadId = normalizeString(payload.leadId);
  const phone = normalizePhone(payload.phone);
  const leadName = normalizeString(payload.leadName);
  const bookingDataPayload = getObject(payload.bookingData);

  if (!campaignId) {
    return {
      ok: false,
      statusCode: 400,
      error: "campaignId ist erforderlich.",
    };
  }

  if (!leadId && !phone && !leadName) {
    return {
      ok: false,
      statusCode: 400,
      error: "leadId, phone oder leadName muss angegeben werden.",
    };
  }

  if (provider && !ALLOWED_PROVIDER_NAMES.has(provider)) {
    return {
      ok: false,
      statusCode: 400,
      error: `Ungültiger provider: ${provider}. Erlaubt sind manual, calendly, google_calendar, meetergo, zoom, meet.`,
    };
  }

  return {
    ok: true,
    payload: {
      provider,
      eventType,
      campaignId,
      leadId: leadId || undefined,
      phone: phone || undefined,
      leadName: leadName || undefined,
      bookingData: bookingDataPayload,
    } as BookingEventInput,
  };
}

function executeBookingEvent(input: BookingEventInput) {
  const { provider, eventType, campaignId, leadId, phone, leadName, bookingData } = input;

  let lead = null;
  let ambiguous = false;

  if (leadId) {
    const found = getLeadById(leadId);
    if (found && found.campaignId === campaignId) {
      lead = found;
    }
  }

  if (!lead && phone) {
    const found = findLeadByPhone(phone, campaignId);
    if (found === undefined) {
      ambiguous = true;
    } else {
      lead = found;
    }
  }

  if (!lead && !ambiguous && leadName) {
    const found = findLeadByName(leadName, campaignId);
    if (found === undefined) {
      ambiguous = true;
    } else {
      lead = found;
    }
  }

  if (ambiguous) {
    return {
      statusCode: 400,
      response: {
        ok: false,
        error: "Mehrere Leads passen zu den angegebenen Kriterien. Bitte verwenden Sie leadId oder eindeutige Kontaktdaten.",
      },
    };
  }

  // The test-chat stores a ConversationState but does not create a Leads
  // dashboard record. Verified Calendly booking events must support both.
  const existingState = lead
    ? getConversationState(lead.id, campaignId)
    : leadId
      ? getConversationState(leadId, campaignId)
      : undefined;

  if (!lead && !existingState) {
    return {
      statusCode: 404,
      response: {
        ok: false,
        error: "Kein Lead oder Conversation State mit diesen Daten gefunden.",
      },
    };
  }

  const mergedBookingData = mergeBookingDataFromProviderEvent(
    lead?.bookingData ?? existingState?.bookingData ?? buildDefaultBookingData(),
    bookingData,
    provider,
    eventType,
  );

  const updatedLead = lead
    ? saveLead({
        ...lead,
        booked: mergedBookingData.status === "booked",
        bookingData: mergedBookingData,
      })
    : null;

  const state = existingState ??
    (updatedLead ? getConversationState(updatedLead.id, campaignId) : undefined);
  const cancelledEvent = isCancelledEventType(eventType);
  let conversationSummary = null;

  if (state) {
    state.bookingData = mergedBookingData;

    if (cancelledEvent) {
      state.providerBooking = markProviderBookingCanceled(state.providerBooking);
    } else if (mergedBookingData.status === "booked") {
      state.providerBooking = markProviderBookingBooked(state.providerBooking);
      state.ghosting = stopGhostingState(state.ghosting, "manual_stop");
      setCurrentStep(state, "done");
    }

    // The event has been confirmed by the provider, but this application
    // only PREPARES a customer-facing confirmation for the test chat.
    // Do not claim it was sent over Instagram/WhatsApp.
    if (
      provider === "calendly" &&
      (cancelledEvent || mergedBookingData.status === "booked") &&
      state.owner !== "human" &&
      state.aiPaused !== true &&
      !state.flags.stopped
    ) {
      const calendarLink = !cancelledEvent
        ? buildGoogleCalendarTemplateLink({
            startAt: mergedBookingData.startAt,
            endAt: mergedBookingData.endAt,
            title: "Strategiegespräch",
          })
        : null;
      const message = cancelledEvent
        ? "Dein Calendly-Termin wurde storniert. Wenn du neu buchen möchtest, sag kurz Bescheid."
        : "Calendly hat deinen Termin bestätigt. Du erhältst die Buchungsbestätigung vom Anbieter." +
          (calendarLink
            ? "\\nHier kannst du den Termin zusätzlich in deinem Google Kalender speichern:\\n" + calendarLink
            : "");
      appendAssistantMessage(state, message);
      const latest = state.messages.at(-1);
      if (latest) {
        latest.outboundStatus = "prepared";
        latest.sent = false;
      }
    }

    saveConversationState(state);
    conversationSummary = {
      leadId: state.leadId,
      campaignId: state.campaignId,
      stage: state.stage,
      bookingData: state.bookingData,
      providerBookingStatus: state.providerBooking?.status,
    };
  }

  return {
    statusCode: 200,
    response: {
      ok: true,
      message: "Buchungsereignis verarbeitet, aber keine Nachricht versendet.",
      lead: updatedLead,
      conversationSummary,
    },
  };
}

function findLeadByPhone(phone: string, campaignId: string) {
  if (!phone) {
    return null;
  }

  const matches = getAllLeads().filter(
    (lead) =>
      normalizePhone(lead.phone) === phone && lead.campaignId === campaignId,
  );

  if (matches.length !== 1) {
    return matches.length === 0 ? null : undefined;
  }

  return matches[0];
}

function findLeadByName(name: string, campaignId: string) {
  if (!name) {
    return null;
  }

  const normalizedName = normalizeString(name).toLowerCase();
  const matches = getAllLeads().filter(
    (lead) => lead.name.trim().toLowerCase() === normalizedName && lead.campaignId === campaignId,
  );

  if (matches.length !== 1) {
    return matches.length === 0 ? null : undefined;
  }

  return matches[0];
}

function isCancelledEventType(eventType: string): boolean {
  const value = eventType.trim().toLowerCase();
  return [
    "booking.cancelled",
    "booking.canceled",
    "invitee.canceled",
    "invitee.cancelled",
  ].includes(value);
}

function buildProviderBookingCanceledState(
  current: ProviderBookingState | undefined,
): ProviderBookingState {
  return {
    status: "canceled",
    provider: current?.provider,
    bookingUrl: current?.bookingUrl,
    linkSentAt: current?.linkSentAt,
    bookedAt: current?.bookedAt,
    canceledAt: current?.canceledAt ?? new Date().toISOString(),
    active: false,
    stage: current?.stage ?? "inactive",
    nextDueAt: current?.nextDueAt,
    sentHistory: current?.sentHistory ?? [],
    externalEventUri: current?.externalEventUri,
    externalInviteeUri: current?.externalInviteeUri,
    lastWebhookEventType: current?.lastWebhookEventType,
    lastWebhookReceivedAt: current?.lastWebhookReceivedAt,
  };
}

router.post("/provider", providerWebhookGuard, (req, res) => {
  try {
    const result = createBookingEventInput(req.body ?? {});
    const execution = processBookingEventWithLogging(req.body ?? {}, result);
    return res.status(execution.statusCode).json(execution.response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler beim Verarbeiten des Booking-Events.";
    return res.status(500).json({ ok: false, error: message });
  }
});

router.post("/calendly", (req, res) => {
  try {
    const verification = verifyCalendlyWebhookSignature(req);
    if (!verification.ok) {
      return res.status(verification.statusCode).json({ ok: false, error: verification.error });
    }

    const mapped = mapCalendlyPayloadToBookingEvent(req.body ?? {});
    const execution = processBookingEventWithLogging(req.body ?? {}, mapped);
    return res.status(execution.statusCode).json(execution.response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler beim Verarbeiten des Calendly-Booking-Events.";
    return res.status(500).json({ ok: false, error: message });
  }
});

router.get("/", (_req, res) => {
  const events = getAllBookingEvents();
  return res.json({ ok: true, count: events.length, events });
});

export default router;
