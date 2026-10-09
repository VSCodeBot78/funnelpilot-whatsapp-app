import { detectBookingRequest } from "../domain/booking-rules.js";
import type { CampaignConfig, FlowStepId } from "../types/types.js";
import { detectLeadIntent } from "./intent-detector.js";
import {
  classifyPeteObjection,
  evaluatePeteObjection,
  type ObjectionIntent,
} from "./pete-objection-handler.js";
import {
  evaluatePeteRuntimeSafety,
  type PeteRuntimeSafetyResult,
} from "./pete-runtime-safety.js";

export type PeteDecisionType =
  | "hard_stop"
  | "medical_critical"
  | "medical_soft"
  | "legal_privacy"
  | "emotional_crisis"
  | "human_request"
  | "booking_request"
  | "link_request"
  | "price_question"
  | "price_objection"
  | "objection"
  | "offer_info"
  | "frustration_previous_attempts"
  | "question_intro_confirmed"
  | "normal_funnel"
  | "fallback";

export type PeteDecisionAction =
  | "close"
  | "handoff"
  | "offer_booking"
  | "send_info_link"
  | "ask_link_clarification"
  | "answer_price"
  | "handle_objection"
  | "answer_offer_info"
  | "continue_funnel"
  | "ask_clarifying_question";

export type PeteDecision = {
  decisionType: PeteDecisionType;
  action: PeteDecisionAction;
  priority: number;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type PeteDecisionContext = {
  campaign?: CampaignConfig;
  currentStep?: FlowStepId;
  hasPendingBooking?: boolean;
  hasActiveProviderBooking?: boolean;
  askedPrice?: boolean;
  lastAssistantText?: string;
  bookingUrl?: string;
  handoffActive?: boolean;
  previousObjectionIntent?: string;
  previousObjectionCount?: number;
};

const PRIORITY = {
  hardStop: 1,
  criticalSafety: 2,
  humanOrBooking: 3,
  link: 4,
  handoffActive: 4.5,
  price: 5,
  objection: 6,
  offerInfo: 7,
  frustration: 8,
  introConfirmed: 9,
  normalFunnel: 10,
  fallback: 11,
} as const;

type LinkTarget = "info" | "booking" | "clarify" | "info_clarify";

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ÃŸ/g, "ss")
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

function decide(params: {
  decisionType: PeteDecisionType;
  action: PeteDecisionAction;
  priority: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}): PeteDecision {
  return params;
}

function getNextObjectionCount(
  context: PeteDecisionContext,
  intent: ObjectionIntent,
): number {
  return context.previousObjectionIntent === intent
    ? (context.previousObjectionCount ?? 0) + 1
    : 1;
}

function isExplicitHardStop(
  normalized: string,
  safety: PeteRuntimeSafetyResult,
  objectionIntent: ObjectionIntent,
  leadIntent: ReturnType<typeof detectLeadIntent>["intent"],
): boolean {
  if (objectionIntent === "hard_stop" || leadIntent === "stop") {
    return true;
  }

  return Boolean(
    includesAnyKeyword(normalized, [
      "kontaktiere mich nicht mehr",
      "kontaktier mich nicht mehr",
      "bitte kontaktiere mich nicht",
      "bitte kontaktier mich nicht",
      "nicht mehr kontaktieren",
      "bitte nicht kontaktieren",
      "keine kontaktaufnahme",
      "nichts mehr schicken",
      "keine weiteren nachrichten",
      "hoer auf mir zu schreiben",
      "hor auf mir zu schreiben",
    ]) || safety.reason?.includes("hard_stop"),
  );
}

function isPreviousAttemptFrustration(normalized: string): boolean {
  const hasTriedSignal =
    includesAnyKeyword(normalized, [
      "schon vieles probiert",
      "schon viel probiert",
      "schon einiges probiert",
      "vieles versucht",
      "einiges versucht",
      "alles versucht",
      "schon so viel versucht",
      "schon so vieles versucht",
    ]) !== undefined;

  const hasNoEffectSignal =
    includesAnyKeyword(normalized, [
      "nichts hat",
      "nichts gebracht",
      "keinen effekt",
      "gewunschten effekt",
      "gewuenschten effekt",
      "hat nicht funktioniert",
      "nie gehalten",
      "wieder eingeschlafen",
    ]) !== undefined;

  return hasTriedSignal || (normalized.includes("probiert") && hasNoEffectSignal);
}

