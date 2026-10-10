import { OFFER_TRUTH } from "../config/offer-truth.js";
import type { CampaignConfig, FlowStepId } from "../types/types.js";
import { getNextFlowStep } from "./flow-definition.js";
import type { PeteDecision } from "./pete-decision-layer.js";
import { buildPeteRuntimeInfoLinkReply } from "./pete-runtime-safety.js";
import { buildQuestionReply } from "./response-builder.js";

export type PeteResponseComposerContext = {
  campaign: CampaignConfig;
  currentStep?: FlowStepId;
  userText?: string;
  lastAssistantText?: string;
  bookingUrl?: string;
};

export type PeteComposedResponse = {
  text: string;
  nextStep?: FlowStepId;
};

const HARD_STOP_REPLY =
  "Alles klar, danke f\u00fcr die R\u00fcckmeldung. Dann schreibe ich dir dazu nicht weiter.";

const PRICE_CONTEXT_FALLBACK =
  `Der persönliche Einstieg ist das 5-Wochen-Coaching für ${OFFER_TRUTH.coachingEntry.priceText}.\n` +
  `Wenn persönliche Begleitung gerade nicht passt, gibt es den Selbststarter für ${OFFER_TRUTH.selfstarter.priceText}.\n` +
  "Dann können wir kurz schauen, was für deine Situation sinnvoll ist.";

const LINK_CLARIFICATION_REPLY =
  "Geht's dir um die Eltern Vital Methode, den Selbststarter, den Elterncheck oder den Keto Guide?";

const AMBIGUOUS_LINK_REPLY =
  "Klar. Geht's dir um die Eltern Vital Methode, den Selbststarter, den Elterncheck, den Keto Guide oder einen Termin?";

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

function isHttpUrl(value: string | undefined): value is string {
  const url = value?.trim();
  return Boolean(url && (url.startsWith("http://") || url.startsWith("https://")));
}

function hasAggressiveClosingText(text: string): boolean {
  const normalized = normalizeText(text);

  return [
    "buchungslink",
    "checkout",
    "platz sichern",
    "direkt sichern",
    "direkt buchen",
    "direkt kaufen",
    "wenn du direkt starten willst",
  ].some((keyword) => normalized.includes(keyword));
}

function looksMojibake(text: string): boolean {
  return text.includes("Ã") || text.includes("â");
}

function getSafeOfferPriceText(campaign: CampaignConfig): string {
  const priceInquiryText = campaign.offerContext?.priceInquiryText?.trim();

  if (
    priceInquiryText &&
    !hasAggressiveClosingText(priceInquiryText) &&
    !looksMojibake(priceInquiryText)
  ) {
    return priceInquiryText;
  }

  return PRICE_CONTEXT_FALLBACK;
}

function getCoachingEntryPriceText(_campaign: CampaignConfig): string {
  return OFFER_TRUTH.coachingEntry.priceText;
}

function buildDirectPriceReply(campaign: CampaignConfig): string {
  return (
    `Das 5-Wochen-Coaching liegt bei ${getCoachingEntryPriceText(campaign)}.\n` +
    `Der Selbststarter liegt bei ${OFFER_TRUTH.selfstarter.priceText}.\n` +
    `Die 6-Monats-Begleitung liegt regulär bei ${OFFER_TRUTH.longTerm.priceText}; nach dem 5-Wochen-Coaching bleiben durch die Anrechnung noch ${OFFER_TRUTH.longTerm.upgradeBalanceEur?.toLocaleString("de-DE")} € offen.`
  );
}

function buildPriceQuestionReply(campaign: CampaignConfig): string {
  return getSafeOfferPriceText(campaign);
}

function buildPriceObjectionReply(decision: PeteDecision): string {
  const subtype = String(decision.metadata?.priceSubtype ?? "");
  const templateId = String(decision.metadata?.templateId ?? "");

  if (subtype === "installments") {
    return (
      "Ratenzahlung kl\u00e4ren wir am besten kurz pers\u00f6nlich.\n" +
      "Wenn es grunds\u00e4tzlich passen k\u00f6nnte, ist ein kurzes Strategiegespr\u00e4ch der sauberste n\u00e4chste Schritt."
    );
  }

  if (templateId === "price_affordability_selfstarter") {
    return (
      "Verstanden. Dann macht es keinen Sinn, dich auf 499 € zu drücken.\n" +
      `Wenn du erstmal selbst loslegen willst, ist der Selbststarter für ${OFFER_TRUTH.selfstarter.priceText} der sinnvollere Einstieg.\n` +
      `Hier findest du ihn:\n${OFFER_TRUTH.selfstarter.productUrl}`
    );
  }

  return (
    "Verstehe ich.\n" +
    "Gerade deshalb sollte klar sein, ob es \u00fcberhaupt zu deiner Situation passt.\n" +
    "Was m\u00fcsste sich bei dir ver\u00e4ndern, damit es sich \u00fcberhaupt lohnt?"
  );
}

