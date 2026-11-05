import { getCampaignById } from "../config/campaigns.js";
import {
  getBookingConfirmedText,
  getBookingFollowUpPrompt,
  getBookingNoShowGuardText,
  getBookingPrompt,
} from "../domain/booking-rules.js";
import { getInfoLinkReply, getInfoOnlyReply } from "../domain/info-path.js";
import {
  getCoachingEntryDirectBuyReply,
  getCoachingEntryPriceReply,
  getInstallmentsReply,
  getLongTermReply,
  getSelfstarterReply,
} from "../domain/pricing-rules.js";
import type {
  CampaignConfig,
  ChatMessage,
  ConversationState,
  FlowStepDefinition,
  FlowStepId,
  LeadIntent,
} from "../types/types.js";

function formatChoiceOptions(step: FlowStepDefinition): string {
  if (!step.options || step.options.length === 0) {
    return "";
  }

  return step.options.map((option) => `${option.key}) ${option.label}`).join("\n");
}

function joinPromptWithOptions(step: FlowStepDefinition): string {
  const prompt = step.prompt?.trim() ?? "";
  const optionsText = formatChoiceOptions(step);

  if (!prompt && !optionsText) {
    return "";
  }

  if (!optionsText) {
    return prompt;
  }

  return `${prompt}\n\n${optionsText}`;
}

function fallbackText(text: string, fallback: string): string {
  return text.trim() || fallback;
}

export function buildIntroText(campaignId: string, name?: string): string {
  const campaign = getCampaignById(campaignId);
  const safeName = name?.trim() ? name.trim() : "dir";

  return campaign.texts.introTemplate.replace("[Name]", safeName);
}

export function buildStepPrompt(campaignId: string, stepId: FlowStepId): string {
  const campaign = getCampaignById(campaignId);
  const step = campaign.flow.find((item) => item.id === stepId);

  if (!step) {
    return "";
  }

  return joinPromptWithOptions(step);
}

export function buildQuestionReply(
  campaignId: string,
  step: FlowStepDefinition,
): string {
  return joinPromptWithOptions(step);
}

export function buildPriceReply(campaignId: string): string {
  return getCoachingEntryPriceReply(campaignId);
}

export function buildInstallmentsReply(campaignId: string): string {
  return getInstallmentsReply(campaignId);
}

export function buildLongTermReply(campaignId: string): string {
  return getLongTermReply(campaignId);
}

export function buildDirectBuyCoachingEntryReply(campaignId: string): string {
  return getCoachingEntryDirectBuyReply(campaignId);
}

/** @deprecated Legacy alias. */
export const buildDirectBuyStarterReply = buildDirectBuyCoachingEntryReply;

export function buildSelfstarterReply(): string {
  return getSelfstarterReply();
}

export function buildInfoOnlyReply(campaignId: string): string {
  return getInfoOnlyReply(campaignId);
}

export function buildInfoLinkReply(campaignId: string): string {
  return getInfoLinkReply(campaignId);
}

export function buildBookingPrompt(campaignId: string): string {
  return getBookingPrompt(campaignId);
}

export function buildBookingFollowUpReply(campaignId: string): string {
  return getBookingFollowUpPrompt(campaignId);
}

export function buildBookingNoShowGuardReply(
  campaignId: string,
  params: { day?: string; time?: string; bookingText?: string },
): string {
  return getBookingNoShowGuardText(campaignId, params);
}

export function buildBookingConfirmedReply(
  campaignId: string,
  params: { day?: string; time?: string; bookingText?: string },
): string {
  return getBookingConfirmedText(campaignId, params);
}

export function buildIntentReply(campaignId: string, intent: LeadIntent): string {
  switch (intent) {
    case "price_question":
      return buildPriceReply(campaignId);
    case "installments":
      return buildInstallmentsReply(campaignId);
    case "long_term_support":
      return buildLongTermReply(campaignId);
    case "direct_buy_coaching_entry":
      return buildDirectBuyCoachingEntryReply(campaignId);
    case "selfstarter_interest":
      return buildSelfstarterReply();
    case "info_only":
      return buildInfoOnlyReply(campaignId);
    case "info_link_only":
      return buildInfoLinkReply(campaignId);
    case "booking_intent":
      return buildBookingPrompt(campaignId);
    case "stop":
      return "Alles klar, danke für die Rückmeldung. Dann schreibe ich dir dazu nicht weiter.";
    default:
      return "";
  }
}

export function buildChoiceValidationReply(): string {
  return "Antworte mir hier bitte einfach mit a, b, c oder d.";
}

export function buildScaleValidationReply(): string {
  return "Schick mir bitte einfach eine Zahl von 1-10.";
}

export function buildNameValidationReply(): string {
  return "Schreib mir bitte kurz deinen Vornamen.";
}

export function buildCommitmentValidationReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);
  const prompt = campaign.texts.commitmentPrompt.trim();

  return `${prompt}\n\na) wirklich angehen\nb) erstmal Infos`;
}

