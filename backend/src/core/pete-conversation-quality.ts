/**
 * Pete's dialogue policy.
 *
 * Trusted transaction facts and genuine safety remain deterministic.
 * A generic mention of "Termin", "Preis" or "Coaching" in a longer
 * question MUST NOT divert the entire answer into the legacy questionnaire.
 */
import { OFFER_TRUTH, isUnverifiedLongTermPriceQuestion,
  LONG_TERM_PRICE_UNVERIFIED_REPLY } from "../config/offer-truth.js";
import type { ConversationState } from "../types/types.js";

export type PeteVerifiedAnswer = {
  text: string;
  handoff?: boolean;
  nextPhase?: string;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");

const has = (s: string, regex: RegExp) => regex.test(norm(s));

export function getPeteVerifiedTransactionAnswer(
  text: string, state: ConversationState, bookingUrl?: string,
): PeteVerifiedAnswer | null {
  const input = norm(text);
  const asksVerifiedStatus =
    /\b(?:bestatigt|bestatigung|verifiziert|wirklich gebucht|tatsachlich gebucht|sicher gebucht|angekommen|zahlungseingang|habe bezahlt|hab bezahlt|zugang fehlt|bestellung|kaufbeleg|abbuchung)\b/.test(input) &&
    /\b(?:termin|kalender|calendly|buchung|gebucht|zahlung|bezahlt|gekauft|bestellung|zugang|kauf|rechnung|bezahlen)\b/.test(input);
  const payment = /\b(?:bezahlt|zahlung|abbuchung|rechnung|kaufbeleg|bestellung|gekauft|zugang fehlt|zahlungseingang)\b/.test(input);
  const booking = /\b(?:termin|gebucht|kalender|calendly|buchung)\b/.test(input);

  // Verification wins over any past sales choice. Never use user testimony
  // as proof of a transaction.
  if (asksVerifiedStatus) {
    if (payment) {
      return {
        text: "Ob deine Zahlung eingegangen ist, kann ich im Chat nicht verlässlich prüfen. Ich gebe den Vorgang an Jochen zur persönlichen Prüfung weiter. Eine Bestätigung wäre sonst geraten.",
        handoff: true,
      };
    }
    if (booking) {
      return state.providerBooking?.status === "booked"
        ? { text: "Der Termin ist im angebundenen Buchungssystem bestätigt." }
        : {
          text: "Ich sehe hier keine verifizierte Buchungsbestätigung. Eine eigene Nachricht reicht dafür nicht. Prüfe bitte deine Bestätigung vom Buchungssystem. Falls etwas nicht stimmt, klärt Jochen das persönlich.",
          handoff: true,
        };
    }
  }

  // Identical concern, even without exact "confirmed" vocabulary.
  if (/\b(?:hab|habe)\s+(?:einen\s+)?termin\s+gebucht\b/.test(input) ||
      /\b(?:hab|habe)\s+gebucht\b/.test(input)) {
    return state.providerBooking?.status === "booked"
      ? { text: "Der Termin ist im angebundenen Buchungssystem bestätigt." }
      : { text: "Deine Nachricht allein bestätigt die Buchung noch nicht. Bitte prüf die Buchungsbestätigung. Wenn sie fehlt, kann Jochen das persönlich klären." };
  }

  // Fearing checkout extras is a factual trust question, not proof of a
  // purchase or an invitation to make unverified "no extra charges" claims.
  if (/\b(?:versteckte kosten|versteckte gebuhren|zusatzkosten|ungewollte extras|versteckte extras|unerwartete gebuhren)\b/.test(input)) {
    return {
      text: "Du sollst vor dem Kauf wissen, was du bezahlst. Verbindlich kann ich dir hier nur die ausgewiesenen Einstiegspreise nennen. Ob weitere Bedingungen gelten, prüf bitte in der Kaufübersicht oder lass sie von Jochen klären. Ich verspreche dir keine ungeprüften Zusatzkosten-Regeln.",
    };
  }

  // A lead's own claim is not a verified payment; missing access requires
  // actual owner intervention, even if the user's wording is elliptical.
  if (/\b(?:zahlung|bezahlt|gekauft|bestellung|kauf)\b/.test(input) &&
      /\b(?:zugang|freischaltung|freigeschaltet|login)\b/.test(input) &&
      /\b(?:fehlt|vermisst|nicht erhalten|nicht bekommen|pruf\w*|problem)\b/.test(input)) {
    return {
      text: "Das sollte niemand raten: Ob die Zahlung angekommen ist und warum der Zugang fehlt, muss anhand der tatsächlichen Bestellung geprüft werden. Ich gebe den Vorgang an Jochen weiter, ohne den Kauf als bestätigt zu markieren.",
      handoff: true,
    };
  }

  if (isUnverifiedLongTermPriceQuestion(text)) {
    return { text: LONG_TERM_PRICE_UNVERIFIED_REPLY, nextPhase: "longterm_unverified" };
  }
  const explicitPrice = has(text,
    /\b(?:was kostet|wie teuer|wieviel kostet|wie viel kostet|preis fur|preis von|nenn mir den preis|preis bitte|preis\?|kosten\?|monatsrate|ratenzahlung)\b/);
  const specificSelfstarter = /\b(?:selbststarter|buch)\b/.test(input);
  const specificCoaching = /\b(?:5.?wochen|funf wochen|coaching|startphase|begleitung)\b/.test(input);
  const substantiveQuestion = /\b(?:wie unterscheid|was ist anders|wie funktioniert|was bekomme|was enthalt|was beinhaltet|was ist drin|wie geht es|warum|wie genau|wie vereinbar|wie hilft)\b/.test(input);
  // Combined "explain the offer and its cost" should not become a price
  // interrogation. Answer price if verified, then let Pete explain the rest.
  if (explicitPrice && !substantiveQuestion) {
    if (specificSelfstarter) {
      return { text: "Der Selbststarter kostet " + OFFER_TRUTH.selfstarter.priceText +
        ". Das ist der eigenständige Einstieg. Die Produktseite enthält die genauen Inhalte: " +
        OFFER_TRUTH.selfstarter.productUrl };
    }
    if (specificCoaching) {
      return { text: "Die persönliche 5-Wochen-Startphase kostet " +
        OFFER_TRUTH.coachingEntry.priceText +
        ". Sie verbindet Bewegung, Ernährung, Schlaf und Alltag. Über individuelle Zusatzleistungen oder Raten kann ich hier nichts verbindlich zusagen." };
    }
    if (/\b(?:monatsrate|ratenzahlung)\b/.test(input)) {
      return { text: "Ob Ratenzahlung möglich ist, ist hier nicht verbindlich bestätigt. Das muss Jochen persönlich klären." };
    }
    return { text: "Für den eigenständigen Einstieg gibt es den Selbststarter für " +
      OFFER_TRUTH.selfstarter.priceText + ". Der persönliche Einstieg über fünf Wochen kostet " +
      OFFER_TRUTH.coachingEntry.priceText +
      ". Wenn du eine bestimmte Variante meinst, sag mir welche." };
  }

  const resourceRequest = /\b(?:schick|sende|link|download|wo finde|wo bekomme|her damit)\b/.test(input);
  if (resourceRequest && /\b(?:keto.?guide|keto.?pdf|keto.?anleitung)\b/.test(input)) {
    return { text: "Hier ist Jochens kostenloser Keto Guide mit PDF und Audio: " +
      OFFER_TRUTH.resources.ketoGuide.url };
  }
  if (resourceRequest && /\b(?:eltern.?check|fitness.?check)\b/.test(input)) {
    return { text: "Hier ist der kostenlose Elternfitness-Check: " +
      OFFER_TRUTH.resources.elterncheck.url };
  }
  if (/\b(?:buchungslink|terminlink|calendly.?link|strategiegesprach buchen)\b/.test(input) &&
      !/\b(?:nicht|kein|ohne|erstmal nicht|lieber hier)\b/.test(input)) {
    return bookingUrl?.startsWith("https://")
      ? { text: "Hier kannst du einen Termin für ein Strategiegespräch auswählen: " + bookingUrl,
          nextPhase: "booking_offered" }
      : { text: "Ich kann dir hier keinen verifizierten Buchungslink nennen. Jochen kann dir den richtigen Weg zeigen.", handoff: true };
  }

  // A generic mention of "price", "book", "appointment" or "Jochen"
  // without a concrete verified transaction stays with the LLM.
  return null;
}

/**
 * The old keyword safety detector handles medical emergencies. Its
 * "diagnose", "arzt", "schwangerschaft" tokens sometimes flag a NEGATED
 * diagnostic request or a historical pregnancy as critical. Narrow relief
 * requires an unambiguously general question and no other red flags.
 */
export function isGeneralNonMedicalKnowledgeRequest(text: string): boolean {
  const input = norm(text);
  if (/\b(?:brustschmerz|atemnot|schwindel|ohnmacht|insulin|medikament|schwanger\b|schwangerschaftsdiabetes|typ.?1|essstorung|essanfall|selbstverletz|suizid|krebs|blutung|dosierung|krankheit|therapie|schmerz\w*|tabletten|entzundung|fieber|blutungen|akut\w*|behandlung|diagnose)\b/.test(input))
    return false;
  if (/\b(?:nach der schwangerschaft|nach schwangerschaft|seit der geburt|nach der geburt)\b/.test(input) &&
      /\b(?:trainier\w*|abnehm\w*|gewicht\w*|energie|fitness|bewegung|nehme\w*|nimmt)\b/.test(input)) return true;
  if (/\b(?:ohne (?:eine )?(?:medizinische )?(?:fern)?diagnose|keine ferndiagnose)\b/.test(input) &&
      /\b(?:evidenz|studien|wissenschaft|allgemein|training|ernahrung|schlaf|stoffwechsel)\b/.test(input)) return true;
  if (/\b(?:blutwerte|arzt|arztlich)\b/.test(input) &&
      /\b(?:schon|bereits)\b/.test(input) && /\b(?:kontrolliert|untersucht)\b/.test(input) &&
      !/\b(?:was bedeuten meine werte|diagnostizier|behandlung|dosis)\b/.test(input)) return true;
  return false;
}

export function isUnsafeLlmClaim(reply: string): boolean {
  const input = norm(reply);
  // User's desire for a human is not proof that Pete is that human.
  if (/\b(?:ich antworte personlich|ich bleibe personlich|ich bleibe hier[^.?!]{0,90}antworte personlich|du schreibst (?:direkt )?mit jochen|ich bin jochen|(?:das kenne ich (?:gut|selbst)|ich kenne das (?:gut|aus eigener erfahrung))|ich habe selbst (?:kinder|erlebt))\b/.test(input)) return true;
  // Never claim that an unverified commerce or cross-channel infrastructure
  // guarantee is already in force.
  if (/\b(?:keine versteckten kosten|keine extras|alles verbindlich|ohne zusatzgebuhren|garantiert keine doppelantworten|ohne automatische antworten|ohne automatische nachsendungen|keine doppelantworten|alles basiert auf echten informationen|zahlung (?:ist|wurde) verifiziert)\b/.test(input)) return true;
  return false;
}

/** Typography cleanup must never introduce a stray dot in the sentence. */
export function normalizePeteReplyStyle(reply: string): string {
  return reply
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*[,.;]/g, ".")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
