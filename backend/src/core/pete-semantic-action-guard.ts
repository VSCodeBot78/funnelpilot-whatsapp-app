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

export function isPeteBookingCancellationRequest(text: string): boolean {
  return /\b(?:termin\w*|buchung)\b.{0,45}\b(?:absagen|abzusagen|stornier\w*|verschieb\w*)\b/.test(norm(text));
}

export function isPeteBookingDeclined(text: string): boolean {
  const s = norm(text);
  return isPeteBookingCancellationRequest(text) ||
    /\bkein(?:e|en)?\s+(?:(?:weiteren?|neuen?|telefonischen?|solchen?|freien?|verfugbaren?|bestatigten?)\s+){0,3}(?:termin\w*|buchungslink|terminlink|kalenderlink|gesprach\w*|telefonat\w*|anruf\w*)\b/.test(s) ||
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

/** Only classify positive requests to *see* a verified calendar URL. */
function isPeteRejectedOrHypotheticalLink(s: string): boolean {
  return /\b(?:theoretisch|hypothetisch|angenommen|als\s+beispiel|nur\s+ein\s+beispiel)\b/.test(s) ||
    /\b(?:wenn|falls)\s+(?:ich|wir)\b.{0,100}\b(?:wollte\w*|wurde\w*|hatte\w*|konnte\w*)\b/.test(s) ||
    /\b(?:nicht|kein\w*)\s+(?:(?:mehr|bitte|den|einen|diesen)\s+){0,3}(?:link|kalender|terminkalender|buchungslink|terminlink|kalenderlink|buchungsseite)\b/.test(s) ||
    /\b(?:nicht|kein\w*)\s+(?:mehr\s+)?(?:zu\s*)?(?:schick\w*|send\w*|zeig\w*)\b/.test(s) ||
    /\b(?:link|kalender|buchungsseite)\b.{0,28}\b(?:nicht|kein\w*)\s+(?:zu\s*)?(?:schick\w*|send\w*|zeig\w*)\b/.test(s) ||
    /\bnicht\s+wo\b.{0,90}\b(?:buchungslink|terminlink|kalenderlink|buchungsseite|terminkalender)\b/.test(s) ||
    /\b(?:buchungslink|terminlink|kalenderlink|buchungsseite)\b.{0,60}\b(?:nicht|kein\w*)\s+(?:(?:mehr|wirklich|haben|bekommen)\s+)?(?:mochte\w*|brauche\w*|will|haben|bekommen)\b/.test(s) ||
    /\bohne\b.{0,42}\b(?:ihn|link|kalenderlink|buchungslink)\b.{0,20}\b(?:zu\s+)?(?:bekommen|erhalten|sehen)\b/.test(s);
}
function hasPeteExplicitBookingWish(s: string): boolean {
  return /\b(?:(?:ich|wir)\s+(?:(?:jetzt|direkt|gern|gerne|bitte)\s+)?(?:will|wollen|mochte\w*|wurde\w*|hatte\w*|brauche\w*)|(?:will|wollen|mochte\w*|wurde\w*|hatte\w*|brauche\w*)\s+(?:ich|wir))\b.{0,55}\b(?:einen?\s+(?:telefon)?termin|ein\s+(?:gesprach|telefonat))\b/.test(s);
}
function isPetePassiveBookingLinkRequest(s: string): boolean {
  const urlWords = /\b(?:buchungslink|terminlink|kalenderlink|terminkalender|buchungsseite|kalender)\b/;
  const lookup = /\b(?:wo|wohin|auf\s+welcher|wie\s+komme|wie\s+finde|wie\s+gelange)\b.{0,85}\b(?:buchungslink|terminlink|kalenderlink|terminkalender|buchungsseite|kalender)\b/.test(s) ||
    /\b(?:schick\w*|sende\w*|zeig\w*|gib)\b.{0,40}\b(?:buchungslink|terminlink|kalenderlink|terminkalender|kalender)\b/.test(s) ||
    /\b(?:wie\s+(?:kann|konnte)\s+ich|(?:kann|konnte)\s+ich)\b.{0,75}\b(?:kalender|terminkalender|buchungsseite)\b.{0,55}\b(?:ansehen|anschauen|durchsehen|sehen|offnen)\b/.test(s) ||
    /\b(?:kannst|konntest|konnte|kann)\b.{0,75}\b(?:buchungslink|terminlink|kalenderlink|terminkalender)\b.{0,24}\b(?:schick\w*|send\w*|zeig\w*)\b/.test(s) ||
    /\b(?:gibt\s+es|hast\s+du|kann\s+ich)\b.{0,55}\b(?:buchungslink|terminlink|kalenderlink|buchungsseite|terminkalender)\b/.test(s) ||
    (/\bkalender\b.{0,70}\b(?:wo\s+(?:ware|ist)|wie\s+finde)\b.{0,35}\blink\b/.test(s) && urlWords.test(s));
  const explicitBookingVerb = (hasPeteExplicitBookingWish(s) &&
    /\b(?:termin|telefontermin|gesprach|telefonat)\b.{0,45}\b(?:buchen|vereinbaren|ausmachen)\b/.test(s)) ||
    /\b(?:bitte|jetzt)\s+(?:einen?\s+)?(?:termin|gesprach|telefonat)\s+(?:buchen|vereinbaren|ausmachen)\b/.test(s);
  const activeBooking = explicitBookingVerb || hasPeteExplicitBookingWish(s);
  // Only offer Jochen's calendar. Foreign/personal appointment resources
  // and discussions of viewing an appointment are not a booking consent.
  const personalCalendar = /\b(?:mein(?:e|en|em|er)?|unser(?:e|en|em|er)?|kita|schule|dienstplan)\b.{0,18}\bkalender\b|\bfamilienkalender\b/.test(s);
  const unrelatedCalendar = /\b(?:kalender|terminkalender)\b.{0,25}\b(?:fur\s+(?:die|den|das|meine|meinen|unseren)?\s*)?(?:schule|elternabend|kita|friseur|frisor|frisur|arzt|zahnarzt)\b/.test(s) ||
    /\b(?:buchungslink|terminlink|kalenderlink)\b.{0,30}\b(?:fur|zum|beim)\s+(?:(?:den|die|das|meinen|unsere)\s+)?(?:arzt|zahnarzt|friseur|frisor|frisur|kita|schule|elternabend)\b/.test(s) ||
    /\b(?:arzttermin|zahnarzttermin|kinderarzttermin)\b/.test(s);
  const viewingOnly = /\b(?:termin|kalender|buchungsseite|termine)\b.{0,28}\b(?:nur\s+)?(?:ansehen|anschauen|durchsehen|durchschauen)\b/.test(s) ||
    /\b(?:nur|erst|zuerst|vorher|unverbindlich)\b.{0,45}\b(?:ansehen|anschauen|durchsehen|durchschauen)\b/.test(s);
  const speculative = /\b(?:spater|irgendwann|vielleicht|eventuell|unter\s+umstanden)\b/.test(s) &&
    !/\b(?:jetzt|direkt|heute)\b/.test(s);
  return lookup && (!activeBooking || speculative || (viewingOnly && !explicitBookingVerb)) &&
    !personalCalendar && !unrelatedCalendar && !isPeteUnrelatedCalendarRequest(s) &&
    !isPeteRejectedOrHypotheticalLink(s);
}
/** Unrelated calendars are NEVER authority for Pete booking actions. */
function isPeteUnrelatedCalendarRequest(s: string): boolean {
  const directJochenBooking = hasPeteExplicitBookingWish(s) &&
    /\b(?:termin|telefontermin|telefonat|gesprach)\b.{0,45}\b(?:buchen|vereinbaren|ausmachen)\b/.test(s) &&
    /\b(?:termin|telefontermin|telefonat|gesprach)\b.{0,25}\bmit\s+jochen\b|\bmit\s+jochen\b.{0,30}\b(?:termin|telefontermin|telefonat|gesprach)\b|\b(?:strategiegesprach|erstgesprach)\b/.test(s);
  if (directJochenBooking) return false;
  return /\b(?:mein(?:e|en|em|er)?|unser(?:e|en|em|er)?|familien|schul|kita|dienst|arbeits)\s*(?:kalender|terminkalender|kalenderlink|buchungslink)\b/.test(s) ||
    /\b(?:termin\w*|gesprach|telefonat)\b.{0,40}\b(?:fur|von|vom|zum|bei|beim|in)\b.{0,25}\b(?:schule|elternabend|kita|friseur|frisor|frisur|arzt|zahnarzt|kinderarzt)\b/.test(s) ||
    /\b(?:kalender|terminkalender|buchungslink|terminlink|kalenderlink|buchungsseite)\b.{0,55}\b(?:fur|von|vom|zum|bei|aus)\b.{0,35}\b(?:schule|elternabend|kita|friseur|frisor|frisur|arzt|zahnarzt|kinderarzt)\b/.test(s) ||
    /\b(?:schule|elternabend|kita|friseur|frisor|frisur|arzt|zahnarzt|kinderarzt)\b.{0,55}\b(?:kalender|terminkalender|buchungslink|terminlink|kalenderlink|buchungsseite)\b/.test(s);
}
/** High-precision free-text entry to the same guard, never a second engine. */
export function proposePeteNextStep(text: string): PeteNextStepProposal {
  const s = norm(text);
  const request = /\b(?:ich|wir)\s+(?:(?:wurde|wurden)\s+)?(?:will|wollen|mochte\w*|hatte\w*|hatten|ware\w*)\b|\b(?:bitte|gerne|gern|schick\w*|sende\w*|zeig\w*|gib|konnen\s+wir|konnten\s+wir|(?:kann|konnte)\w*\s+(?:ich|du)|wo\s+finde|wie\s+finde|wie\s+bekomme|wann\s+kann|wann\s+konnen)\b/.test(s);
  const bookingTopic = /\b(?:termin\w*|telefontermin|telefonat|telefonisch\w*|telefonieren|strategiegesprach|erstgesprach|buchungslink|terminlink|kalenderlink|kalender|terminkalender|buchungsseite)\b/.test(s);
  const bookingQuestion = /\b(?:was|wie|warum|wieso|wie\s+lange)\b.{0,55}\b(?:passiert|lauft|ablauf|dauert|kostet|funktioniert|notwendig|pflicht)\b/.test(s) ||
    /\b(?:ablauf|dauer|pflichttermin|pflichtcall)\b/.test(s);
  const unrelatedAppointment = /\b(?:arzttermin|zahnarzt|arzt|zahnarzttermin|kinderarzt|therapeut\w*)\b/.test(s);
  const bookingAcceptance = bookingTopic && /\b(?:ware|ist|klingt)\b.{0,25}\b(?:super|gut|passend)\b/.test(s) &&
    !/\b(?:nicht|kein\w*)\b.{0,25}\b(?:super|gut|passend)\b/.test(s);
  // A neutral question about where the calendar/link is does not authorize a booking
  // status, automated follow-up, or a promise of an available appointment.
  const asksWhereLinkIs = isPetePassiveBookingLinkRequest(s);
  if ((request || hasPeteExplicitBookingWish(s) || bookingAcceptance || asksWhereLinkIs) && bookingTopic && !bookingQuestion &&
      !unrelatedAppointment && !isPeteBookingDeclined(text) &&
      !isPeteRejectedOrHypotheticalLink(s) && !isPeteUnrelatedCalendarRequest(s)) {
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
  if (proposal.nextStep === "booking" &&
      (isPeteRejectedOrHypotheticalLink(s) || isPeteUnrelatedCalendarRequest(s) ||
       isPeteBookingDeclined(ctx.lastUserText))) return null;
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
    if (isPetePassiveBookingLinkRequest(s)) {
      // Link-only reply: NO nextPhase, NO wantsBooking, NO providerBooking,
      // NO linkSentAt, NO booking reminder. Engine changes state only for
      // the explicit booking_offered phase; retain every guard above.
      return { nextStep: "booking", outboundAuthorized: false,
        text: "Den Terminkalender findest du hier: " + url +
          " Die dort verfügbaren Zeiten kannst du unverbindlich ansehen." };
    }
    return { nextStep: "booking", nextPhase: "booking_offered", outboundAuthorized: false,
      text: "Hier kannst du selbst einen Termin für ein Strategiegespräch mit Jochen auswählen: " + url +
        " Die verfügbaren Zeiten stehen im Kalender. Ein Termin ist erst nach der Buchungsbestätigung vereinbart." };
  }
  const url = trustedUrl(ctx.offerInfoUrl, ctx.offerInfoHosts);
  return url ? { nextStep: "offer_info", outboundAuthorized: false,
    text: "Hier kannst du dir Jochens Methode und die Begleitung in Ruhe anschauen: " + url } : null;
}