function isOfferInfoQuestion(normalized: string): boolean {
  return (
    includesAnyKeyword(normalized, [
      "was bietest du",
      "was bietest du denn an",
      "was bietet ihr",
      "was ist das angebot",
      "was ist dein angebot",
      "was genau bietest",
      "was genau ist das",
      "was ist das",
      "worum geht es",
      "was machst du",
      "was bekomme ich",
    ]) !== undefined
  );
}

function isIntroQuestionConfirmation(
  normalized: string,
  context: PeteDecisionContext,
): boolean {
  if (context.currentStep !== "intro_ack") {
    return false;
  }

  return (
    includesAnyKeyword(normalized, [
      "warum nicht",
      "was ist mit den fragen",
      "was ist mit fragen",
      "leg los",
      "stell die fragen",
      "frag ruhig",
      "fragen ok",
    ]) !== undefined
  );
}

function isHumanRequest(normalized: string, safety: PeteRuntimeSafetyResult): boolean {
  if (safety.category === "human_request") {
    return true;
  }

  return (
    includesAnyKeyword(normalized, [
      "wie erreiche ich jochen",
      "jochen erreichen",
      "jochen kontaktieren",
      "mit jochen sprechen",
      "mit jochen reden",
      "persoenlich sprechen",
      "personlich sprechen",
      "persoenlich mit jochen",
      "personlich mit jochen",
    ]) !== undefined
  );
}

function isBookingRequest(
  normalized: string,
  leadIntent: ReturnType<typeof detectLeadIntent>["intent"],
): boolean {
  if (leadIntent === "booking_intent") {
    return true;
  }

  if (detectBookingRequest(normalized).hasConcreteRequest) {
    return true;
  }

  return (
    includesAnyKeyword(normalized, [
      "termin buchen",
      "termin machen",
      "termin vereinbaren",
      "termin ausmachen",
      "gespraech buchen",
      "gesprach buchen",
      "call buchen",
      "kann ich termin buchen",
      "kann ich einen termin buchen",
    ]) !== undefined
  );
}

function hasInfoOfferContext(lastAssistantText: string | undefined): boolean {
  const previous = normalizeText(lastAssistantText);

  return (
    includesAnyKeyword(previous, [
      "kostenlose video anleitung",
      "video anleitung",
      "kostenlose anleitung",
      "erst die kostenlose anleitung",
      "erstmal die anleitung",
      "soll ich dir erst",
      "anleitung schicken",
    ]) !== undefined
  );
}

function isAffirmativeInfoLinkRequest(
  normalized: string,
  context: PeteDecisionContext,
): boolean {
  if (!hasInfoOfferContext(context.lastAssistantText)) {
    return false;
  }

  return (
    includesAnyKeyword(normalized, [
      "ja bitte",
      "ja gern",
      "ja gerne",
      "gerne",
      "bitte",
      "schick",
      "schick mir",
      "okay schick",
      "ok schick",
    ]) !== undefined
  );
}

function hasLinkSignal(normalized: string): boolean {
  return (
    includesAnyKeyword(normalized, [
      "link",
      "infos",
      "info",
      "informationen",
      "schick mir",
      "schick",
      "sende mir",
      "send mir",
      "video",
      "anleitung",
      "anschauen",
      "ansehen",
      "lesen",
    ]) !== undefined
  );
}

function classifyLinkTarget(
  normalized: string,
  context: PeteDecisionContext,
): LinkTarget | null {
  if (isAffirmativeInfoLinkRequest(normalized, context)) {
    return "info";
  }

  if (!hasLinkSignal(normalized)) {
    return null;
  }

  const previous = normalizeText(context.lastAssistantText);
  const currentHasBookingContext =
    includesAnyKeyword(normalized, [
      "buchungslink",
      "terminlink",
      "kalenderlink",
      "termin",
      "gespraech",
      "gesprach",
      "strategiegespraech",
      "strategiegesprach",
      "call",
      "jochen",
      "sprechen",
    ]) !== undefined;
  const currentHasVideoContext =
    includesAnyKeyword(normalized, [
      "video",
      "anleitung",
      "kostenlos",
      "anschauen",
      "ansehen",
      "lesen",
    ]) !== undefined;
  const currentHasBroadInfoContext =
    includesAnyKeyword(normalized, [
      "infos",
      "info",
      "informationen",
      "erst mal infos",
      "erstmal infos",
      "mehr infos",
    ]) !== undefined;
  const previousHasInfoContext =
    includesAnyKeyword(previous, [
      "video",
      "anleitung",
      "kostenlos",
      "infos",
      "informationen",
    ]) !== undefined;
  const previousHasBookingContext =
    includesAnyKeyword(previous, [
      "termin",
      "gespraech",
      "gesprach",
      "booking",
      "buchungslink",
    ]) !== undefined;

  if (currentHasBookingContext) {
    return "booking";
  }

  if (currentHasVideoContext || previousHasInfoContext) {
    return "info";
  }

  if (currentHasBroadInfoContext) {
    return "info_clarify";
  }

  if (previousHasBookingContext) {
    return "booking";
  }

  return "clarify";
}

