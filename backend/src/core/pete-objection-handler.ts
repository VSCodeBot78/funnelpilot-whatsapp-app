export type ObjectionIntent =
  | "price"
  | "time"
  | "info"
  | "think"
  | "no_interest"
  | "partner"
  | "trust"
  | "hard_stop"
  | "none";

export type ObjectionAction =
  | "soft_continue"
  | "offer_info"
  | "offer_booking"
  | "handoff"
  | "close";

export type PeteObjectionClassification = {
  intent: ObjectionIntent;
  matchedKeyword?: string;
};

export type PeteObjectionResult = PeteObjectionClassification & {
  action: ObjectionAction;
  replyText?: string;
  templateId?: string;
  objectionCount: number;
  shouldClose?: boolean;
  shouldStopAutomation?: boolean;
  shouldHandoffToJochen?: boolean;
  shouldSetInfoOnly?: boolean;
  shouldSetBooking?: boolean;
  shouldSendInfoLink?: boolean;
  reason?: string;
};

const HARD_STOP_REPLY =
  "Alles klar, danke für die Rückmeldung. Dann schreibe ich dir dazu nicht weiter.";

const THIRD_SIMILAR_OBJECTION_REPLY =
  "Dann ist es wahrscheinlich gerade nicht der richtige Zeitpunkt.\n" +
  "Alles gut. Wenn du später nochmal sauber prüfen willst, kannst du dich melden.";

const HARD_STOP_KEYWORDS = [
  "stop",
  "stopp",
  "nein danke bitte nichts mehr",
  "bitte nichts mehr",
  "bitte nicht mehr",
  "lass mich in ruhe",
  "kein kontakt",
  "keinen kontakt",
  "schreib mir nicht mehr",
  "nicht mehr schreiben",
  "bitte keine nachrichten mehr",
  "keine nachrichten mehr",
  "spam",
  "abmelden",
];

const PRICE_KEYWORDS = [
  "zu teuer",
  "kein geld",
  "kein budget",
  "kann ich mir nicht leisten",
  "kann ich mir gerade nicht leisten",
  "499 ist viel",
  "499 ist mir",
  "preis ist hoch",
  "zu viel",
  "zu hoch",
  "budget",
  "finanziell",
  "sprengt",
  "nicht drin",
  "nicht leisten",
  "rabatt",
  "sonderpreis",
  "ratenzahlung",
  "in raten",
];

const AFFORDABILITY_HARD_LIMIT_KEYWORDS = [
  "kein geld",
  "kein budget",
  "kann ich mir nicht leisten",
  "kann ich mir gerade nicht leisten",
  "kann ich mir aktuell nicht leisten",
  "finanziell nicht machbar",
  "passt finanziell nicht",
  "passt gerade finanziell nicht",
  "sprengt mein budget",
  "liegt nicht drin",
  "ist gerade nicht drin",
  "ist grad nicht drin",
];

const MONEY_DETAIL_KEYWORDS = [
  "rabatt",
  "sonderpreis",
  "ratenzahlung",
  "in raten",
  "rate",
  "raten",
];

const TIME_KEYWORDS = [
  "keine zeit",
  "hab keine zeit",
  "habe keine zeit",
  "gerade stressig",
  "grad stressig",
  "stressig gerade",
  "später",
  "spaeter",
  "jetzt nicht",
  "melde mich später",
  "melde mich spaeter",
  "alltag voll",
  "alltag ist voll",
  "schaffe ich nicht",
  "schaff ich nicht",
  "zu viel los",
];

const INFO_KEYWORDS = [
  "schick infos",
  "schick mir infos",
  "schick mir erst mal infos",
  "schick mir erstmal infos",
  "schick mir was",
  "mehr infos",
  "mehr informationen",
  "erst mal infos",
  "erstmal infos",
  "will erst anschauen",
  "erst anschauen",
  "erstmal anschauen",
  "erst mal anschauen",
  "will erstmal schauen",
  "will erst schauen",
  "video",
  "anleitung",
  "pdf",
  "übersicht",
  "uebersicht",
];

