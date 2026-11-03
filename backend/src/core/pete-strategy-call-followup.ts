/**
 * One verified owner strategy-call path for short DM replies.
 * Pure decision helper. The engine's STOP, medical and human-request guards
 * MUST run before this. Never infer availability or contract terms.
 */
import { OFFER_TRUTH } from "../config/offer-truth.js";
import type { ConversationState } from "../types/types.js";

export type VerifiedStrategyCallReply = { text: string; nextPhase?: string };

const normalized = (text: string) => text.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");

function isVerifiedOwnerBookingUrl(bookingUrl: string | undefined): boolean {
  if (!bookingUrl) return false;
  try {
    const actual = new URL(bookingUrl);
    const approved = new URL(OFFER_TRUTH.strategyCall.schedulingUrl);
    const trimSlash = (part: string) => part.replace(/\/$/, "");
    return actual.protocol === "https:" && actual.origin === approved.origin &&
      trimSlash(actual.pathname) === trimSlash(approved.pathname) &&
      !actual.username && !actual.password;
  } catch {
    return false;
  }
}

export function getPeteStrategyCallFollowUp(
  text: string, state: ConversationState, bookingUrl?: string,
): VerifiedStrategyCallReply | null {
  const input = normalized(text).trim();
  if (!input || input.length > 180) return null;
  const latestAssistant = [...(state.messages ?? [])].reverse()
    .find(message => message.role === "assistant");
  const earlier = normalized(latestAssistant?.text ?? "");
  // Only a genuine invitation in the immediately preceding assistant turn.
  // A stray mention of "call" earlier must never initiate booking.
  const offered = /\b(?:strategiegesprach|kennenlerngesprach|erstgesprach)\b/.test(earlier) &&
    /\b(?:mochtest|willst|ware|passt|interesse|termin|buchen|aussuchen|auswahlen)\b/.test(earlier);
  if (!offered) return null;

  // Coaching price questions and explicit no/STOP are not booking consent.
  if (/\b(?:selbststarter|coachingpreis|5[\s-]*wochen|499|ratenzahlung|monatsrate)\b/.test(input)) {
    return null;
  }
  if (/\b(?:nein|kein(?:en|e)?\s+(?:termin|gesprach|call)|doch nicht|lieber nicht|noch nicht|nicht jetzt|nur infos|nur schauen|vielleicht spater|erstmal nicht|keine nachrichten)\b/.test(input)) {
    return null;
  }

  const costQuestion =
    /\b(?:kostet|kosten|preis|teuer|kostenlos|gratis|kostenpflichtig|zahlen|bezahl\w*|gebuhr\w*)\b/.test(input) &&
    /\b(?:das|es|dafur|gesprach|strategiegesprach|kennenlerngesprach|erstgesprach|termin|call)\b/.test(input);
  const acceptance =
    /\b(?:ja|jo|klar|gerne|gern|okay|ok|passt|klingt gut|warum nicht|auf jeden fall)\b/.test(input) ||
    /\b(?:wenn|sofern)\s+es\s+unverbindlich\s+ist\b/.test(input);
  if (!costQuestion && !acceptance) return null;

  if (!isVerifiedOwnerBookingUrl(bookingUrl)) {
    return { text: "Gern. Den passenden Kalenderlink kann ich gerade nicht sicher prüfen. Ich möchte dir keinen falschen Termin nennen.", nextPhase: "info" };
  }
  if (OFFER_TRUTH.strategyCall.calendlyBookingRequiresPayment !== false) return null;

  if (costQuestion && !acceptance) {
    return {
      text: "Für die Terminbuchung ist keine Zahlung nötig. Hier kannst du dir einen Termin aussuchen: " + bookingUrl,
      nextPhase: "booking_offered",
    };
  }
  return {
    text: "Klar. Die Terminbuchung kostet nichts und ist noch keine Coaching-Buchung. Wann passt es dir am besten? " + bookingUrl,
    nextPhase: "booking_offered",
  };
}
