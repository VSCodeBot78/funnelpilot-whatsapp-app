/** Untrusted action proposals from the ONE existing model call.
 * This module grants neither consent nor transport/booking/payment authority.
 * Destinations and host lists are supplied by trusted backend configuration.
 */
export type PeteNextStep = "none" | "offer_info" | "booking";
export type PeteNextStepProposal = { nextStep: PeteNextStep; evidenceQuote: string };
export type PeteNextStepContext = {
  lastUserText: string;
  owner?: "ai" | "human";
  aiPaused?: boolean;
  stopped?: boolean;
  handoffActive?: boolean;
  salesOptedOut?: boolean;
  noQuestionsRequested?: boolean;
  /** Derived by backend from an earlier real lead request and the last
   * assistant's availability question. Never browser/model supplied. */
  bookingRequestActive?: boolean;
  bookingUrl?: string;
  offerInfoUrl?: string;
  bookingHosts: readonly string[];
  offerInfoHosts: readonly string[];
};
export type PeteGuardedNextStep = {
  text: string;
  nextStep: Exclude<PeteNextStep, "none">;
  nextPhase?: "booking_offered";
  outboundAuthorized: false;
};

const norm = (s: string) => s.toLocaleLowerCase("de-DE").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/\s+/g, " ").trim();

export function isPeteBookingDeclined(text: string): boolean {
  const s = norm(text);
  return /\bkein(?:e|en)?\s+(?:(?:weiteren?|neuen?|telefonischen?|solchen?)\s+){0,3}(?:termin\w*|buchungslink|terminlink|kalenderlink|gesprach\w*|telefonat\w*|anruf\w*)\b/.test(s) ||
    /\b(?:bevor|ehe)\b.{0,90}\b(?:termin|gesprach|telefonat|telefonieren)\b/.test(s) ||
    /\berst\b.{0,65}\b(?:verstehen|klaren|besprechen|nachdenken|uberlegen)\b/.test(s) ||
    /\b(?:nicht|nie|niemals)\s+(?:(?:mehr|jetzt|gerade|telefonisch|mit\s+jochen)\s+){0,3}(?:telefonieren|anrufen|angerufen|sprechen|buchen)\b/.test(s) ||
    /\b(?:keine|nicht\s+genug)\s+zeit\b.{0,45}\b(?:termin|gesprach|telefonat|telefonieren)\b/.test(s) ||
    /\b(?:termin|gesprach|telefonat|buchungslink|terminlink)\b.{0,30}\b(?:will|mochte|brauche)\s+ich\s+nicht\b/.test(s) ||
    /\b(?:termin|gesprach|telefonat|buchungslink|terminlink|kalenderlink)\s+(?:(?:bitte|jetzt|heute|gerade|doch|lieber)\s+){0,3}nicht\b/.test(s) ||
    /\b(?:buchungslink|terminlink|kalenderlink)\b.{0,25}\bnicht\s+(?:schicken|senden|zeigen)\b/.test(s);
}

function isOfferDeclined(s: string): boolean {
  return /\b(?:keine\s+(?:weiteren?\s+)?(?:angebote|werbung|verkaufsnachrichten)|kein\s+verkauf|nichts\s+kaufen)\b/.test(s) ||
    /\b(?:will|mochte|brauche)\s+(?:ich\s+)?kein(?:en|e)?\s+(?:angebotslink|infolink|methodenlink|angebot)\b/.test(s);
}

function rejectsLinks(s: string): boolean {
  return /\bkein(?:en|e)?\s+(?:(?:weiteren?|neuen?|externen?|solchen?)\s+){0,3}(?:link|methodenlink|infolink|angebotslink)\b/.test(s) ||
    /\b(?:link|methodenlink|infolink|angebotslink)\s+(?:(?:bitte|jetzt|heute|gerade|lieber)\s+){0,3}nicht\s+(?:schicken|senden|zeigen)\b/.test(s);
}