const CLEAR_INFO_LINK_KEYWORDS = [
  "video",
  "anleitung",
  "pdf",
  "übersicht",
  "uebersicht",
];

const THINK_KEYWORDS = [
  "drüber schlafen",
  "drueber schlafen",
  "darüber schlafen",
  "darueber schlafen",
  "nachdenken",
  "überlegen",
  "ueberlegen",
  "sacken lassen",
  "ich melde mich",
  "muss ich mir überlegen",
  "muss ich mir ueberlegen",
  "noch überlegen",
  "noch ueberlegen",
];

const NO_INTEREST_KEYWORDS = [
  "kein interesse",
  "passt nicht",
  "brauche ich nicht",
  "brauch ich nicht",
  "lass mal",
  "nicht relevant",
  "nein danke",
];

const PARTNER_KEYWORDS = [
  "mit meinem mann",
  "mit meiner frau",
  "mit meinem partner",
  "mit meiner partnerin",
  "zuhause besprechen",
  "zu hause besprechen",
  "familie besprechen",
  "wir müssen das besprechen",
  "wir muessen das besprechen",
  "erst besprechen",
  "daheim besprechen",
];

const TRUST_KEYWORDS = [
  "coach der nur geld will",
  "schon wieder so ein coach",
  "wieder so ein coach",
  "abzocke",
  "scam",
  "nur verkaufen",
  "nur verkauf",
  "geldmacherei",
  "klingt nach verkauf",
  "unseriös",
  "unserioes",
  "nur geld",
];

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s€]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyKeyword(
  normalizedInput: string,
  keywords: string[],
): string | undefined {
  return keywords.find((keyword) => normalizedInput.includes(normalizeText(keyword)));
}

function buildRepeatedObjectionResult(params: {
  intent: ObjectionIntent;
  matchedKeyword?: string;
  objectionCount: number;
}): PeteObjectionResult | undefined {
  if (params.objectionCount < 3 || params.intent === "hard_stop") {
    return undefined;
  }

  return {
    intent: params.intent,
    matchedKeyword: params.matchedKeyword,
    action: "close",
    replyText: THIRD_SIMILAR_OBJECTION_REPLY,
    templateId: `${params.intent}_third_close`,
    objectionCount: params.objectionCount,
    shouldClose: true,
    reason: "third_similar_objection_close",
  };
}

function buildSecondObjectionResult(params: {
  intent: ObjectionIntent;
  matchedKeyword?: string;
  objectionCount: number;
}): PeteObjectionResult | undefined {
  if (params.objectionCount !== 2) {
    return undefined;
  }

  const base = {
    intent: params.intent,
    matchedKeyword: params.matchedKeyword,
    objectionCount: params.objectionCount,
  };

  if (params.intent === "info") {
    return {
      ...base,
      action: "offer_info",
      templateId: "info_second_link",
      shouldSetInfoOnly: true,
      shouldSendInfoLink: true,
      reason: "second_info_objection_send_info_link",
    };
  }

  if (params.intent === "trust") {
    return {
      ...base,
      action: "offer_info",
      replyText:
        "Fairer Punkt.\n" +
        "Dann lieber konkret statt großes Gerede.\n" +
        "Soll ich dir erst die kurze Anleitung schicken?",
      templateId: "trust_second_offer_info",
      shouldSetInfoOnly: true,
      reason: "second_trust_objection_offer_info",
    };
  }

  return {
    ...base,
    action: "soft_continue",
    replyText:
      "Alles gut.\n" +
      "Dann lass uns keinen Druck draus machen.\n" +
      "Was wäre für dich der kleinste sinnvolle nächste Schritt?",
    templateId: `${params.intent}_second_alternative`,
    reason: "second_similar_objection_alternative",
  };
}

