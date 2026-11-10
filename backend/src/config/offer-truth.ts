export type OfferTruthRole =
  | "low_ticket_fallback"
  | "primary_coaching_entry"
  | "long_term_continuation";

export type OfferTruthItem = {
  id: "selfstarter" | "coaching_5w" | "long_term_6m";
  name: string;
  role: OfferTruthRole;
  priceEur: number;
  priceText: string;
  productUrl?: string;
  checkoutUrl?: string;
  infoUrl?: string;
  includedServices?: readonly string[];
  startSelectableWithinDays?: number;
  requiresHumanDecision: boolean;
  postPurchaseOnly?: boolean;
  creditedEntryAmountEur?: number;
  upgradeBalanceEur?: number;
};

// Long-term terms are deliberately not sellable until Jochen has approved them.
export type UnverifiedLongTermOffer = Pick<
  OfferTruthItem,
  "id" | "name" | "role" | "requiresHumanDecision"
> & { verificationStatus: "pending_founder_approval" };

export const LONG_TERM_PRICE_UNVERIFIED_REPLY =
  "Den aktuellen Preis und Umfang der längeren Begleitung klärt Jochen persönlich. Ich möchte dir hier keine veralteten Angaben nennen.";

/** A direct price query about the unapproved long-term offer. */
export function isUnverifiedLongTermPriceQuestion(text: string): boolean {
  const input = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
  return /\b(6[\s-]*monat(?:e|s|ige|igen)?|sechs[\s-]*monat(?:e|s|ige|igen)?|langere begleitung|langfristige begleitung|premium|advanced)\b/.test(input) &&
    /\b(preis|gesamtpreis|kostet|kosten|teuer|gebuhr|monatlich|zahlung|investition|vertragsbedingungen|konditionen)\b/.test(input);
}

/** Historical upgrade figures must never appear in a customer-visible reply. */
export function hasUnapprovedOfferPrice(text: string): boolean {
  if (/(?:^|\D)(?:2[.\s]?499|2[.\s]?000)(?=\D|$)/.test(text)) return true;
  const money = text.match(/\b\d+(?:[.\s]\d{3})*(?:[,.]\d{1,2})?\s*(?:€|\bEUR\b|\bEuro\b)/gi) ?? [];
  return money.some(value => !/^(?:499(?:[,.]00)?|14[,.]95)\s*(?:€|EUR|Euro)$/i.test(value.trim()));
}

/** The LLM may explain, but must not manufacture even approved prices. */
export function containsGeneratedPrice(text: string): boolean {
  return hasUnapprovedOfferPrice(text) || /\d[\d.,\s]*\s*(?:€|\bEUR\b|\bEuro\b)/i.test(text);
}

export type ResourceTruthItem = {
  id: "elterncheck" | "keto_guide";
  name: string;
  url: string;
  kind: "check" | "guide";
};

export const OFFER_TRUTH = {
  selfstarter: {
    id: "selfstarter",
    name: "No Bullshit Elternfitness Selbststarter",
    role: "low_ticket_fallback",
    priceEur: 14.95,
    priceText: "14,95 €",
    productUrl:
      "https://jochen-kammerer.de/produkt/no-bullshit-elternfitness-selbststarter/",
    requiresHumanDecision: false,
  },
  coachingEntry: {
    id: "coaching_5w",
    name: "5-Wochen-Coaching",
    role: "primary_coaching_entry",
    priceEur: 499,
    priceText: "499 €",
    checkoutUrl:
      "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
    infoUrl: "https://jochen-kammerer.de/die-eltern-vital-methode/",
    // Current founder-provided Nutrilize checkout screenshot (Oct 2026).
    // These are services, not an outcome promise or a payment confirmation.
    includedServices: [
      "Wöchentlich 45 Minuten 1:1-Coaching per Zoom",
      "Voller App-Zugang mit individualisierten Trainings- und Ernährungsplänen",
      "5 x 5-Minuten- und 2 x 20-Minuten-Workouts",
      "Erweiterter Chat-Support für Fragen und Updates",
      "Power Walk & Call einmal pro Woche",
    ],
    startSelectableWithinDays: 14,
    // Checkout is enabled only after the strategy call and owner approval.
    requiresHumanDecision: true,
  },
  // Calendly owner event 'Coaching / Strategie Gespräch', checked 2026-11-03:
  // active=true, is_paid=false. This confirms no payment during booking only.
  strategyCall: {
    schedulingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
    calendlyBookingRequiresPayment: false,
  },
  longTerm: {
    id: "long_term_6m",
    name: "6-Monats-Begleitung",
    role: "long_term_continuation",
    requiresHumanDecision: true,
    verificationStatus: "pending_founder_approval",
  },
  resources: {
    elterncheck: {
      id: "elterncheck",
      name: "No Bullshit Elternfitness Check",
      url: "https://check.jochen-kammerer.de",
      kind: "check",
    },
    ketoGuide: {
      id: "keto_guide",
      name: "No Bullshit Keto Guide",
      url: "https://jochen-kammerer.de/keto-guide/",
      kind: "guide",
    },
  },
  postPurchaseOnly: [
    "App-Starter",
    "Umsetzungs-Bundle",
  ],
} as const satisfies {
  selfstarter: OfferTruthItem;
  coachingEntry: OfferTruthItem;
  strategyCall: { schedulingUrl: string; calendlyBookingRequiresPayment: boolean };
  longTerm: UnverifiedLongTermOffer;
  resources: {
    elterncheck: ResourceTruthItem;
    ketoGuide: ResourceTruthItem;
  };
  postPurchaseOnly: readonly string[];
};

/**
 * Owner-approved WooCommerce ladder, checked against the live public Store
 * API on 2026-11-06 (IDs 1853, 1897, 1929).
 *
 * Total prices include the previously purchased Selfstarter, NOT the future
 * separate Minikurs. Never infer that a lead bought any step from chat text.
 * These URLs are product-information links, NOT payment confirmations.
 */
export const VERIFIED_SMALL_SUPPORT = {
  appStarter: {
    id: 1897,
    name: "App-Starter Upgrade",
    upgradePriceEur: 84.05,
    upgradePriceText: "84,05 €",
    totalWithSelfstarterEur: 99,
    totalWithSelfstarterText: "99 €",
    productUrl: "https://jochen-kammerer.de/produkt/no-bullshit-elternfitness_app-starter/",
    includedAppMonths: 1,
    includedCoachingSessions: 1,
    coachingSessionMinutes: 45,
    optionalAppRenewalEur: 19.95,
    optionalAppRenewalText: "19,95 € pro Monat",
    optionalAppRenewalNeedsSeparateSetup: true,
    cancellationNoticeDays: 14,
  },
  implementation: {
    id: 1929,
    name: "Umsetzung Upgrade",
    upgradePriceEur: 100,
    upgradePriceText: "100 €",
    totalWithSelfstarterEur: 199,
    totalWithSelfstarterText: "199 €",
    productUrl: "https://jochen-kammerer.de/produkt/umsetzung-upgrade/",
    totalAppMonths: 3,
    includedCoachingSessions: 2,
    coachingSessionMinutes: 45,
    includesIndividualStartPlan: true,
    includesChatSupportDuringMonths: 3,
    automaticRenewal: false,
  },
} as const;

export function getSelfstarterOffer(): OfferTruthItem {
  return OFFER_TRUTH.selfstarter;
}

export function getCoachingEntryOffer(): OfferTruthItem {
  return OFFER_TRUTH.coachingEntry;
}

export function getLongTermOffer(): UnverifiedLongTermOffer {
  return OFFER_TRUTH.longTerm;
}
