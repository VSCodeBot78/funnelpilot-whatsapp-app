import { getMatchedPricingIntent } from "../domain/pricing-rules.js";
import type {
  IntentDetectionResult,
  LeadIntent,
  PriceIntentSubtype,
  PriceIntentTone,
} from "../types/types.js";

const STOP_KEYWORDS = [
  "stop",
  "stopp",
  "abbrechen",
  "kein interesse",
  "kein interesse mehr",
  "bitte nicht mehr",
  "nicht mehr schreiben",
  "lass mich in ruhe",
  "bitte keine nachrichten mehr",
];

const INFO_LINK_ONLY_KEYWORDS = [
  "schick link",
  "schick mir den link",
  "send mir den link",
  "sende mir den link",
  "ich will erstmal lesen",
  "ich will erst lesen",
  "ich will nur lesen",
  "ich schau erstmal",
  "ich möchte erstmal schauen",
  "ich will erstmal schauen",
  "einfach infos schicken",
  "schick infos",
  "schick mir infos",
  "nur den link",
  "nur infos",
  "erstmal nur infos",
];

const INFO_ONLY_KEYWORDS = [
  "erstmal infos",
  "erst mal infos",
  "ich will infos",
  "ich möchte infos",
  "mehr infos",
  "mehr informationen",
  "ich hätte gern infos",
  "ich hätte gerne infos",
  "kannst du mir infos schicken",
  "will erstmal nur infos",
];

const BOOKING_KEYWORDS = [
  "termin",
  "gespräch",
  "gespraech",
  "austausch",
  "telefonieren",
  "call",
  "lass uns sprechen",
  "lass uns telefonieren",
  "wann passt",
  "vormittags",
  "nachmittags",
  "passt vormittags",
  "passt nachmittags",
];

const PRICE_INFO_KEYWORDS = [
  "was kostet",
  "was kostet das",
  "was kostet das jetzt",
  "was kostet es",
  "wie viel kostet",
  "wie viel kostet das",
  "wieviel kostet",
  "wieviel kostet das",
  "wie teuer ist das",
  "preis",
  "kosten",
  "was kostet die startphase",
  "was kostet das überhaupt",
  "was muss ich investieren",
  "was muss man investieren",
  "was kostet mich das",
  "was kostet der spaß",
  "was kostet der spass",
  "was ist dein honorar",
  "honorar",
  "investieren",
  "investment",
];

const PRICE_OBJECTION_KEYWORDS = [
  "zu teuer",
  "ist mir zu teuer",
  "zu viel",
  "ist mir zu viel",
  "kann ich mir nicht leisten",
  "kann ich mir gerade nicht leisten",
  "kann ich mir grad nicht leisten",
  "kann ich mir aktuell nicht leisten",
  "grad nicht leisten",
  "gerade nicht leisten",
  "zu teuer für mich",
  "ist mir ehrlich gesagt zu teuer",
  "puh zu teuer",
  "im moment zu teuer",
  "momentan zu teuer",
  "ui",
  "uff",
  "puh",
  "boah",
  "boa",
  "oha",
  "hui",
  "uiuiui",
  "ui schon viel",
  "uff schon viel",
  "puh schon viel",
  "boah schon viel",
  "mmh schon viel",
  "mm schon viel",
  "ui zu teuer",
  "uff zu teuer",
  "puh zu teuer",
  "boah zu teuer",
  "schon viel",
  "ganz schön viel",
  "ganz schoen viel",
  "echt viel",
  "ordentlich viel",
  "ist schon viel",
  "ganz schön teuer",
  "ganz schoen teuer",
  "schon teuer",
  "echt teuer",
  "sportlich",
  "heftig",
  "nicht ohne",
  "stolz",
  "mmh ganz schön viel",
  "mhm ganz schön viel",
  "uiui",
  "ufff",
];

const PRICE_TEST_KEYWORDS = [
  "sag mir einfach was es kostet",
  "sag einfach was es kostet",
  "sag doch einfach was das kostet",
  "bevor ich hier weiterschreibe will ich den preis wissen",
  "bevor wir weitermachen will ich den preis wissen",
  "wenn das wieder 3000 euro kostet können wir es lassen",
  "dann sag doch erstmal den preis",
  "sag mir den preis",
  "sag schon den preis",
  "ich will jetzt den preis wissen",
  "sag mir jetzt den preis",
  "nein sag mir den preis jetzt",
  "sag schon",
  "preis jetzt",
  "sag mir jetzt dein preis",
  "sag mir jetzt den preis bitte",
];

