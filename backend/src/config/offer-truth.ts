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
  requiresHumanDecision: boolean;
  postPurchaseOnly?: boolean;
  creditedEntryAmountEur?: number;
  upgradeBalanceEur?: number;
};

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
    requiresHumanDecision: false,
  },
  longTerm: {
    id: "long_term_6m",
    name: "6-Monats-Begleitung",
    role: "long_term_continuation",
    priceEur: 2499,
    priceText: "2.499 €",
    requiresHumanDecision: true,
    creditedEntryAmountEur: 499,
    upgradeBalanceEur: 2000,
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
  longTerm: OfferTruthItem;
  resources: {
    elterncheck: ResourceTruthItem;
    ketoGuide: ResourceTruthItem;
  };
  postPurchaseOnly: readonly string[];
};

export function getSelfstarterOffer(): OfferTruthItem {
  return OFFER_TRUTH.selfstarter;
}

export function getCoachingEntryOffer(): OfferTruthItem {
  return OFFER_TRUTH.coachingEntry;
}

export function getLongTermOffer(): OfferTruthItem {
  return OFFER_TRUTH.longTerm;
}
