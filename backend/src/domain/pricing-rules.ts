import { getCampaignById } from "../config/campaigns.js";
import type { CampaignConfig, LeadIntent } from "../types/types.js";

const INSTALLMENT_KEYWORDS = [
  "ratenzahlung",
  "rate",
  "raten",
  "in raten",
  "monatlich",
  "abzahlen",
  "teilzahlung",
  "finanzierung",
  "monatsrate",
  "monatsraten",
  "in monatsraten",
  "kann man das in raten zahlen",
  "geht ratenzahlung",
  "geht das in raten",
  "raten möglich",
];

const LONG_TERM_KEYWORDS = [
  "längere begleitung",
  "laengere begleitung",
  "intensivere begleitung",
  "langfristige begleitung",
  "großes paket",
  "grosses paket",
  "größeres paket",
  "groesseres paket",
  "größere begleitung",
  "groessere begleitung",
  "langfristig",
  "mehrere monate",
  "über mehrere monate",
  "ueber mehrere monate",
  "länger betreut",
  "laenger betreut",
  "langfristige zusammenarbeit",
  "enger begleitet",
  "enger betreut",
];

const DIRECT_BUY_KEYWORDS = [
  "direkt starten",
  "direkt buchen",
  "direkt kaufen",
  "ich will starten",
  "ich will direkt starten",
  "ich will direkt buchen",
  "ich will kaufen",
  "buchungslink",
  "link zum buchen",
  "link zum kauf",
  "kann ich direkt buchen",
  "wo kann ich buchen",
  "schick den link",
  "send mir den link",
  "sende mir den link",
  "checkout",
  "direkt bezahlen",
  "direkt zahlen",
  "ich nehme es",
  "ich will das nehmen",

  "gekauft",
  "hab gekauft",
  "ich hab gekauft",
  "ich habe gekauft",
  "direkt gekauft",
  "hab es gekauft",
  "ich hab es gekauft",
  "ich habe es gekauft",

  "gebucht",
  "hab gebucht",
  "ich hab gebucht",
  "ich habe gebucht",
  "direkt gebucht",
  "termin gebucht",
  "ich hab den termin gebucht",
  "ich habe den termin gebucht",

  "bezahlt",
  "hab bezahlt",
  "ich hab bezahlt",
  "ich habe bezahlt",
  "zahlung erledigt",
  "ist bezahlt",
  "habe gezahlt",
  "ich habe gezahlt",
  "ich hab gezahlt",

  "erledigt",
  "fertig",
  "durch",
  "ich bin durch",
  "bin durch",
  "ist erledigt",
  "hab's erledigt",
  "ich habs erledigt",
  "ich habe es erledigt",
];

const PRICE_INFO_KEYWORDS = [
  "was kostet",
  "wie viel kostet",
  "wieviel kostet",
  "was kostet das",
  "was kostet es",
  "wie teuer",
  "preis",
  "kosten",
  "kostenpunkt",
  "preislich",
  "investition",
  "was ist dein honorar",
  "honorar",
  "was verlangst du",
  "was nimmst du",
  "was kostet der spaß",
  "was kostet mich das",
  "was muss man investieren",
  "was muss ich investieren",
  "wieviel muss ich investieren",
  "wie viel muss ich investieren",
  "was müsste ich investieren",
  "wie hoch ist die investition",
  "wie hoch wäre die investition",
  "wie teuer ist das",
  "wie viel verlangst du",
  "paketpreis",
  "was ist der preis",
  "was ist dein preis",
  "wieviel ist das",
  "wie viel ist das",
];

const PRICE_TEST_KEYWORDS = [
  "sag mir den preis",
  "sag mir jetzt den preis",
  "sag mir einfach was es kostet",
  "nenn mir den preis",
  "nenn mir jetzt den preis",
  "nenn mir die zahl",
  "sag jetzt den preis",
  "preis jetzt",
  "was kostet das jetzt",
  "was verlangst du genau",
  "sag mir jetzt was es kostet",
  "jetzt den preis",
  "sag mir dein preis",
  "sag mir jetzt dein preis",
  "sag schon den preis",
  "sag schon",
  "komm sag den preis",
  "komm sag schon",
  "ich will den preis wissen",
  "ich will jetzt den preis wissen",
  "jetzt sag den preis",
  "jetzt sag schon",
  "raus mit dem preis",
];