const AGGRESSIVE_PRICE_WORDING = [
  "einfach",
  "doch einfach",
  "jetzt",
  "endlich",
  "bevor wir weitermachen",
  "bevor ich weiter schreibe",
  "können wir es lassen",
  "koennen wir es lassen",
  "sag schon",
  "sag jetzt",
  "jetzt bitte",
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyKeyword(input: string, keywords: string[]): string | null {
  const normalized = normalizeText(input);

  for (const keyword of keywords) {
    if (normalized.includes(normalizeText(keyword))) {
      return keyword;
    }
  }

  return null;
}

function detectPriceIntentSubtype(input: string): {
  subtype: PriceIntentSubtype;
  tone: PriceIntentTone;
  matchedText?: string;
} | null {
  const normalized = normalizeText(input);

  const testMatch = includesAnyKeyword(normalized, PRICE_TEST_KEYWORDS);
  if (testMatch) {
    return {
      subtype: "price_test",
      tone: "direct",
      matchedText: testMatch,
    };
  }

  const objectionMatch = includesAnyKeyword(normalized, PRICE_OBJECTION_KEYWORDS);
  if (objectionMatch) {
    return {
      subtype: "price_objection",
      tone: "resistant",
      matchedText: objectionMatch,
    };
  }

  const infoMatch = includesAnyKeyword(normalized, PRICE_INFO_KEYWORDS);
  if (infoMatch) {
    const tone: PriceIntentTone = includesAnyKeyword(
      normalized,
      AGGRESSIVE_PRICE_WORDING,
    )
      ? "direct"
      : "neutral";

    return {
      subtype: "price_info",
      tone,
      matchedText: infoMatch,
    };
  }

  return null;
}

function buildIntentResult(
  intent: LeadIntent,
  confidence: number,
  matchedText?: string,
  extras?: Partial<IntentDetectionResult>,
): IntentDetectionResult {
  return {
    intent,
    confidence,
    matchedText,
    ...extras,
  };
}

/**
 * Prioritäten:
 * 1. stop
 * 2. installments
 * 3. long_term_support
 * 4. direct_buy_starter
 * 5. price_question
 * 6. info_link_only
 * 7. info_only
 * 8. booking_intent
 * 9. unknown
 */
export function detectLeadIntent(input: string): IntentDetectionResult {
  const normalized = normalizeText(input);

  if (!normalized) {
    return buildIntentResult("unknown", 0);
  }

  const stopMatch = includesAnyKeyword(normalized, STOP_KEYWORDS);
  if (stopMatch) {
    return buildIntentResult("stop", 0.99, stopMatch);
  }

  const pricingIntent = getMatchedPricingIntent(normalized);

  if (pricingIntent.intent === "installments") {
    return buildIntentResult("installments", 0.98, pricingIntent.matchedText);
  }

  if (pricingIntent.intent === "long_term_support") {
    return buildIntentResult("long_term_support", 0.97, pricingIntent.matchedText);
  }

  if (pricingIntent.intent === "direct_buy_starter") {
    return buildIntentResult("direct_buy_starter", 0.96, pricingIntent.matchedText);
  }

  const priceSubtype = detectPriceIntentSubtype(normalized);
  if (priceSubtype) {
    let confidence = 0.95;

    if (priceSubtype.subtype === "price_test") {
      confidence = 0.97;
    } else if (priceSubtype.subtype === "price_objection") {
      confidence = 0.96;
    }

    return buildIntentResult("price_question", confidence, priceSubtype.matchedText, {
      priceSubtype: priceSubtype.subtype,
      priceTone: priceSubtype.tone,
    });
  }

  if (pricingIntent.intent === "price_question") {
    return buildIntentResult("price_question", 0.94, pricingIntent.matchedText, {
      priceSubtype: "price_info",
      priceTone: "neutral",
    });
  }

  const infoLinkOnlyMatch = includesAnyKeyword(normalized, INFO_LINK_ONLY_KEYWORDS);
  if (infoLinkOnlyMatch) {
    return buildIntentResult("info_link_only", 0.93, infoLinkOnlyMatch);
  }

  const infoOnlyMatch = includesAnyKeyword(normalized, INFO_ONLY_KEYWORDS);
  if (infoOnlyMatch) {
    return buildIntentResult("info_only", 0.9, infoOnlyMatch);
  }

  const bookingMatch = includesAnyKeyword(normalized, BOOKING_KEYWORDS);
  if (bookingMatch) {
    return buildIntentResult("booking_intent", 0.88, bookingMatch);
  }

  return buildIntentResult("unknown", 0.1);
}

export function isHighPriorityIntent(intent: LeadIntent): boolean {
  return (
    intent === "stop" ||
    intent === "installments" ||
    intent === "long_term_support" ||
    intent === "direct_buy_starter" ||
    intent === "price_question" ||
    intent === "info_link_only" ||
    intent === "info_only" ||
    intent === "booking_intent"
  );
}