/** High-precision free-text entry to the same guard, never a second engine. */
export function proposePeteNextStep(text: string): PeteNextStepProposal {
  const s = norm(text);
  const request = /\b(?:ich|wir)\s+(?:(?:wurde|wurden)\s+)?(?:will|wollen|mochte\w*|hatte\w*|hatten|ware\w*)\b|\b(?:bitte|gerne|gern|schick\w*|sende\w*|zeig\w*|gib|konnen\s+wir|konnten\s+wir|(?:kann|konnte)\w*\s+(?:ich|du)|wo\s+finde|wie\s+finde|wie\s+bekomme|wann\s+kann|wann\s+konnen)\b/.test(s);
  const bookingTopic = /\b(?:termin\w*|telefontermin|telefonat|telefonisch\w*|telefonieren|strategiegesprach|erstgesprach|buchungslink|terminlink|kalenderlink|kalender)\b/.test(s);
  const bookingQuestion = /\b(?:was|wie|warum|wieso|wie\s+lange)\b.{0,55}\b(?:passiert|lauft|ablauf|dauert|kostet|funktioniert|notwendig|pflicht)\b/.test(s) ||
    /\b(?:ablauf|dauer|pflichttermin|pflichtcall)\b/.test(s);
  const unrelatedAppointment = /\b(?:arzttermin|zahnarzt|arzt|zahnarzttermin|kinderarzt|therapeut\w*)\b/.test(s);
  const bookingAcceptance = bookingTopic && /\b(?:ware|ist|klingt)\b.{0,25}\b(?:super|gut|passend)\b/.test(s) &&
    !/\b(?:nicht|kein\w*)\b.{0,25}\b(?:super|gut|passend)\b/.test(s);
  if ((request || bookingAcceptance) && bookingTopic && !bookingQuestion && !unrelatedAppointment && !isPeteBookingDeclined(text)) {
    return { nextStep: "booking", evidenceQuote: text };
  }
  const browsing = /\b(?:anschauen|ansehen|angucken|nachlesen|durchlesen|nachschauen|informieren|in\s+ruhe\s+lesen)\b/.test(s);
  const offerTopic = /\b(?:angebot|paket|methode(?:nlink)?|begleitung|coaching|produkt|leistungen|info(?:s|link)?|seite|details|buchungsweg)\b/.test(s);
  const infoLinkRequest = /\b(?:schick\w*|sende\w*|zeig\w*|gib|wo\s+finde)\b.{0,65}\b(?:info(?:s|link)?|angebotslink|seite|details|methode(?:nlink)?)\b/.test(s) ||
    (request && /\b(?:info(?:s|link)?|angebotslink|seite|details|methode(?:nlink)?)\b.{0,45}\b(?:schicken|senden|zeigen)\b/.test(s));
  const browsePurchaseRoute = /\blass\s+mich\b.{0,35}\b(?:sehen|schauen|gucken)\b/.test(s) &&
    /\bwo\b.{0,40}\bbuchen\b/.test(s) && !bookingTopic;
  // An explicit inbound request for GENERAL information remains an information
  // request, never a booking or a new permission for sales follow-ups.
  const generalInfoLinkRequest = request && /\blink\b.{0,70}\binformation(?:en)?\b/.test(s) &&
    !rejectsLinks(s) &&
    !/\b(?:nicht|kein\w*)\b.{0,18}\blink\b/.test(s) &&
    !/\blink\b.{0,15}\bnicht\b/.test(s);
  if (((browsing && offerTopic && request) || infoLinkRequest || browsePurchaseRoute ||
        generalInfoLinkRequest) && !isOfferDeclined(s)) {
    return { nextStep: "offer_info", evidenceQuote: text };
  }
  return { nextStep: "none", evidenceQuote: "" };
}

export function isPeteNextStepProposal(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.nextStep === "string" && ["none", "offer_info", "booking"].includes(v.nextStep) &&
    typeof v.evidenceQuote === "string" && v.evidenceQuote.length <= 1500 &&
    (v.nextStep === "none" ? v.evidenceQuote === "" : v.evidenceQuote.trim().length >= 4);
}

function trustedUrl(raw: string | undefined, hosts: readonly string[]): string | null {
  if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password ||
        (url.port && url.port !== "443") || !hosts.includes(url.hostname.toLowerCase())) return null;
    return url.href;
  } catch { return null; }
}