export function classifyPeteObjection(
  inputText: string | null | undefined,
): PeteObjectionClassification {
  const normalized = normalizeText(inputText);

  if (!normalized) {
    return { intent: "none" };
  }

  const hardStopMatch = includesAnyKeyword(normalized, HARD_STOP_KEYWORDS);
  if (hardStopMatch) {
    return { intent: "hard_stop", matchedKeyword: hardStopMatch };
  }

  const partnerMatch = includesAnyKeyword(normalized, PARTNER_KEYWORDS);
  if (partnerMatch) {
    return { intent: "partner", matchedKeyword: partnerMatch };
  }

  const trustMatch = includesAnyKeyword(normalized, TRUST_KEYWORDS);
  if (trustMatch) {
    return { intent: "trust", matchedKeyword: trustMatch };
  }

  const priceMatch = includesAnyKeyword(normalized, PRICE_KEYWORDS);
  if (priceMatch) {
    return { intent: "price", matchedKeyword: priceMatch };
  }

  const timeMatch = includesAnyKeyword(normalized, TIME_KEYWORDS);
  if (timeMatch) {
    return { intent: "time", matchedKeyword: timeMatch };
  }

  const infoMatch = includesAnyKeyword(normalized, INFO_KEYWORDS);
  if (infoMatch) {
    return { intent: "info", matchedKeyword: infoMatch };
  }

  const thinkMatch = includesAnyKeyword(normalized, THINK_KEYWORDS);
  if (thinkMatch) {
    return { intent: "think", matchedKeyword: thinkMatch };
  }

  const noInterestMatch = includesAnyKeyword(normalized, NO_INTEREST_KEYWORDS);
  if (noInterestMatch) {
    return { intent: "no_interest", matchedKeyword: noInterestMatch };
  }

  return { intent: "none" };
}

