import type { ConversationState } from "../types/types.js";
import { getAvailabilitySource } from "./availability-source.service.js";
import { formatAvailabilitySlot } from "./availability.service.js";

// Pete's booking bridge: only a direct customer request, never speculative
// scheduling or invented times. This does not make bookings or send messages.
export function isExplicitPeteCalendarRequest(text: string): boolean {
  const input = text.toLowerCase().trim();
  if (!input || input.length > 500) return false;
  if (/\b(?:kein(?:en)?|keine|absag\w*|stornier\w*|verschieb\w*|bereits gebucht|schon gebucht|hab(?:e)? gebucht|nicht buchen)\b/i.test(input)) return false;
  const bookingTopic = /\b(?:termine?|strategiegespr[aä]ch\w*|gespr[aä]ch\w*|telefonat\w*|telefonieren|calendly|freitag\w*|buchungslink|buchbar)\b/i.test(input);
  const questionOrIntent = /\b(?:frei\w*|verf[uü]gbar\w*|buch\w*|reservier\w*|ausmach\w*|vereinbar\w*|passt|zeit|wann|welche|welcher|kann|k[oö]nnte|hast|habt|m[oö]chte|will|w[uü]rde|gerne|gern|schick\w*|zeig\w*)\b/i.test(input);
  return bookingTopic && questionOrIntent;
}

export type PeteCalendarReply = {
  text: string;
  verifiedSlots: boolean;
  count: number;
};

export async function getPeteCalendlyBookingReply(params: {
  state: ConversationState;
  text: string;
  bookingUrl?: string;
}): Promise<PeteCalendarReply | null> {
  if (!isExplicitPeteCalendarRequest(params.text) || !params.bookingUrl) return null;
  // Only expose the actual Calendly booking destination configured for the
  // workspace; never attach arbitrary user-supplied provider URLs.
  let host: string;
  try { host = new URL(params.bookingUrl).hostname.toLowerCase(); }
  catch { return null; }
  if (host !== "calendly.com" && host !== "www.calendly.com") return null;

  const opening = "Gerne. ";
  const destination = "\n\nHier kannst du den passenden Termin direkt bei Calendly auswählen und buchen: " + params.bookingUrl;
  try {
    const result = await getAvailabilitySource({ campaignId: params.state.campaignId });
    const dated = result.mode === "calendar"
      ? result.slots.filter(slot => slot.date && slot.startAt).slice(0, 3)
      : [];
    if (dated.length) {
      return {
        text: opening + "Jochen hat laut Calendly aktuell diese freien 45-Minuten-Termine:\n" +
          dated.map(slot => "• " + formatAvailabilitySlot(slot)).join("\n") +
          "\n\nWelcher davon passt dir? Die Verfügbarkeit wird beim Buchen erneut geprüft." + destination,
        verifiedSlots: true,
        count: dated.length,
      };
    }
  } catch {
    // Provider failure never turns a stale weekly template into "free slots".
  }
  return {
    text: "Ich kann die aktuell freien Uhrzeiten gerade nicht zuverlässig bestätigen." +
      destination,
    verifiedSlots: false,
    count: 0,
  };
}