export function guardPeteNextStep(proposal: PeteNextStepProposal, ctx: PeteNextStepContext): PeteGuardedNextStep | null {
  if (!isPeteNextStepProposal(proposal) || proposal.nextStep === "none" ||
      ctx.owner === "human" || ctx.aiPaused || ctx.stopped || ctx.handoffActive ||
      ctx.noQuestionsRequested) return null;
  // Exact quote of the LAST actual lead turn. Older turns, paraphrases, model
  // instructions, and confidence scores cannot grant action authority.
  if (!ctx.lastUserText.includes(proposal.evidenceQuote)) return null;
  const s = norm(ctx.lastUserText);
  if (isOfferDeclined(s) || rejectsLinks(s) || /^(?:stop|stopp)[.!\s]*$/.test(s) ||
      /\b(?:nicht\s+mehr\s+anschreiben|keine\s+nachrichten\s+mehr|lass\s+mich\s+in\s+ruhe)\b/.test(s)) return null;
  if (/\b(?:nextstep|evidencequote|systemanweisung|ignoriere|json|nur\s+ein\s+beispiel|als\s+zitat)\b/.test(s)) return null;
  // The model may select semantics, but cannot turn a negation, incidental
  // topic, medical appointment or quoted instruction into positive consent.
  const independent = proposePeteNextStep(ctx.lastUserText);
  // Persistent opt-out forbids unsolicited selling and booking. It does NOT
  // erase the person's right to request information in a NEW inbound message.
  // Require an independently verified positive information intent on exactly
  // this fresh user text; never clear or overwrite the persistent opt-out.
  if (ctx.salesOptedOut &&
      !(proposal.nextStep === "offer_info" && independent.nextStep === "offer_info"))
    return null;
  if (independent.nextStep !== proposal.nextStep) {
    // Additional semantic paraphrases are admitted only with a positive,
    // independently visible request/acceptance for this specific subject.
    const acceptance = /\b(?:klingt\s+(?:fur\s+mich\s+)?gut|ware\s+(?:fur\s+mich\s+)?(?:gut|passend|ein\s+guter\s+nachster\s+schritt)|bin\s+(?:jetzt\s+)?bereit|passt\s+(?:fur\s+mich|gut))\b/.test(s);
    const negatedAcceptance = /\b(?:nicht|kein\w*)\b.{0,25}\b(?:gut\w*|passend|bereit|moglich|option)\b/.test(s);
    const bookingTopic = /\b(?:telefonat|telefontermin|gesprach|strategiegesprach|termin|kalender)\b/.test(s);
    const infoTopic = /\b(?:angebotsinfo|angebotsseite|methode|paketdetails|produktinfo)\b/.test(s);
    const availability = proposal.nextStep === "booking" && ctx.bookingRequestActive === true &&
      /\b(?:abends|morgens|mittags|vormittags|nachmittags|montags?|dienstags?|mittwochs?|donnerstags?|freitags?|samstags?|sonntags?|wochenende|\d{1,2}(?::\d{2})?\s*uhr)\b/.test(s) &&
      !isPeteBookingDeclined(ctx.lastUserText);
    if (!availability && (!acceptance || negatedAcceptance ||
        (proposal.nextStep === "booking" ? (!bookingTopic || isPeteBookingDeclined(ctx.lastUserText) || /\b(?:arzt|zahnarzt|arzttermin|kinderarzt)\b/.test(s)) : !infoTopic))) return null;
  }
  if (proposal.nextStep === "booking") {
    const url = trustedUrl(ctx.bookingUrl, ctx.bookingHosts);
    if (!url) return null;
    return { nextStep: "booking", nextPhase: "booking_offered", outboundAuthorized: false,
      text: "Hier kannst du selbst einen Termin für ein Strategiegespräch mit Jochen auswählen: " + url +
        " Die verfügbaren Zeiten stehen im Kalender. Ein Termin ist erst nach der Buchungsbestätigung vereinbart." };
  }
  const url = trustedUrl(ctx.offerInfoUrl, ctx.offerInfoHosts);
  return url ? { nextStep: "offer_info", outboundAuthorized: false,
    text: "Hier kannst du dir Jochens Methode und die Begleitung in Ruhe anschauen: " + url } : null;
}
