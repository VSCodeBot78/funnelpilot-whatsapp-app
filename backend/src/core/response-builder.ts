import { getCampaignById } from "../config/campaigns.js";
import {
  getBookingConfirmedText,
  getBookingFollowUpPrompt,
  getBookingNoShowGuardText,
  getBookingPrompt,
} from "../domain/booking-rules.js";
import { getInfoLinkReply, getInfoOnlyReply } from "../domain/info-path.js";
import {
  getInstallmentsReply,
  getLongTermReply,
  getStarterDirectBuyReply,
  getStarterPriceReply,
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
  return getStarterPriceReply(campaignId);
}

export function buildInstallmentsReply(campaignId: string): string {
  return getInstallmentsReply(campaignId);
}

export function buildLongTermReply(campaignId: string): string {
  return getLongTermReply(campaignId);
}

export function buildDirectBuyStarterReply(campaignId: string): string {
  return getStarterDirectBuyReply(campaignId);
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
    case "direct_buy_starter":
      return buildDirectBuyStarterReply(campaignId);
    case "info_only":
      return buildInfoOnlyReply(campaignId);
    case "info_link_only":
      return buildInfoLinkReply(campaignId);
    case "booking_intent":
      return buildBookingPrompt(campaignId);
    case "stop":
      return "Alles klar, ich schreibe dir nicht weiter.";
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

export function getCampaignTexts(campaignId: string): CampaignConfig["texts"] {
  return getCampaignById(campaignId).texts;
}

export function getLastUserMessage(state: ConversationState): ChatMessage | undefined {
  const reversed = [...state.messages].reverse();
  return reversed.find((message) => message.role === "user");
}