const PRICE_OBJECTION_KEYWORDS = [
  "zu teuer",
  "ist mir zu teuer",
  "momentan zu teuer",
  "ehrlich zu teuer",
  "puh das ist mir zu viel",
  "das ist mir zu viel",
  "zu viel",
  "kann ich mir nicht leisten",
  "kann ich mir gerade nicht leisten",
  "passt gerade finanziell nicht",
  "finanziell gerade schwierig",
  "zu teuer für mich",
  "sprengt mein budget",
  "liegt nicht drin",
  "ist mir momentan zu viel",
  "das ist gerade nicht drin",
  "ist mir ehrlich zu viel",
];

const DIRECT_PRICE_TONE_KEYWORDS = [
  "jetzt",
  "einfach",
  "direkt",
  "nenn",
  "sag mir",
  "zahl",
  "genau",
  "bitte einfach",
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[?!.,;:()]/g, " ")
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

function hasDirectPriceTone(input: string): boolean {
  return includesAnyKeyword(input, DIRECT_PRICE_TONE_KEYWORDS) !== null;
}

export function isInstallmentsRequest(input: string): boolean {
  return includesAnyKeyword(input, INSTALLMENT_KEYWORDS) !== null;
}

export function isLongTermSupportRequest(input: string): boolean {
  return includesAnyKeyword(input, LONG_TERM_KEYWORDS) !== null;
}

export function isStarterDirectBuyIntent(input: string): boolean {
  return includesAnyKeyword(input, DIRECT_BUY_KEYWORDS) !== null;
}

export function isPriceQuestion(input: string): boolean {
  return (
    includesAnyKeyword(input, PRICE_INFO_KEYWORDS) !== null ||
    includesAnyKeyword(input, PRICE_TEST_KEYWORDS) !== null ||
    includesAnyKeyword(input, PRICE_OBJECTION_KEYWORDS) !== null
  );
}

export function getMatchedPricingIntent(input: string): {
  intent: LeadIntent | null;
  matchedText?: string;
  priceSubtype?: "price_info" | "price_test" | "price_objection";
  priceTone?: "neutral" | "direct";
} {
  const installmentMatch = includesAnyKeyword(input, INSTALLMENT_KEYWORDS);
  if (installmentMatch) {
    return {
      intent: "installments",
      matchedText: installmentMatch,
    };
  }

  const longTermMatch = includesAnyKeyword(input, LONG_TERM_KEYWORDS);
  if (longTermMatch) {
    return {
      intent: "long_term_support",
      matchedText: longTermMatch,
    };
  }

  const directBuyMatch = includesAnyKeyword(input, DIRECT_BUY_KEYWORDS);
  if (directBuyMatch) {
    return {
      intent: "direct_buy_starter",
      matchedText: directBuyMatch,
    };
  }

  const objectionMatch = includesAnyKeyword(input, PRICE_OBJECTION_KEYWORDS);
  if (objectionMatch) {
    return {
      intent: "price_question",
      matchedText: objectionMatch,
      priceSubtype: "price_objection",
      priceTone: "direct",
    };
  }

  const testMatch = includesAnyKeyword(input, PRICE_TEST_KEYWORDS);
  if (testMatch) {
    return {
      intent: "price_question",
      matchedText: testMatch,
      priceSubtype: "price_test",
      priceTone: "direct",
    };
  }

  const infoMatch = includesAnyKeyword(input, PRICE_INFO_KEYWORDS);
  if (infoMatch) {
    return {
      intent: "price_question",
      matchedText: infoMatch,
      priceSubtype: "price_info",
      priceTone: hasDirectPriceTone(input) ? "direct" : "neutral",
    };
  }

  return {
    intent: null,
  };
}

export function getStarterPriceReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.starterPriceReply;
}

export function getStarterDirectBuyReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.starterDirectBuyText;
}

export function getInstallmentsReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.installmentsReply;
}

export function getLongTermReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.longTermReply;
}

export function getStarterCheckoutUrl(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.starterCheckoutUrl;
}

export function getStarterPriceText(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  return campaign.texts.starterPriceText;
}

export function canSendStarterCheckoutDirectly(params: {
  hasInstallmentRequest: boolean;
  wantsLongTermSupport: boolean;
}): boolean {
  if (params.hasInstallmentRequest) {
    return false;
  }

  if (params.wantsLongTermSupport) {
    return false;
  }

  return true;
}

export function mustGoToCall(params: {
  hasInstallmentRequest: boolean;
  wantsLongTermSupport: boolean;
}): boolean {
  return params.hasInstallmentRequest || params.wantsLongTermSupport;
}

export function getCampaignPricingTexts(
  campaignId: string,
): CampaignConfig["texts"] {
  return getCampaignById(campaignId).texts;
}
