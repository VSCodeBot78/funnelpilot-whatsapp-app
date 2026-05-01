import { DEFAULT_CAMPAIGN_ID } from "../config/campaigns.js";
import { getConversationState, saveConversationState } from "../data/store.js";
import { appendAssistantMessage } from "../core/state-manager.js";
import { stopGhostingState } from "./ghosting.service.js";
import {
  markProviderBookingBooked,
  markProviderBookingCanceled,
} from "./provider-booking.service.js";
import type { ConversationState } from "../types/types.js";

type CalendlyWebhookEventType = "invitee.created" | "invitee.canceled" | "unknown";

type CalendlyTracking = {
  utm_campaign?: string;
  utm_content?: string;
};

type CalendlyScheduledEvent = {
  uri?: string;
  start_time?: string;
  end_time?: string;
  name?: string;
};

type CalendlyInvitee = {
  uri?: string;
  name?: string;
  email?: string;
};

type CalendlyPayload = {
  event?: string;
  payload?: {
    tracking?: CalendlyTracking;
    event?: CalendlyScheduledEvent;
    invitee?: CalendlyInvitee;
  };
};

type CalendlyWebhookResult =
  | {
      ok: true;
      processed: boolean;
      reason?: string;
      leadId?: string;
      campaignId?: string;
      eventType: CalendlyWebhookEventType;
    }
  | {
      ok: false;
      error: string;
      eventType?: CalendlyWebhookEventType;
    };

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEventType(input: string | undefined): CalendlyWebhookEventType {
  if (input === "invitee.created") {
    return "invitee.created";
  }

  if (input === "invitee.canceled") {
    return "invitee.canceled";
  }

  return "unknown";
}

function extractTracking(body: CalendlyPayload): CalendlyTracking {
  return body.payload?.tracking ?? {};
}

function extractLeadId(body: CalendlyPayload): string | undefined {
  const tracking = extractTracking(body);
  const leadId = tracking.utm_content?.trim();

  return leadId || undefined;
}

function extractCampaignId(body: CalendlyPayload): string {
  const tracking = extractTracking(body);
  const campaignId = tracking.utm_campaign?.trim();

  return campaignId || DEFAULT_CAMPAIGN_ID;
}

function applyWebhookMetadata(
  state: ConversationState,
  eventType: CalendlyWebhookEventType,
  body: CalendlyPayload,
): void {
  state.providerBooking = {
    ...state.providerBooking,
    externalEventUri: body.payload?.event?.uri,
    externalInviteeUri: body.payload?.invitee?.uri,
    lastWebhookEventType: eventType,
    lastWebhookReceivedAt: nowIso(),
  };
}

function wasSameWebhookAlreadyProcessed(
  state: ConversationState,
  eventType: CalendlyWebhookEventType,
  body: CalendlyPayload,
): boolean {
  const sameEventUri =
    state.providerBooking?.externalEventUri &&
    body.payload?.event?.uri &&
    state.providerBooking.externalEventUri === body.payload.event.uri;

  const sameInviteeUri =
    state.providerBooking?.externalInviteeUri &&
    body.payload?.invitee?.uri &&
    state.providerBooking.externalInviteeUri === body.payload.invitee.uri;

  const sameEventType = state.providerBooking?.lastWebhookEventType === eventType;

  return Boolean(sameEventType && sameEventUri && sameInviteeUri);
}

function formatBookedTime(startTime?: string): string {
  if (!startTime) {
    return "deinen Termin";
  }

  const parsed = new Date(startTime);

  if (Number.isNaN(parsed.getTime())) {
    return "deinen Termin";
  }

  const dateText = parsed.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  const timeText = parsed.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateText} um ${timeText}`;
}

function formatGoogleCalendarDate(input?: string): string | null {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildGoogleCalendarLink(body: CalendlyPayload): string | null {
  const start = formatGoogleCalendarDate(body.payload?.event?.start_time);
  const end = formatGoogleCalendarDate(body.payload?.event?.end_time);

  if (!start || !end) {
    return null;
  }

  const title = body.payload?.event?.name?.trim() || "Strategiegespräch mit Jochen";
  const details =
    "Die finalen Termindetails und den Gesprächslink findest du in deiner Calendly-Bestätigung per Mail.";
  const location = "Details siehe Calendly-Bestätigung";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildBookedWhatsappConfirmation(body: CalendlyPayload): string {
  const slotText = formatBookedTime(body.payload?.event?.start_time);
  const googleCalendarLink = buildGoogleCalendarLink(body);

  let message =
    "Perfekt 👍 dein Termin ist jetzt verbindlich eingetragen.\n\n" +
    `📅 ${slotText}\n` +
    "Du hast die Bestätigung auch nochmal per Mail von Calendly bekommen.\n";

  if (googleCalendarLink) {
    message +=
      "\nWenn du magst, kannst du dir den Termin hier direkt in deinen Kalender speichern:\n" +
      `${googleCalendarLink}\n`;
  }

  message += "\nIch freue mich auf das Gespräch.";

  return message;
}

function buildCanceledWhatsappConfirmation(body: CalendlyPayload): string {
  const slotText = formatBookedTime(body.payload?.event?.start_time);

  return (
    "Alles klar, dein Termin wurde storniert.\n" +
    `${slotText !== "deinen Termin" ? `Betroffen war: ${slotText}\n` : ""}` +
    "Wenn du einen neuen Termin willst, schreib mir einfach kurz."
  );
}

export function processCalendlyWebhook(body: CalendlyPayload): CalendlyWebhookResult {
  const eventType = normalizeEventType(body.event);

  if (eventType === "unknown") {
    return {
      ok: true,
      processed: false,
      eventType,
      reason: "Calendly-Event aktuell nicht relevant.",
    };
  }

  const leadId = extractLeadId(body);

  if (!leadId) {
    return {
      ok: false,
      error: "Kein leadId in tracking.utm_content gefunden.",
      eventType,
    };
  }

  const campaignId = extractCampaignId(body);
  const state = getConversationState(leadId, campaignId);

  if (!state) {
    return {
      ok: false,
      error: "Kein Conversation State zum Calendly-Webhook gefunden.",
      eventType,
    };
  }

  if (wasSameWebhookAlreadyProcessed(state, eventType, body)) {
    return {
      ok: true,
      processed: false,
      leadId,
      campaignId,
      eventType,
      reason: "Webhook wurde bereits verarbeitet.",
    };
  }

  applyWebhookMetadata(state, eventType, body);

  if (eventType === "invitee.created") {
    state.providerBooking = markProviderBookingBooked(
      state.providerBooking,
      nowIso(),
    );

    state.ghosting = stopGhostingState(state.ghosting, "manual_stop");

    const confirmationText = buildBookedWhatsappConfirmation(body);
    appendAssistantMessage(state, confirmationText);

    saveConversationState(state);

    return {
      ok: true,
      processed: true,
      leadId,
      campaignId,
      eventType,
    };
  }

  if (eventType === "invitee.canceled") {
    state.providerBooking = markProviderBookingCanceled(
      state.providerBooking,
      nowIso(),
    );

    state.ghosting = stopGhostingState(state.ghosting, "manual_stop");

    const confirmationText = buildCanceledWhatsappConfirmation(body);
    appendAssistantMessage(state, confirmationText);

    saveConversationState(state);

    return {
      ok: true,
      processed: true,
      leadId,
      campaignId,
      eventType,
    };
  }

  return {
    ok: true,
    processed: false,
    leadId,
    campaignId,
    eventType,
    reason: "Kein Statuswechsel nötig.",
  };
}