function buildBookingReply(context: PeteResponseComposerContext): string {
  if (isHttpUrl(context.bookingUrl)) {
    return (
      "Ja, das macht Sinn.\n" +
      "Hier kannst du dir direkt ein Strategiegespr\u00e4ch buchen:\n" +
      context.bookingUrl.trim()
    );
  }

  return (
    "Ja, das macht Sinn.\n" +
    "Dann lass uns kurz einen Termin finden.\n" +
    "Wann passt es dir eher: unter der Woche abends, Freitag/Samstag tags\u00fcber oder flexibel?"
  );
}

function buildInfoLinkReply(context: PeteResponseComposerContext): string {
  return buildPeteRuntimeInfoLinkReply(
    context.userText || "infos",
    context.campaign,
    {
      campaign: context.campaign,
      currentStep: context.currentStep,
      lastAssistantText: context.lastAssistantText,
    },
  );
}

function buildOfferInfoReply(): string {
  return (
    "Kurz gesagt: Das persönliche Einstiegsangebot ist das 5-Wochen-Coaching für Eltern im echten Alltag.\n" +
    "Mehr Energie, bessere Struktur und wieder ein besseres Körpergefühl.\n" +
    `Wenn du erstmal selbst loslegen willst, gibt es zusätzlich den Selbststarter für ${OFFER_TRUTH.selfstarter.priceText}.`
  );
}

function buildFrustrationReply(): string {
  return (
    "Verstehe. Dann klingt es nicht nach noch mehr Wissen, sondern danach, dass es im Alltag bisher nicht stabil gegriffen hat.\n" +
    "Was war bisher eher der Knackpunkt: Zeit, Energie oder Dranbleiben?"
  );
}

function buildMedicalCriticalReply(): string {
  return (
    "Da m\u00f6chte ich nichts Falsches sagen.\n" +
    "Bei Medikamenten, Diagnosen oder akuten Beschwerden sollte das sauber \u00e4rztlich abgekl\u00e4rt werden.\n" +
    "Ich gebe das an Jochen weiter, damit du keine unklare Empfehlung bekommst."
  );
}

function buildMedicalSoftReply(): string {
  return (
    "Den gesundheitlichen Hinweis notiere ich mir. Sowas sollte bei Bedarf sauber abgekl\u00e4rt werden.\n" +
    "F\u00fcr die Einordnung hier ist wichtig:\n" +
    "Geht es zus\u00e4tzlich eher um Stress/Schlaf, Energie oder Bauch?"
  );
}

function buildLegalReply(): string {
  return (
    "Das sollte sauber pers\u00f6nlich gekl\u00e4rt werden.\n" +
    "Ich gebe das an Jochen weiter, damit du keine unklare Antwort bekommst."
  );
}

function buildEmotionalCrisisReply(): string {
  return (
    "Das klingt gerade nach mehr als einem normalen Alltagsthema.\n" +
    "Ich m\u00f6chte hier nichts glattb\u00fcgeln.\n" +
    "Ich gebe das an Jochen weiter, damit er pers\u00f6nlich draufschaut."
  );
}

function buildHandoffPendingReply(): string {
  return (
    "Ich habe das schon weitergegeben.\n" +
    "Bevor ich hier automatisch weiterantworte, sollte das pers\u00f6nlich gekl\u00e4rt werden."
  );
}

function buildTrustReply(): string {
  return (
    "Kann ich verstehen.\n" +
    "Online wird viel versprochen, deshalb drücke ich dich hier in nichts rein.\n" +
    "Soll ich dir erst den kostenlosen Elterncheck schicken?"
  );
}

function buildSoftNoReply(decision: PeteDecision): string {
  if (decision.metadata?.shouldClose) {
    return (
      "Alles gut, danke f\u00fcr die Ehrlichkeit.\n" +
      "Dann macht es gerade keinen Sinn, dich weiter durch den Funnel zu f\u00fchren.\n" +
      "Wenn es sp\u00e4ter doch relevant wird, kannst du dich melden."
    );
  }

  return (
    "Alles gut, danke f\u00fcr die Ehrlichkeit.\n" +
    "Ist es grunds\u00e4tzlich kein Thema f\u00fcr dich oder gerade einfach nicht der richtige Zeitpunkt?"
  );
}