export function evaluatePeteObjection(
  inputText: string | null | undefined,
  params: { objectionCount?: number } = {},
): PeteObjectionResult {
  const classification = classifyPeteObjection(inputText);
  const objectionCount = Math.max(1, params.objectionCount ?? 1);
  const normalized = normalizeText(inputText);

  if (classification.intent === "none") {
    return {
      ...classification,
      action: "soft_continue",
      objectionCount,
      reason: "no_objection_match",
    };
  }

  if (classification.intent === "hard_stop") {
    return {
      ...classification,
      action: "close",
      replyText: HARD_STOP_REPLY,
      templateId: "hard_stop_close",
      objectionCount,
      shouldClose: true,
      shouldStopAutomation: true,
      reason: "explicit_hard_stop",
    };
  }

  const repeated =
    buildRepeatedObjectionResult({ ...classification, objectionCount }) ??
    buildSecondObjectionResult({ ...classification, objectionCount });

  if (repeated) {
    return repeated;
  }

  if (classification.intent === "price") {
    const affordabilityHardLimit =
      includesAnyKeyword(normalized, AFFORDABILITY_HARD_LIMIT_KEYWORDS) !==
      undefined;

    if (affordabilityHardLimit) {
      return {
        ...classification,
        action: "offer_info",
        replyText:
          "Verstanden. Dann macht es keinen Sinn, dich auf 499 € zu drücken.\n" +
          "Wenn du erstmal selbst loslegen willst, ist der Selbststarter für 14,95 € der sinnvollere Einstieg.\n" +
          "Hier kannst du direkt schauen, ob das für dich passt.",
        templateId: "price_affordability_selfstarter",
        objectionCount,
        shouldSetInfoOnly: true,
        reason: "price_affordability_routes_to_low_ticket",
      };
    }

    const asksMoneyDetail =
      includesAnyKeyword(normalized, MONEY_DETAIL_KEYWORDS) !== undefined;

    if (asksMoneyDetail) {
      return {
        ...classification,
        action: "handoff",
        replyText:
          "Fairer Punkt.\n" +
          "Rabatt oder Ratenzahlung kläre ich hier nicht im Chat und ich erfinde da nichts.\n" +
          "Wenn es grundsätzlich passen könnte, sollte Jochen das sauber mit dir besprechen.",
        templateId: "price_money_detail_handoff",
        objectionCount,
        shouldHandoffToJochen: true,
        reason: "price_money_detail_requires_handoff",
      };
    }

    return {
      ...classification,
      action: "soft_continue",
      replyText:
        "Verstehe ich.\n" +
        "Gerade deshalb sollte klar sein, ob es überhaupt zu deiner Situation passt.\n" +
        "Was müsste sich bei dir verändern, damit es sich überhaupt lohnt?",
      templateId: "price_fit_reframe",
      objectionCount,
      reason: "price_objection_aaa",
    };
  }

  if (classification.intent === "time") {
    return {
      ...classification,
      action: "offer_info",
      replyText:
        "Verstehe ich.\n" +
        "Dann halten wir es kurz.\n" +
        "Soll ich dir stattdessen den Elterncheck oder den Selbststarter zeigen?",
      templateId: "time_offer_info",
      objectionCount,
      shouldSetInfoOnly: true,
      reason: "time_objection_aaa",
    };
  }

  if (classification.intent === "info") {
    const clearInfoLink =
      includesAnyKeyword(normalized, CLEAR_INFO_LINK_KEYWORDS) !== undefined;

    if (clearInfoLink) {
      return {
        ...classification,
        action: "offer_info",
        templateId: "info_clear_link",
        objectionCount,
        shouldSetInfoOnly: true,
        shouldSendInfoLink: true,
        reason: "clear_info_request_send_info_link",
      };
    }

    return {
      ...classification,
      action: "offer_info",
      replyText:
        "Klar.\n" +
        "Damit ich dir nicht den falschen Link schicke:\n" +
        "Geht's dir um die Eltern Vital Methode, den Selbststarter, den Elterncheck oder den Keto Guide?",
      templateId: "info_clarify_link",
      objectionCount,
      shouldSetInfoOnly: true,
      reason: "info_request_clarification",
    };
  }

  if (classification.intent === "think") {
    return {
      ...classification,
      action: "soft_continue",
      replyText:
        "Völlig okay.\n" +
        "Sowas muss sich stimmig anfühlen.\n" +
        "Was ist gerade noch offen: Zeit, Preis oder ob es grundsätzlich passt?",
      templateId: "think_clarify_uncertainty",
      objectionCount,
      reason: "think_objection_aaa",
    };
  }

  if (classification.intent === "no_interest") {
    return {
      ...classification,
      action: "soft_continue",
      replyText:
        "Alles gut, danke für die Ehrlichkeit.\n" +
        "Ist es grundsätzlich kein Thema für dich oder gerade einfach nicht der richtige Zeitpunkt?",
      templateId: "no_interest_soft_clarify",
      objectionCount,
      reason: "soft_no_interest_aaa",
    };
  }

  if (classification.intent === "partner") {
    return {
      ...classification,
      action: "offer_info",
      replyText:
        "Verstehe ich.\n" +
        "Gerade bei so einer Entscheidung ist es sinnvoll, wenn ihr beide denselben Stand habt.\n" +
        "Soll ich dir eine kurze Übersicht schicken, die ihr gemeinsam anschauen könnt?",
      templateId: "partner_offer_info",
      objectionCount,
      shouldSetInfoOnly: true,
      reason: "partner_objection_aaa",
    };
  }

  if (classification.intent === "trust") {
    return {
      ...classification,
      action: "offer_info",
      replyText:
        "Kann ich verstehen.\n" +
        "Online wird viel versprochen, deshalb drücke ich dich hier in nichts rein.\n" +
        "Soll ich dir stattdessen den Elterncheck oder den Selbststarter zeigen?",
      templateId: "trust_deescalate_offer_info",
      objectionCount,
      shouldSetInfoOnly: true,
      reason: "trust_objection_aaa",
    };
  }

  return {
    ...classification,
    action: "soft_continue",
    objectionCount,
    reason: "no_objection_reply",
  };
}