export function buildIntroAckValidationReply(campaignId: string): string {
  const campaign = getCampaignById(campaignId);

  return fallbackText(
    campaign.texts.introAckValidationReply,
    "Wenn du willst, gehen wir’s kurz sauber durch. Wenn du lieber direkt Infos, den Preis oder einen Link willst, sag’s einfach direkt.",
  );
}

export function buildSimpleMirrorReply(params: {
  state: ConversationState;
  userText: string;
}): string {
  const cleaned = params.userText.trim();

  if (!cleaned) {
    return "Verstanden.";
  }

  const namePrefix = params.state.answers.name
    ? `${params.state.answers.name}, `
    : "";

  return `${namePrefix}danke dir.`;
}

export function buildFreestyleFallbackReply(): string {
  return "Verstanden. Lass uns kurz bei dem Punkt bleiben.";
}

/** Pure legacy reply builders extracted from the conversation engine. */
export function buildDoneReply(
  state: ConversationState,
): string {
  const bookingText = state.answers.pendingBookingText?.trim();
  if (bookingText) {
    return `Sehr gern 👍 Dann bis ${bookingText}.`;
  }
  return "Sehr gern 👍";
}

export function buildPauseReply(): string {
  return "Klar, kein Thema. Zwischen Tür und Angel das hier durchzudrücken macht keinen Sinn.\nMelde dich einfach wieder, wenn du mehr Zeit hast.\nIch knüpfe dann da an, wo wir aufgehört haben.";
}

export function buildResumeReply(question: string): string {
  return `Willkommen zurück 😊\nWir waren gerade hier:\n${question}`;
}

export function buildPlayfulNameReply(): string {
  return "Ja genau du 😄 Stell dich doch kurz mit deinem Vornamen vor. Ich spreche dich ungern mit Nobody an.";
}

export function buildMultiplePeopleReply(): string {
  return "Falls ihr zu zweit seid, geht bitte nicht gemeinsam durch die Fragen. Am besten macht das jeder einzeln und mit eigener WhatsApp Nummer. Und jetzt erstmal du: Wie ist dein Vorname?";
}

export function buildLowScoreReply(campaignId: string, score: number): string {
  const infoReply = buildInfoOnlyReply(campaignId);

  if (score <= 5) {
    return (
      "Danke für die ehrliche Einschätzung.\n" +
      "Dann macht es gerade wenig Sinn, hier auf Biegen und Brechen einen Termin festzumachen.\n" +
      "Schau dir erstmal in Ruhe die Infos an.\n\n" +
      infoReply
    );
  }

  return (
    "Danke für die ehrliche Einschätzung.\n" +
    "Ich merke, das Thema ist grundsätzlich da, aber gerade noch nicht so klar auf Anschlag.\n" +
    "Deshalb schicke ich dir erstmal die Infos in Ruhe rüber, statt dich direkt in einen Termin zu drücken.\n\n" +
    infoReply
  );
}

export function buildAvailabilitySuggestionReply(
  suggestions: { label: string }[],
): string {
  const topSuggestions = suggestions.slice(0, 3).map((item) => item.label);

  if (topSuggestions.length === 0) {
    return "Ich hab hier leider keinen freien Termin. Nenn mir bitte kurz eine Alternative innerhalb der nächsten 3 Werktage, dann schauen wir direkt weiter.";
  }

  return (
    "Ich hab hier leider keinen freien Termin.\n" +
    `Ich kann dir stattdessen ${topSuggestions.join(", ")} anbieten.\n` +
    "Was passt dir davon am besten?"
  );
}

export function buildBookingGuardReply(finalBookingText: string): string {
  return (
    `Alles klar, dann blocke ich dir ${finalBookingText}.\n` +
    "Kurze Bitte noch:\n" +
    "Ich halte mir die Zeit bewusst frei.\n" +
    "Passt das für dich, dass du den Termin auch wirklich wahrnimmst oder rechtzeitig Bescheid gibst, falls etwas dazwischenkommt?"
  );
}

export function buildCoachingEntryDirectBuyLeadReply(campaignId: string): string {
  return (
    "Mega 👊\n\n" +
    `${buildIntentReply(campaignId, "direct_buy_coaching_entry")}\n\n` +
    "Danke für dein Vertrauen."
  );
}

export function buildProviderBookingPendingReply(): string {
  return (
    "Sobald du den Termin über den Link final eingetragen hast, sag mir kurz Bescheid.\n" +
    "Wenn du den Buchungslink nochmal brauchst, schreib einfach kurz Link."
  );
}

export function buildProviderBookingSimpleAckReply(): string {
  return (
    "Perfekt 👍\n\n" +
    "Dann trag dir den Termin einfach noch kurz über den Link final ein.\n" +
    "Wenn du durch bist, schreib mir kurz „hab gebucht“.\n" +
    "Und falls du den Link nochmal brauchst, schreib einfach „Link“."
  );
}


export function getCampaignTexts(campaignId: string): CampaignConfig["texts"] {
  return getCampaignById(campaignId).texts;
}

export function getLastUserMessage(state: ConversationState): ChatMessage | undefined {
  const reversed = [...state.messages].reverse();
  return reversed.find((message) => message.role === "user");
}