function buildObjectionReply(decision: PeteDecision): string {
  const intent = String(decision.metadata?.objectionIntent ?? "");

  if (intent === "trust") {
    return buildTrustReply();
  }

  if (intent === "no_interest") {
    return buildSoftNoReply(decision);
  }

  if (intent === "time") {
    return (
      "Verstehe ich.\n" +
      "Dann halten wir es kurz.\n" +
      "Soll ich dir stattdessen den kostenlosen Elterncheck schicken?"
    );
  }

  if (intent === "info") {
    return LINK_CLARIFICATION_REPLY;
  }

  if (intent === "think") {
    return (
      "V\u00f6llig okay.\n" +
      "Sowas muss sich stimmig anf\u00fchlen.\n" +
      "Was ist gerade noch offen: Zeit, Preis oder ob es grunds\u00e4tzlich passt?"
    );
  }

  if (intent === "partner") {
    return (
      "Verstehe ich.\n" +
      "Gerade bei so einer Entscheidung ist es sinnvoll, wenn ihr beide denselben Stand habt.\n" +
      "Soll ich dir den Elterncheck schicken, den ihr gemeinsam anschauen könnt?"
    );
  }

  return (
    "Verstehe ich.\n" +
    "Dann lass uns keinen Druck draus machen.\n" +
    "Was w\u00e4re f\u00fcr dich der kleinste sinnvolle n\u00e4chste Schritt?"
  );
}

function buildIntroQuestionReply(
  context: PeteResponseComposerContext,
): PeteComposedResponse {
  if (!context.currentStep) {
    return {
      text: "Alles klar. Dann starten wir kurz mit der ersten Frage.",
    };
  }

  const nextStep = getNextFlowStep(context.campaign.id, context.currentStep);

  if (!nextStep) {
    return {
      text: "Alles klar. Dann starten wir kurz mit der ersten Frage.",
    };
  }

  return {
    text: buildQuestionReply(context.campaign.id, nextStep),
    nextStep: nextStep.id,
  };
}

function buildFallbackReply(decision: PeteDecision): string {
  if (decision.action === "handoff" || decision.metadata?.handoffActive) {
    return buildHandoffPendingReply();
  }

  return (
    "Danke dir.\n" +
    "Damit ich dich sauber einordne: Geht es bei dir gerade eher um Energie, Bauch, Schlaf/Stress oder Struktur?"
  );
}

export function composePeteResponse(
  decision: PeteDecision,
  context: PeteResponseComposerContext,
): PeteComposedResponse | null {
  switch (decision.decisionType) {
    case "hard_stop":
      return { text: HARD_STOP_REPLY, nextStep: "done" };
    case "medical_critical":
      return { text: buildMedicalCriticalReply() };
    case "medical_soft":
      return { text: buildMedicalSoftReply() };
    case "legal_privacy":
      return { text: buildLegalReply() };
    case "emotional_crisis":
      return { text: buildEmotionalCrisisReply() };
    case "human_request":
    case "booking_request":
      return { text: buildBookingReply(context), nextStep: "booking" };
    case "link_request": {
      const target = String(decision.metadata?.linkTarget ?? "");
      if (target === "info") {
        return { text: buildInfoLinkReply(context), nextStep: "info_only" };
      }
      if (target === "booking") {
        return { text: buildBookingReply(context), nextStep: "booking" };
      }
      return {
        text: target === "info_clarify" ? LINK_CLARIFICATION_REPLY : AMBIGUOUS_LINK_REPLY,
      };
    }
    case "price_question":
      return {
        text: decision.metadata?.directPrice
          ? buildDirectPriceReply(context.campaign)
          : buildPriceQuestionReply(context.campaign),
      };
    case "price_objection":
      return {
        text:
          decision.action === "offer_booking" &&
          decision.metadata?.priceSubtype === "installments" &&
          isHttpUrl(context.bookingUrl)
            ? `${buildPriceObjectionReply(decision)}\n${context.bookingUrl.trim()}`
            : buildPriceObjectionReply(decision),
        nextStep: decision.action === "offer_booking" ? "booking" : undefined,
      };
    case "objection":
      return { text: buildObjectionReply(decision) };
    case "offer_info":
      return { text: buildOfferInfoReply(), nextStep: "info_only" };
    case "frustration_previous_attempts":
      return { text: buildFrustrationReply() };
    case "question_intro_confirmed":
      return buildIntroQuestionReply(context);
    case "fallback":
      return { text: buildFallbackReply(decision) };
    case "normal_funnel":
      return null;
    default:
      return {
        text: buildFallbackReply(decision),
      };
  }
}