function isSoftNoNotRelevant(normalized: string): boolean {
  return (
    includesAnyKeyword(normalized, [
      "kein thema fuer mich",
      "kein thema fur mich",
      "ist kein thema fuer mich",
      "ist kein thema fur mich",
      "nicht relevant fuer mich",
      "nicht relevant fur mich",
    ]) !== undefined
  );
}

function isProviderBookingFollowUpInput(normalized: string): boolean {
  return (
    includesAnyKeyword(normalized, [
      "hab gebucht",
      "habe gebucht",
      "termin steht",
      "ist gebucht",
      "erledigt",
      "gemacht",
      "eingetragen",
      "habe mich eingetragen",
      "hab mich eingetragen",
    ]) !== undefined
  );
}

export function decidePeteNextAction(
  inputText: string | null | undefined,
  context: PeteDecisionContext = {},
): PeteDecision {
  const normalized = normalizeText(inputText);
  const leadIntent = detectLeadIntent(String(inputText ?? ""));
  const objectionClassification = classifyPeteObjection(inputText);
  const safety = evaluatePeteRuntimeSafety(inputText, {
    campaign: context.campaign,
    currentStep: context.currentStep,
    hasPendingBooking: context.hasPendingBooking,
    hasActiveProviderBooking: context.hasActiveProviderBooking,
    askedPrice: context.askedPrice,
    lastAssistantText: context.lastAssistantText,
    bookingUrl: context.bookingUrl,
  });
  const linkTarget = classifyLinkTarget(normalized, context);
  const frustration = isPreviousAttemptFrustration(normalized);

  if (
    isExplicitHardStop(
      normalized,
      safety,
      objectionClassification.intent,
      leadIntent.intent,
    )
  ) {
    return decide({
      decisionType: "hard_stop",
      action: "close",
      priority: PRIORITY.hardStop,
      reason: "explicit_hard_stop",
      metadata: {
        leadIntent: leadIntent.intent,
        objectionIntent: objectionClassification.intent,
        matchedText: leadIntent.matchedText ?? objectionClassification.matchedKeyword,
      },
    });
  }

  if (
    safety.category === "medical_critical" ||
    safety.category === "legal_privacy" ||
    safety.category === "emotional_crisis"
  ) {
    return decide({
      decisionType: safety.category,
      action: "handoff",
      priority: PRIORITY.criticalSafety,
      reason: safety.reason,
      metadata: {
        safetyCategory: safety.category,
        shouldStopAutomation: safety.shouldStopAutomation,
      },
    });
  }

  if (safety.category === "medical_soft") {
    return decide({
      decisionType: "medical_soft",
      action: "ask_clarifying_question",
      priority: PRIORITY.criticalSafety,
      reason: safety.reason,
      metadata: {
        safetyCategory: safety.category,
      },
    });
  }

  const explicitLinkSignal = linkTarget !== null;

  if (!explicitLinkSignal && isHumanRequest(normalized, safety)) {
    return decide({
      decisionType: "human_request",
      action: "offer_booking",
      priority: PRIORITY.humanOrBooking,
      reason: safety.reason ?? "human_request",
      metadata: {
        bookingUrlAvailable: Boolean(context.bookingUrl),
        safetyCategory: safety.category,
      },
    });
  }

  if (!explicitLinkSignal && isBookingRequest(normalized, leadIntent.intent)) {
    return decide({
      decisionType: "booking_request",
      action: "offer_booking",
      priority: PRIORITY.humanOrBooking,
      reason: "booking_request",
      metadata: {
        bookingUrlAvailable: Boolean(context.bookingUrl),
        leadIntent: leadIntent.intent,
      },
    });
  }

  if (
    context.hasActiveProviderBooking &&
    isProviderBookingFollowUpInput(normalized)
  ) {
    return decide({
      decisionType: "normal_funnel",
      action: "continue_funnel",
      priority: PRIORITY.humanOrBooking,
      reason: "provider_booking_followup_uses_existing_flow",
    });
  }

  if (linkTarget) {
    const action: PeteDecisionAction =
      linkTarget === "info"
        ? "send_info_link"
        : linkTarget === "booking"
          ? "offer_booking"
          : "ask_link_clarification";

    return decide({
      decisionType: "link_request",
      action,
      priority: PRIORITY.link,
      reason: `link_request_${linkTarget}`,
      metadata: {
        linkTarget,
        bookingUrlAvailable: Boolean(context.bookingUrl),
      },
    });
  }

  if (context.handoffActive) {
    return decide({
      decisionType: "fallback",
      action: "handoff",
      priority: PRIORITY.handoffActive,
      reason: "handoff_active",
      metadata: {
        handoffActive: true,
      },
    });
  }

  if (!frustration) {
    if (leadIntent.intent === "installments") {
      return decide({
        decisionType: "price_objection",
        action: "offer_booking",
        priority: PRIORITY.price,
        reason: "installments_request",
        metadata: {
          priceSubtype: "installments",
          leadIntent: leadIntent.intent,
          bookingUrlAvailable: Boolean(context.bookingUrl),
        },
      });
    }

    if (objectionClassification.intent === "price") {
      const objectionResult = evaluatePeteObjection(inputText, {
        objectionCount: getNextObjectionCount(context, "price"),
      });

      return decide({
        decisionType: "price_objection",
        action: objectionResult.action === "handoff" ? "offer_booking" : "handle_objection",
        priority: PRIORITY.price,
        reason: objectionResult.reason,
        metadata: {
          objectionIntent: objectionResult.intent,
          objectionCount: objectionResult.objectionCount,
          templateId: objectionResult.templateId,
          bookingUrlAvailable: Boolean(context.bookingUrl),
        },
      });
    }

    if (leadIntent.intent === "price_question" || safety.category === "price") {
      return decide({
        decisionType: "price_question",
        action: "answer_price",
        priority: PRIORITY.price,
        reason: safety.category === "price" ? safety.reason : "price_question",
        metadata: {
          leadIntent: leadIntent.intent,
          priceSubtype: leadIntent.priceSubtype,
          priceTone: leadIntent.priceTone,
          directPrice:
            context.askedPrice ||
            leadIntent.priceTone === "direct" ||
            leadIntent.priceSubtype === "price_test",
        },
      });
    }
  }

  const softNoNotRelevant = isSoftNoNotRelevant(normalized);
  const effectiveObjectionIntent: ObjectionIntent = softNoNotRelevant
    ? "no_interest"
    : objectionClassification.intent;

  if (effectiveObjectionIntent !== "none") {
    const objectionCount = getNextObjectionCount(context, effectiveObjectionIntent);
    const objectionResult = evaluatePeteObjection(inputText, { objectionCount });
    const shouldCloseSoftNo =
      effectiveObjectionIntent === "no_interest" &&
      (context.previousObjectionIntent === "no_interest" || objectionCount >= 2);

    return decide({
      decisionType: "objection",
      action: shouldCloseSoftNo ? "close" : "handle_objection",
      priority: PRIORITY.objection,
      reason: shouldCloseSoftNo ? "soft_no_close" : objectionResult.reason,
      metadata: {
        objectionIntent: effectiveObjectionIntent,
        objectionCount,
        templateId: objectionResult.templateId,
        shouldClose: shouldCloseSoftNo,
        shouldSetInfoOnly: objectionResult.shouldSetInfoOnly,
        shouldSendInfoLink: objectionResult.shouldSendInfoLink,
      },
    });
  }

  if (isOfferInfoQuestion(normalized)) {
    return decide({
      decisionType: "offer_info",
      action: "answer_offer_info",
      priority: PRIORITY.offerInfo,
      reason: "offer_info_question",
    });
  }

  if (frustration) {
    return decide({
      decisionType: "frustration_previous_attempts",
      action: "ask_clarifying_question",
      priority: PRIORITY.frustration,
      reason: "previous_attempts_frustration",
    });
  }

  if (isIntroQuestionConfirmation(normalized, context)) {
    return decide({
      decisionType: "question_intro_confirmed",
      action: "continue_funnel",
      priority: PRIORITY.introConfirmed,
      reason: "intro_questions_confirmed",
    });
  }

  if (safety.category === "unclear") {
    return decide({
      decisionType: "fallback",
      action: "ask_clarifying_question",
      priority: PRIORITY.fallback,
      reason: safety.reason ?? "unclear_context",
      metadata: {
        safetyCategory: safety.category,
      },
    });
  }

  return decide({
    decisionType: "normal_funnel",
    action: "continue_funnel",
    priority: PRIORITY.normalFunnel,
    reason: "no_central_decision_match",
  });
}
