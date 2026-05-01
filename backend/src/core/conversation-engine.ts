import { getCampaignById } from "../config/campaigns.js";
import {
  detectBookingPreference,
  detectBookingRequest,
  detectBookingWindow,
  getBookingPreferenceFollowUpText,
  isNoShowGuardConfirmation,
} from "../domain/booking-rules.js";
import { parseCommitmentChoice } from "../domain/commitment.js";
import {
  buildAdOrWaMeOpenerReply,
  isAdOrWaMeOpener,
} from "../domain/entry-detector.js";
import {
  isFollowUpInfoLinkRequest,
  isInfoLinkOnlyRequest,
  isInfoOnlyRequest,
} from "../domain/info-path.js";
import {
  isMultiplePeopleIntroduction,
  isPlayfulUnknownNameInput,
  parseName,
} from "../domain/name-parser.js";
import {
  canSendStarterCheckoutDirectly,
  mustGoToCall,
} from "../domain/pricing-rules.js";
import {
  generateAlreadyTriedBridgeReply,
  generateConsequenceBridgeReply,
} from "../services/ai-funnel.service.js";
import {
  checkStaticAvailability,
  formatAvailabilitySlot,
} from "../services/availability.service.js";
import {
  activateProviderBookingState,
  markProviderBookingBooked,
} from "../services/provider-booking.service.js";
import { buildSchedulingPreviewFromState } from "../services/scheduling-request.service.js";
import type {
  BookingRequestData,
  EngineInput,
  EngineReply,
  FlowStepDefinition,
  FlowStepId,
  SuggestedBookingOption,
} from "../types/types.js";
import {
  getCommitmentBranches,
  getFlowStepById,
  getNextFlowStep,
} from "./flow-definition.js";
import { detectLeadIntent } from "./intent-detector.js";
import {
  appendAssistantMessage,
  appendUserMessage,
  getOrCreateConversationState,
  patchAnswers,
  patchFlags,
  persistConversationState,
  setCurrentStep,
  updateAnswer,
} from "./state-manager.js";
import {
  buildBookingConfirmedReply,
  buildBookingPrompt,
  buildChoiceValidationReply,
  buildCommitmentValidationReply,
  buildInfoLinkReply,
  buildInfoOnlyReply,
  buildInstallmentsReply,
  buildIntentReply,
  buildIntroAckValidationReply,
  buildIntroText,
  buildLongTermReply,
  buildNameValidationReply,
  buildPriceReply,
  buildQuestionReply,
  buildScaleValidationReply,
} from "./response-builder.js";
import {
  buildExecutionBinaryBookingReply,
  buildExecutionBinaryChoiceValidationReply,
  buildExecutionBinaryConsistencyReply,
  buildExecutionBinaryEnergyReply,
  buildExecutionBinaryInfoReply,
  buildExecutionBinaryTimeReply,
  buildExecutionConsistencyReply,
  buildExecutionEnergyReply,
  buildExecutionTernaryChoiceValidationReply,
  buildExecutionTimeReply,
  buildExecutionUnknownReply,
  buildPriceExecutionFollowUpReply,
  buildPriceObjectionReply,
  buildPriceSelfFollowUpReply,
  buildPriceSelfInstallmentsReply,
  buildPriceUnclearFollowUpReply,
  buildSoftPriceInfoReply,
  classifyExecutionDetail,
  classifyPriceObjectionFollowUp,
} from "./price-flow.js";

const INTRO_ACK_YES_KEYWORDS = [
  "ja",
  "jap",
  "yes",
  "klar",
  "ok",
  "okay",
  "gerne",
  "passt",
  "mach",
  "go",
  "weiter",
];

const POST_DONE_THANKS_KEYWORDS = [
  "danke",
  "super danke",
  "perfekt",
  "top danke",
  "alles klar danke",
  "vielen dank",
  "dankeschön",
  "dankeschoen",
];

const PAUSE_KEYWORDS = [
  "muss los",
  "muss jetzt los",
  "muss weiter",
  "später",
  "spaeter",
  "gerade keine zeit",
  "hab gerade keine zeit",
  "habe gerade keine zeit",
  "bin unterwegs",
  "bin grad unterwegs",
  "bin gerade unterwegs",
  "melde mich später",
  "melde mich spaeter",
  "ich melde mich später",
  "ich melde mich spaeter",
  "sorry muss los",
  "entschuldigung muss los",
  "muss erstmal los",
  "muss erst mal los",
  "muss kurz los",
  "muss weg",
];

const PROVIDER_BOOKING_DONE_KEYWORDS = [
  "hab gebucht",
  "habe gebucht",
  "ist gebucht",
  "termin ist gebucht",
  "termin steht",
  "eingetragen",
  "habe mich eingetragen",
  "hab mich eingetragen",
  "erledigt",
  "gemacht",
];

const PROVIDER_BOOKING_LINK_KEYWORDS = [
  "link",
  "buchungslink",
  "calendly",
  "nochmal",
  "erneut",
  "wieder",
  "schick nochmal",
  "schick den link",
  "send nochmal",
  "sende nochmal",
];

const SIMPLE_ACK_KEYWORDS = [
  "ok",
  "okay",
  "alles klar",
  "klar",
  "passt",
  "verstanden",
  "gut",
  "super",
];

const STARTER_BUY_SIGNAL_KEYWORDS = [
  "gekauft",
  "kauf ich",
  "kauf ich direkt",
  "nehm ich",
  "ich nehme es",
  "nehme ich",
  "passt",
  "wo kann ich buchen",
  "wo kann ich kaufen",
  "wo kann ich zahlen",
  "was muss ich weiter tun zum kaufen",
  "was muss ich tun zum kaufen",
  "wie gehts weiter",
  "wie geht's weiter",
  "schick link",
  "schick mir den link",
  "buchungslink",
  "direkt kaufen",
  "ich will kaufen",
  "ich will starten",
  "ich nehme das",
  "nehmen wir",
  "mache ich",
  "mach ich",
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function isIntroAckAccepted(input: string): boolean {
  const normalized = normalizeText(input);
  if (!normalized) {
    return false;
  }

  return INTRO_ACK_YES_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

function isPostDoneThanks(input: string): boolean {
  const normalized = normalizeText(input);
  if (!normalized) {
    return false;
  }

  return POST_DONE_THANKS_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

function isPauseRequest(input: string): boolean {
  const normalized = normalizeText(input);
  if (!normalized) {
    return false;
  }

  return PAUSE_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

function isChoiceKey(input: string, allowedKeys: string[]): boolean {
  const normalized = input.trim().toLowerCase();
  return allowedKeys.includes(normalized);
}

function isScaleValue(input: string, min: number, max: number): boolean {
  const numeric = Number(input.trim());
  return Number.isInteger(numeric) && numeric >= min && numeric <= max;
}

function getStepOrThrow(
  campaignId: string,
  stepId: FlowStepId,
): FlowStepDefinition {
  const step = getFlowStepById(campaignId, stepId);
  if (!step) {
    throw new Error(`Flow step "${stepId}" not found for campaign "${campaignId}".`);
  }
  return step;
}

function buildDoneReply(
  state: ReturnType<typeof getOrCreateConversationState>,
): string {
  const bookingText = state.answers.pendingBookingText?.trim();
  if (bookingText) {
    return `Sehr gern 👍 Dann bis ${bookingText}.`;
  }
  return "Sehr gern 👍";
}

function buildBookingRequestData(params: {
  requestedText: string;
  requestedDay?: string;
  requestedTimeText?: string;
  requestedPreference: "vormittags" | "nachmittags" | "unknown";
  status: "requested" | "confirmed";
}): BookingRequestData {
  return {
    requestedText: params.requestedText,
    requestedDay: params.requestedDay,
    requestedTimeText: params.requestedTimeText,
    requestedPreference: params.requestedPreference,
    detectedAt: nowIso(),
    status: params.status,
  };
}

function buildResumeQuestion(campaignId: string, stepId: FlowStepId): string {
  if (stepId === "ask_name") {
    return buildNameValidationReply();
  }

  if (stepId === "intro_ack") {
    return buildIntroAckValidationReply(campaignId);
  }

  if (stepId === "booking") {
    return "Wir waren gerade bei der Terminfindung. Nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich gut passt.";
  }

  if (stepId === "info_only") {
    return buildInfoOnlyReply(campaignId);
  }

  const step = getFlowStepById(campaignId, stepId);
  if (!step) {
    return "Schreib mir einfach kurz, dann knüpfen wir da an, wo wir aufgehört haben.";
  }

  return buildQuestionReply(campaignId, step);
}

function buildPauseReply(): string {
  return "Klar, kein Thema. Zwischen Tür und Angel das hier durchzudrücken macht keinen Sinn.\nMelde dich einfach wieder, wenn du mehr Zeit hast.\nIch knüpfe dann da an, wo wir aufgehört haben.";
}

function buildResumeReply(question: string): string {
  return `Willkommen zurück 😊\nWir waren gerade hier:\n${question}`;
}

function buildPlayfulNameReply(): string {
  return "Ja genau du 😄 Stell dich doch kurz mit deinem Vornamen vor. Ich spreche dich ungern mit Nobody an.";
}

function buildMultiplePeopleReply(): string {
  return "Falls ihr zu zweit seid, geht bitte nicht gemeinsam durch die Fragen. Am besten macht das jeder einzeln und mit eigener WhatsApp Nummer. Und jetzt erstmal du: Wie ist dein Vorname?";
}

function buildLowScoreReply(campaignId: string, score: number): string {
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

function buildAvailabilitySuggestionReply(
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

function buildBookingGuardReply(finalBookingText: string): string {
  return (
    `Alles klar, dann blocke ich dir ${finalBookingText}.\n` +
    "Kurze Bitte noch:\n" +
    "Ich halte mir die Zeit bewusst frei.\n" +
    "Passt das für dich, dass du den Termin auch wirklich wahrnimmst oder rechtzeitig Bescheid gibst, falls etwas dazwischenkommt?"
  );
}

function getExternalProviderPreview(
  state: ReturnType<typeof getOrCreateConversationState>,
) {
  const preview = buildSchedulingPreviewFromState(state);

  if (!preview.ok || !preview.ready || !preview.schedulingRequest) {
    return null;
  }

  const { schedulingRequest } = preview;

  if (
    schedulingRequest.providerMode !== "booking_link" ||
    !schedulingRequest.externalBookingUrl
  ) {
    return null;
  }

  return schedulingRequest;
}

function buildProviderBookingLinkReply(
  baseReply: string,
  state: ReturnType<typeof getOrCreateConversationState>,
): string {
  const schedulingRequest = getExternalProviderPreview(state);

  if (!schedulingRequest) {
    return baseReply;
  }

  state.providerBooking = activateProviderBookingState({
    current: state.providerBooking,
    provider: schedulingRequest.provider,
    bookingUrl: schedulingRequest.externalBookingUrl,
    linkSentAt: nowIso(),
  });

  if (schedulingRequest.provider === "calendly") {
    return (
      "Top, danke dir 👍\n\n" +
      "Deine Zeit ist intern vorgemerkt.\n" +
      "Damit der Termin wirklich verbindlich steht, trag ihn dir bitte jetzt noch kurz final über Calendly ein:\n" +
      `${schedulingRequest.externalBookingUrl}\n\n` +
      "Sobald das erledigt ist, steht unser Gespräch verbindlich.\n" +
      "Die Terminbestätigung bekommst du danach automatisch per Mail."
    );
  }

  const providerName =
    schedulingRequest.providerLabel ?? schedulingRequest.provider;

  return (
    `${baseReply}\n\n` +
    "Dann fehlt jetzt nur noch der letzte Schritt:\n" +
    `Trag dir den Termin bitte noch kurz final über ${providerName} ein:\n` +
    `${schedulingRequest.externalBookingUrl}\n\n` +
    "Sobald das erledigt ist, steht unser Gespräch verbindlich.\n" +
    "Die Terminbestätigung bekommst du danach automatisch per Mail."
  );
}

function parseNumberSelection(input: string): number | null {
  const normalized = normalizeText(input);

  if (["1", "erste", "der erste", "die erste", "erstes"].includes(normalized)) {
    return 0;
  }

  if (["2", "zweite", "der zweite", "die zweite", "zweites"].includes(normalized)) {
    return 1;
  }

  if (["3", "dritte", "der dritte", "die dritte", "drittes"].includes(normalized)) {
    return 2;
  }

  return null;
}

function tryMatchSuggestedOption(
  input: string,
  options: SuggestedBookingOption[] | undefined,
): SuggestedBookingOption | null {
  if (!options || options.length === 0) {
    return null;
  }

  const byNumber = parseNumberSelection(input);
  if (byNumber !== null && options[byNumber]) {
    return options[byNumber];
  }

  const normalized = normalizeText(input);
  const normalizedNoSpaces = normalized.replace(/\s+/g, "");

  for (const option of options) {
    const optionLabel = normalizeText(option.label);
    const optionDay = normalizeText(option.day);
    const optionTime = normalizeText(option.time);

    const fullDayTimeVariants = [
      `${optionDay} ${optionTime}`,
      `${optionDay} um ${optionTime}`,
      `${optionDay}${optionTime}`,
      `${optionDay}${optionTime.replace(":", "")}`,
      `${optionDay} ${optionTime.replace(":", "")}`,
      `${optionDay} ${optionTime.slice(0, 2)}uhr${optionTime.slice(3)}`,
      `${optionDay} ${optionTime.slice(0, 2)}:${optionTime.slice(3)}`,
      `${optionDay} ${optionTime.slice(0, 2)} uhr ${optionTime.slice(3)}`,
      `${optionDay} ${optionTime.slice(0, 2)}:${optionTime.slice(3)} uhr`,
      `${optionDay} ${optionTime.slice(0, 2)}uhr`,
    ].map((value) => normalizeText(value));

    if (normalized === optionLabel) {
      return option;
    }

    if (fullDayTimeVariants.includes(normalized)) {
      return option;
    }

    if (
      normalized.includes(optionDay) &&
      (
        normalized.includes(optionTime) ||
        normalized.includes(optionTime.replace(":", "")) ||
        normalized.includes(`${optionTime.slice(0, 2)}:${optionTime.slice(3)}`) ||
        normalized.includes(`${optionTime.slice(0, 2)}uhr${optionTime.slice(3)}`) ||
        normalized.includes(`${optionTime.slice(0, 2)} uhr ${optionTime.slice(3)}`) ||
        normalized.includes(`${optionTime.slice(0, 2)}:${optionTime.slice(3)} uhr`) ||
        normalized.includes(`${optionTime.slice(0, 2)}uhr`)
      )
    ) {
      return option;
    }

    const compactOption = `${optionDay}${optionTime.replace(":", "")}`;
    if (normalizedNoSpaces.includes(compactOption)) {
      return option;
    }
  }

  return null;
}

function getPendingAiFollowUpQuestion(
  state: ReturnType<typeof getOrCreateConversationState>,
): string | undefined {
  const value = state.answers.pendingAiFollowUpQuestion;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getPendingAiReturnStep(
  state: ReturnType<typeof getOrCreateConversationState>,
): FlowStepId | undefined {
  const value = state.answers.pendingAiReturnStep;
  return typeof value === "string" && value.trim()
    ? (value.trim() as FlowStepId)
    : undefined;
}

function getPendingAiSource(
  state: ReturnType<typeof getOrCreateConversationState>,
): string | undefined {
  const value = state.answers.pendingAiSource;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resetPriceFlowState(
  state: ReturnType<typeof getOrCreateConversationState>,
): void {
  patchAnswers(state, {
    priceObjectionOpen: undefined,
    priceObjectionCategory: undefined,
    priceObjectionFollowUpText: undefined,
    priceObjectionExecutionDetail: undefined,
    priceObjectionExecutionText: undefined,
    priceExecutionChoice: undefined,
    priceExecutionBinaryChoice: undefined,
  });
}

function hasActiveProviderBooking(
  state: ReturnType<typeof getOrCreateConversationState>,
): boolean {
  return (
    state.providerBooking?.status === "awaiting_booking" &&
    !!state.providerBooking.bookingUrl
  );
}

function isProviderBookingCompletion(input: string): boolean {
  const normalized = normalizeText(input);
  if (!normalized) {
    return false;
  }

  return PROVIDER_BOOKING_DONE_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

function isProviderBookingLinkRequest(input: string): boolean {
  const normalized = normalizeText(input);
  if (!normalized) {
    return false;
  }

  const hasLinkSignal = PROVIDER_BOOKING_LINK_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );

  return hasLinkSignal && normalized.includes("link");
}

function isSimpleAcknowledgement(input: string): boolean {
  const normalized = normalizeText(input);
  if (!normalized) {
    return false;
  }

  return SIMPLE_ACK_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

function isStrongStarterBuySignal(input: string): boolean {
  const normalized = normalizeText(input);

  if (!normalized) {
    return false;
  }

  return STARTER_BUY_SIGNAL_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

function buildStarterDirectBuyLeadReply(campaignId: string): string {
  return (
    "Mega 👊\n\n" +
    `${buildIntentReply(campaignId, "direct_buy_starter")}\n\n` +
    "Danke für dein Vertrauen."
  );
}

function buildProviderBookingResendReply(
  state: ReturnType<typeof getOrCreateConversationState>,
): string {
  const preview = getExternalProviderPreview(state);
  const bookingUrl =
    state.providerBooking?.bookingUrl || preview?.externalBookingUrl || "";
  const providerName =
    preview?.providerLabel || state.providerBooking?.provider || "dem Buchungslink";

  return (
    "Klar 👍\n\n" +
    `Hier ist der Link nochmal für die finale Eintragung über ${providerName}:\n` +
    `${bookingUrl}\n\n` +
    "Wenn du durch bist, sag mir kurz Bescheid."
  );
}

function buildProviderBookingPendingReply(): string {
  return (
    "Sobald du den Termin über den Link final eingetragen hast, sag mir kurz Bescheid.\n" +
    "Wenn du den Buchungslink nochmal brauchst, schreib einfach kurz Link."
  );
}

function buildProviderBookingSimpleAckReply(): string {
  return (
    "Perfekt 👍\n\n" +
    "Dann trag dir den Termin einfach noch kurz über den Link final ein.\n" +
    "Wenn du durch bist, schreib mir kurz „hab gebucht“.\n" +
    "Und falls du den Link nochmal brauchst, schreib einfach „Link“."
  );
}

async function tryHandleExecutionImmediateBooking(
  campaignId: string,
  state: ReturnType<typeof getOrCreateConversationState>,
  inputText: string,
): Promise<EngineReply | null> {
  const bookingRequest = detectBookingRequest(inputText);

  if (!bookingRequest.hasConcreteRequest || !bookingRequest.requestedText) {
    return null;
  }

  const availability = await checkStaticAvailability({
    requestedDayLabel: bookingRequest.requestedDay,
    requestedTimeText: bookingRequest.requestedTimeText,
    requestedPreference:
      bookingRequest.preference !== "unknown"
        ? bookingRequest.preference
        : state.answers.bookingRequest?.requestedPreference ?? "unknown",
  });

  if (!availability.isBookable) {
    const suggestedOptions: SuggestedBookingOption[] = availability.suggestions
      .slice(0, 3)
      .map((slot) => ({
        day: formatAvailabilitySlot(slot).split(" um ")[0],
        time: slot.time,
        label: formatAvailabilitySlot(slot),
      }));

    patchAnswers(state, {
      lastSuggestedBookingOptions: suggestedOptions,
    });

    const replyText = buildAvailabilitySuggestionReply(
      suggestedOptions.map((option) => ({ label: option.label })),
    );

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "booking",
      detectedIntent: "booking_intent",
      state,
    };
  }

  const matchedSlot = availability.matchedSlot;
  const finalBookingText = matchedSlot
    ? formatAvailabilitySlot(matchedSlot)
    : bookingRequest.requestedText;

  patchAnswers(state, {
    pendingBookingText: finalBookingText,
    pendingBookingDay: bookingRequest.requestedDay,
    pendingBookingTime: matchedSlot ? matchedSlot.time : bookingRequest.requestedTimeText,
    bookingRequest: buildBookingRequestData({
      requestedText: finalBookingText,
      requestedDay: bookingRequest.requestedDay,
      requestedTimeText: matchedSlot ? matchedSlot.time : bookingRequest.requestedTimeText,
      requestedPreference:
        bookingRequest.preference !== "unknown"
          ? bookingRequest.preference
          : state.answers.bookingRequest?.requestedPreference ?? "unknown",
      status: "requested",
    }),
    lastSuggestedBookingOptions: undefined,
  });

  resetPriceFlowState(state);
  patchFlags(state, { wantsBooking: true });
  setCurrentStep(state, "booking");

  const replyText = buildBookingGuardReply(finalBookingText);
  appendAssistantMessage(state, replyText);
  persistConversationState(state);

  return {
    text: replyText,
    nextStep: "booking",
    detectedIntent: "booking_intent",
    state,
  };
}

export async function processIncomingMessage(
  input: EngineInput,
): Promise<EngineReply> {
  const campaign = getCampaignById(input.campaignId);
  const state = getOrCreateConversationState(input.leadId, campaign.id);

  appendUserMessage(state, input.messageText);

  if (state.flags.stopped) {
    const replyText = "Alles klar, ich schreibe dir nicht weiter.";
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: "stop",
      state,
    };
  }

  if (state.flags.paused && !isPauseRequest(input.messageText)) {
    const resumeStep = state.answers.pausedFromStep ?? state.currentStep;
    const resumeQuestion =
      state.answers.pausedLastQuestion?.trim() ||
      buildResumeQuestion(campaign.id, resumeStep);

    const replyText = buildResumeReply(resumeQuestion);

    patchFlags(state, { paused: false });
    patchAnswers(state, {
      pausedFromStep: undefined,
      pausedLastQuestion: undefined,
      pausedAt: undefined,
    });

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: resumeStep,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep !== "done" && isPauseRequest(input.messageText)) {
    const resumeQuestion = buildResumeQuestion(campaign.id, state.currentStep);

    patchFlags(state, { paused: true });
    patchAnswers(state, {
      pausedFromStep: state.currentStep,
      pausedLastQuestion: resumeQuestion,
      pausedAt: nowIso(),
    });

    const replyText = buildPauseReply();
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: "flow_answer",
      state,
    };
  }

  const detectedIntent = detectLeadIntent(input.messageText);

  if (hasActiveProviderBooking(state)) {
    if (isProviderBookingCompletion(input.messageText)) {
      state.providerBooking = markProviderBookingBooked(state.providerBooking, nowIso());
      setCurrentStep(state, "done");

      const replyText =
        "Perfekt 👍\n\n" +
        "Dann ist dein Termin jetzt final eingetragen.\n" +
        "Die Bestätigung bekommst du direkt vom Buchungstool bzw. per Mail.";

      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "done",
        detectedIntent: "booking_intent",
        state,
      };
    }

    if (isProviderBookingLinkRequest(input.messageText)) {
      const replyText = buildProviderBookingResendReply(state);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "booking_intent",
        state,
      };
    }

    if (isSimpleAcknowledgement(input.messageText)) {
      const replyText = buildProviderBookingSimpleAckReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "booking_intent",
        state,
      };
    }

    const replyText = buildProviderBookingPendingReply();
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "booking",
      detectedIntent: "booking_intent",
      state,
    };
  }

  if (state.currentStep === "done") {
    const replyText = isPostDoneThanks(input.messageText)
      ? buildDoneReply(state)
      : "Alles klar 👍";

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "done",
      detectedIntent: detectedIntent.intent,
      state,
    };
  }

  if (state.answers.priceExecutionChoice && state.answers.priceObjectionExecutionDetail) {
    const immediateBookingReply = await tryHandleExecutionImmediateBooking(
      campaign.id,
      state,
      input.messageText,
    );

    if (immediateBookingReply) {
      return immediateBookingReply;
    }

    const normalized = normalizeText(input.messageText);

    if (!["a", "b"].includes(normalized)) {
      const replyText = buildExecutionBinaryChoiceValidationReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: state.currentStep,
        detectedIntent: "price_question",
        state,
      };
    }

    patchAnswers(state, {
      priceExecutionBinaryChoice: normalized,
    });

    if (normalized === "b") {
      resetPriceFlowState(state);
      patchFlags(state, { wantsBooking: true });
      setCurrentStep(state, "booking");

      const replyText = buildExecutionBinaryBookingReply(campaign.id);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "price_question",
        state,
      };
    }

    resetPriceFlowState(state);
    patchFlags(state, { wantsInfoOnly: true });
    setCurrentStep(state, "info_only");

    const replyText = buildInfoOnlyReply(campaign.id);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "info_only",
      detectedIntent: "price_question",
      state,
    };
  }

  if (
    state.answers.priceObjectionCategory === "execution_detail" &&
    state.answers.priceObjectionExecutionDetail
  ) {
    const immediateBookingReply = await tryHandleExecutionImmediateBooking(
      campaign.id,
      state,
      input.messageText,
    );

    if (immediateBookingReply) {
      return immediateBookingReply;
    }

    const normalized = normalizeText(input.messageText);

    if (!["a", "b", "c"].includes(normalized)) {
      const replyText = buildExecutionTernaryChoiceValidationReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: state.currentStep,
        detectedIntent: "price_question",
        state,
      };
    }

    patchAnswers(state, {
      priceExecutionChoice: normalized,
    });

    const detail = state.answers.priceObjectionExecutionDetail;

    if (normalized === "c") {
      resetPriceFlowState(state);
      const replyText = buildExecutionBinaryInfoReply(campaign.id);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: state.currentStep,
        detectedIntent: "price_question",
        state,
      };
    }

    let replyText = buildExecutionUnknownReply();

    if (detail === "time") {
      replyText =
        normalized === "a"
          ? buildExecutionBinaryTimeReply()
          : buildExecutionBinaryBookingReply(campaign.id);
    } else if (detail === "energy") {
      replyText =
        normalized === "a"
          ? buildExecutionBinaryEnergyReply()
          : buildExecutionBinaryBookingReply(campaign.id);
    } else if (detail === "consistency") {
      replyText =
        normalized === "a"
          ? buildExecutionBinaryConsistencyReply()
          : buildExecutionBinaryBookingReply(campaign.id);
    }

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: "price_question",
      state,
    };
  }

  if (
    state.flags.askedPrice &&
    state.answers.priceObjectionOpen &&
    state.answers.priceObjectionCategory === "execution_followup"
  ) {
    const detail = classifyExecutionDetail(input.messageText);

    patchAnswers(state, {
      priceObjectionExecutionText: input.messageText.trim(),
      priceObjectionExecutionDetail: detail,
      priceObjectionCategory: "execution_detail",
    });

    let replyText = buildExecutionUnknownReply();

    if (detail === "time") {
      replyText = buildExecutionTimeReply();
    } else if (detail === "energy") {
      replyText = buildExecutionEnergyReply();
    } else if (detail === "consistency") {
      replyText = buildExecutionConsistencyReply();
    }

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: "price_question",
      state,
    };
  }

  if (
    state.flags.askedPrice &&
    state.answers.priceObjectionOpen &&
    state.answers.priceObjectionCategory === "price_self_followup"
  ) {
    const normalized = normalizeText(input.messageText);

    if (
      normalized.includes("rate") ||
      normalized.includes("raten") ||
      normalized.includes("ratenzahlung")
    ) {
      resetPriceFlowState(state);
      patchFlags(state, {
        askedInstallments: true,
        wantsBooking: true,
      });
      setCurrentStep(state, "booking");

      const replyText = buildPriceSelfInstallmentsReply(campaign.id);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "installments",
        state,
      };
    }

    patchAnswers(state, {
      priceObjectionFollowUpText: input.messageText.trim(),
    });

    const replyText = buildPriceSelfFollowUpReply();
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: "price_question",
      state,
    };
  }

  if (state.flags.askedPrice && state.answers.priceObjectionOpen) {
    const classification = classifyPriceObjectionFollowUp(input.messageText);

    if (classification === "price") {
      patchAnswers(state, {
        priceObjectionCategory: "price_self_followup",
        priceObjectionFollowUpText: input.messageText.trim(),
      });

      const replyText = buildPriceSelfFollowUpReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: state.currentStep,
        detectedIntent: "price_question",
        state,
      };
    }

    if (classification === "execution") {
      patchAnswers(state, {
        priceObjectionCategory: "execution_followup",
        priceObjectionFollowUpText: input.messageText.trim(),
      });

      const replyText = buildPriceExecutionFollowUpReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: state.currentStep,
        detectedIntent: "price_question",
        state,
      };
    }

    const replyText = buildPriceUnclearFollowUpReply();
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: "price_question",
      state,
    };
  }

  if (
    state.flags.askedPrice &&
    state.currentStep !== "booking" &&
    isStrongStarterBuySignal(input.messageText)
  ) {
    resetPriceFlowState(state);
    patchFlags(state, {
      wantsDirectBuyStarter: true,
    });

    const replyText = canSendStarterCheckoutDirectly({
      hasInstallmentRequest: state.flags.askedInstallments,
      wantsLongTermSupport: state.flags.wantsLongTermSupport,
    })
      ? buildStarterDirectBuyLeadReply(campaign.id)
      : buildBookingPrompt(campaign.id);

    const nextStep: FlowStepId = mustGoToCall({
      hasInstallmentRequest: state.flags.askedInstallments,
      wantsLongTermSupport: state.flags.wantsLongTermSupport,
    })
      ? "booking"
      : state.currentStep;

    if (nextStep === "booking") {
      patchFlags(state, { wantsBooking: true });
      setCurrentStep(state, "booking");
    }

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep,
      detectedIntent: "direct_buy_starter",
      state,
    };
  }

  if (detectedIntent.intent === "stop") {
    patchFlags(state, { stopped: true });
    setCurrentStep(state, "done");

    const replyText = buildIntentReply(campaign.id, "stop");
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "done",
      detectedIntent: "stop",
      state,
    };
  }

  if (detectedIntent.intent === "installments") {
    resetPriceFlowState(state);
    patchFlags(state, {
      askedInstallments: true,
      wantsBooking: true,
    });
    setCurrentStep(state, "booking");

    const replyText = buildInstallmentsReply(campaign.id);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "booking",
      detectedIntent: "installments",
      state,
    };
  }

  if (detectedIntent.intent === "long_term_support") {
    resetPriceFlowState(state);
    patchFlags(state, {
      wantsLongTermSupport: true,
      wantsBooking: true,
    });
    setCurrentStep(state, "booking");

    const replyText = buildLongTermReply(campaign.id);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "booking",
      detectedIntent: "long_term_support",
      state,
    };
  }

  if (detectedIntent.intent === "direct_buy_starter") {
    resetPriceFlowState(state);
    patchFlags(state, {
      wantsDirectBuyStarter: true,
    });

    const replyText = canSendStarterCheckoutDirectly({
      hasInstallmentRequest: state.flags.askedInstallments,
      wantsLongTermSupport: state.flags.wantsLongTermSupport,
    })
      ? buildStarterDirectBuyLeadReply(campaign.id)
      : buildBookingPrompt(campaign.id);

    const nextStep: FlowStepId = mustGoToCall({
      hasInstallmentRequest: state.flags.askedInstallments,
      wantsLongTermSupport: state.flags.wantsLongTermSupport,
    })
      ? "booking"
      : state.currentStep;

    if (nextStep === "booking") {
      patchFlags(state, { wantsBooking: true });
      setCurrentStep(state, "booking");
    }

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep,
      detectedIntent: "direct_buy_starter",
      state,
    };
  }

  if (detectedIntent.intent === "price_question") {
    patchFlags(state, { askedPrice: true });

    if (detectedIntent.priceSubtype === "price_objection") {
      patchAnswers(state, {
        priceObjectionOpen: true,
        priceObjectionCategory: undefined,
        priceObjectionFollowUpText: input.messageText.trim(),
        priceObjectionExecutionDetail: undefined,
        priceObjectionExecutionText: undefined,
        priceExecutionChoice: undefined,
        priceExecutionBinaryChoice: undefined,
      });

      const replyText = buildPriceObjectionReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: state.currentStep,
        detectedIntent: "price_question",
        state,
      };
    }

    if (detectedIntent.priceTone === "direct") {
      resetPriceFlowState(state);

      const replyText =
        `${buildPriceReply(campaign.id)}\n\n` +
        "Wenn du willst, schauen wir danach kurz, ob das für deine Situation überhaupt Sinn macht.";

      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: state.currentStep,
        detectedIntent: "price_question",
        state,
      };
    }

    resetPriceFlowState(state);

    const replyText = buildSoftPriceInfoReply();
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: "price_question",
      state,
    };
  }

  if (detectedIntent.intent === "info_link_only" || isInfoLinkOnlyRequest(input.messageText)) {
    resetPriceFlowState(state);
    patchFlags(state, {
      wantsInfoOnly: true,
      wantsInfoLinkOnly: true,
    });
    setCurrentStep(state, "info_only");

    const replyText = buildInfoLinkReply(campaign.id);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "info_only",
      detectedIntent: "info_link_only",
      state,
    };
  }

  if (detectedIntent.intent === "info_only" || isInfoOnlyRequest(input.messageText)) {
    resetPriceFlowState(state);
    patchFlags(state, {
      wantsInfoOnly: true,
    });
    setCurrentStep(state, "info_only");

    const replyText = buildInfoOnlyReply(campaign.id);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "info_only",
      detectedIntent: "info_only",
      state,
    };
  }

  const pendingAiFollowUpQuestion = getPendingAiFollowUpQuestion(state);
  const pendingAiReturnStep = getPendingAiReturnStep(state);
  const pendingAiSource = getPendingAiSource(state);

  if (pendingAiFollowUpQuestion && pendingAiReturnStep) {
    if (pendingAiSource === "tried_before_freetext") {
      updateAnswer(state, "triedBeforeBlockerText", input.messageText.trim());
    }

    if (pendingAiSource === "consequence_freetext") {
      updateAnswer(state, "consequenceClarifierText", input.messageText.trim());
    }

    patchAnswers(state, {
      pendingAiFollowUpQuestion: undefined,
      pendingAiReturnStep: undefined,
      pendingAiSource: undefined,
    });

    setCurrentStep(state, pendingAiReturnStep);
    appendAssistantMessage(state, pendingAiFollowUpQuestion);
    persistConversationState(state);

    return {
      text: pendingAiFollowUpQuestion,
      nextStep: pendingAiReturnStep,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "ask_name") {
    if (isAdOrWaMeOpener(input.messageText)) {
      const replyText = buildAdOrWaMeOpenerReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "ask_name",
        detectedIntent: "flow_answer",
        state,
      };
    }

    if (isMultiplePeopleIntroduction(input.messageText)) {
      const replyText = buildMultiplePeopleReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "ask_name",
        detectedIntent: "flow_answer",
        state,
      };
    }

    if (isPlayfulUnknownNameInput(input.messageText)) {
      const replyText = buildPlayfulNameReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "ask_name",
        detectedIntent: "flow_answer",
        state,
      };
    }

    const parsedName = parseName(input.messageText);

    if (!parsedName) {
      const lowered = normalizeText(input.messageText);
      const replyText =
        lowered === "hallo" || lowered === "hi" || lowered === "hey" || lowered === "huhu"
          ? "Hey 😊 Mit wem schreibe ich gerade? Stell dich doch kurz mit deinem Vornamen vor."
          : buildNameValidationReply();

      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "ask_name",
        detectedIntent: detectedIntent.intent,
        state,
      };
    }

    updateAnswer(state, "name", parsedName);
    setCurrentStep(state, "intro_ack");

    const replyText = buildIntroText(campaign.id, parsedName);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "intro_ack",
      detectedIntent: detectedIntent.intent,
      state,
    };
  }

  if (state.currentStep === "intro_ack") {
    if (!isIntroAckAccepted(input.messageText)) {
      const replyText = buildIntroAckValidationReply(campaign.id);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "intro_ack",
        detectedIntent: detectedIntent.intent,
        state,
      };
    }

    const nextStep = getNextFlowStep(campaign.id, "intro_ack");
    if (!nextStep) {
      throw new Error("Missing next flow step after intro_ack.");
    }

    setCurrentStep(state, nextStep.id);

    const replyText = buildQuestionReply(campaign.id, nextStep);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: nextStep.id,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "situation_choice") {
    const step = getStepOrThrow(campaign.id, "situation_choice");
    const allowedKeys = (step.options ?? []).map((option) => option.key.toLowerCase());

    if (!isChoiceKey(input.messageText, allowedKeys)) {
      const replyText = buildChoiceValidationReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "situation_choice",
        detectedIntent: detectedIntent.intent,
        state,
      };
    }

    updateAnswer(state, "situationChoice", input.messageText.trim().toLowerCase());

    const nextStep = getNextFlowStep(campaign.id, "situation_choice");
    if (!nextStep) {
      throw new Error("Missing next flow step after situation_choice.");
    }

    setCurrentStep(state, nextStep.id);

    const replyText = buildQuestionReply(campaign.id, nextStep);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: nextStep.id,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "tried_before_freetext") {
    updateAnswer(state, "triedBeforeText", input.messageText.trim());

    const nextStep = getNextFlowStep(campaign.id, "tried_before_freetext");
    if (!nextStep) {
      throw new Error("Missing next flow step after tried_before_freetext.");
    }

    const nextQuestion = buildQuestionReply(campaign.id, nextStep);
    const aiBridge = await generateAlreadyTriedBridgeReply({
      userMessage: input.messageText,
      currentStep: "tried_before_freetext",
      nextStep: nextStep.id,
      leadName: state.answers.name,
    });

    if (aiBridge?.replyText?.trim()) {
      patchAnswers(state, {
        pendingAiFollowUpQuestion: nextQuestion,
        pendingAiReturnStep: nextStep.id,
        pendingAiSource: "tried_before_freetext",
      });

      appendAssistantMessage(state, aiBridge.replyText.trim());
      persistConversationState(state);

      return {
        text: aiBridge.replyText.trim(),
        nextStep: "tried_before_freetext",
        detectedIntent: "flow_answer",
        state,
      };
    }

    setCurrentStep(state, nextStep.id);
    appendAssistantMessage(state, nextQuestion);
    persistConversationState(state);

    return {
      text: nextQuestion,
      nextStep: nextStep.id,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "consequence_freetext") {
    updateAnswer(state, "consequenceText", input.messageText.trim());

    const nextStep = getNextFlowStep(campaign.id, "consequence_freetext");
    if (!nextStep) {
      throw new Error("Missing next flow step after consequence_freetext.");
    }

    const nextQuestion = buildQuestionReply(campaign.id, nextStep);
    const aiBridge = await generateConsequenceBridgeReply({
      userMessage: input.messageText,
      currentStep: "consequence_freetext",
      nextStep: nextStep.id,
      leadName: state.answers.name,
    });

    if (aiBridge?.replyText?.trim()) {
      patchAnswers(state, {
        pendingAiFollowUpQuestion: nextQuestion,
        pendingAiReturnStep: nextStep.id,
        pendingAiSource: "consequence_freetext",
      });

      appendAssistantMessage(state, aiBridge.replyText.trim());
      persistConversationState(state);

      return {
        text: aiBridge.replyText.trim(),
        nextStep: "consequence_freetext",
        detectedIntent: "flow_answer",
        state,
      };
    }

    setCurrentStep(state, nextStep.id);
    appendAssistantMessage(state, nextQuestion);
    persistConversationState(state);

    return {
      text: nextQuestion,
      nextStep: nextStep.id,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "goal_choice") {
    const step = getStepOrThrow(campaign.id, "goal_choice");
    const allowedKeys = (step.options ?? []).map((option) => option.key.toLowerCase());

    if (!isChoiceKey(input.messageText, allowedKeys)) {
      const replyText = buildChoiceValidationReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "goal_choice",
        detectedIntent: detectedIntent.intent,
        state,
      };
    }

    updateAnswer(state, "goalChoice", input.messageText.trim().toLowerCase());

    const nextStep = getNextFlowStep(campaign.id, "goal_choice");
    if (!nextStep) {
      throw new Error("Missing next flow step after goal_choice.");
    }

    setCurrentStep(state, nextStep.id);

    const replyText = buildQuestionReply(campaign.id, nextStep);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: nextStep.id,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "importance_scale") {
    const step = getStepOrThrow(campaign.id, "importance_scale");
    const minScale = step.minScale ?? 1;
    const maxScale = step.maxScale ?? 10;

    if (!isScaleValue(input.messageText, minScale, maxScale)) {
      const replyText = buildScaleValidationReply();
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "importance_scale",
        detectedIntent: detectedIntent.intent,
        state,
      };
    }

    const score = Number(input.messageText.trim());
    updateAnswer(state, "importanceScore", score);

    if (score <= 7) {
      resetPriceFlowState(state);
      patchFlags(state, { wantsInfoOnly: true });
      setCurrentStep(state, "info_only");

      const replyText = buildLowScoreReply(campaign.id, score);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "info_only",
        detectedIntent: "flow_answer",
        state,
      };
    }

    const nextStep = getNextFlowStep(campaign.id, "importance_scale");
    if (!nextStep) {
      throw new Error("Missing next flow step after importance_scale.");
    }

    setCurrentStep(state, nextStep.id);

    const replyText = buildQuestionReply(campaign.id, nextStep);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: nextStep.id,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "commitment") {
    const commitmentChoice = parseCommitmentChoice(input.messageText);

    if (!commitmentChoice) {
      const replyText = buildCommitmentValidationReply(campaign.id);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "commitment",
        detectedIntent: detectedIntent.intent,
        state,
      };
    }

    updateAnswer(state, "commitmentChoice", commitmentChoice);

    const branches = getCommitmentBranches();

    if (commitmentChoice === "really_start") {
      resetPriceFlowState(state);
      patchFlags(state, { wantsBooking: true });
      setCurrentStep(state, branches.reallyStartStep);

      const replyText = buildBookingPrompt(campaign.id);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: branches.reallyStartStep,
        detectedIntent: "flow_answer",
        state,
      };
    }

    resetPriceFlowState(state);
    patchFlags(state, { wantsInfoOnly: true });
    setCurrentStep(state, branches.infoOnlyStep);

    const replyText = buildInfoOnlyReply(campaign.id);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: branches.infoOnlyStep,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "info_only") {
    if (isFollowUpInfoLinkRequest(input.messageText)) {
      patchFlags(state, { wantsInfoLinkOnly: true });

      const replyText = buildInfoLinkReply(campaign.id);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "info_only",
        detectedIntent: "info_link_only",
        state,
      };
    }

    if (detectedIntent.intent === "booking_intent") {
      resetPriceFlowState(state);
      patchFlags(state, { wantsBooking: true });
      setCurrentStep(state, "booking");

      const replyText = buildBookingPrompt(campaign.id);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "booking_intent",
        state,
      };
    }

    const immediateBookingReply = await tryHandleExecutionImmediateBooking(
      campaign.id,
      state,
      input.messageText,
    );

    if (immediateBookingReply) {
      return immediateBookingReply;
    }

    const replyText = buildInfoOnlyReply(campaign.id);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "info_only",
      detectedIntent: detectedIntent.intent,
      state,
    };
  }

  if (state.currentStep === "booking") {
    if (isNoShowGuardConfirmation(input.messageText)) {
      const pendingBookingText = state.answers.pendingBookingText;
      const pendingDay = state.answers.pendingBookingDay;
      const pendingTime = state.answers.pendingBookingTime;
      const existingBookingRequest = state.answers.bookingRequest;

      if (pendingBookingText || pendingDay || pendingTime) {
        patchAnswers(state, {
          bookingRequest: existingBookingRequest
            ? {
                ...existingBookingRequest,
                status: "confirmed",
                detectedAt: nowIso(),
              }
            : undefined,
          lastSuggestedBookingOptions: undefined,
        });

        const baseReply = buildBookingConfirmedReply(campaign.id, {
          bookingText: pendingBookingText,
          day: pendingDay,
          time: pendingTime,
        });

        const hasExternalFinalization = !!getExternalProviderPreview(state);

        if (hasExternalFinalization) {
          const replyText = buildProviderBookingLinkReply(baseReply, state);
          setCurrentStep(state, "booking");
          appendAssistantMessage(state, replyText);
          persistConversationState(state);

          return {
            text: replyText,
            nextStep: "booking",
            detectedIntent: "flow_answer",
            state,
          };
        }

        setCurrentStep(state, "done");
        appendAssistantMessage(state, baseReply);
        persistConversationState(state);

        return {
          text: baseReply,
          nextStep: "done",
          detectedIntent: "flow_answer",
          state,
        };
      }
    }

    const matchedSuggestedOption = tryMatchSuggestedOption(
      input.messageText,
      state.answers.lastSuggestedBookingOptions,
    );

    if (matchedSuggestedOption) {
      const finalBookingText = matchedSuggestedOption.label;

      patchAnswers(state, {
        pendingBookingText: finalBookingText,
        pendingBookingDay: matchedSuggestedOption.day.toLowerCase(),
        pendingBookingTime: matchedSuggestedOption.time,
        bookingRequest: buildBookingRequestData({
          requestedText: finalBookingText,
          requestedDay: matchedSuggestedOption.day.toLowerCase(),
          requestedTimeText: matchedSuggestedOption.time,
          requestedPreference: "unknown",
          status: "requested",
        }),
        lastSuggestedBookingOptions: undefined,
      });

      const replyText = buildBookingGuardReply(finalBookingText);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "booking_intent",
        state,
      };
    }

    const bookingRequest = detectBookingRequest(input.messageText);

    if (bookingRequest.hasConcreteRequest && bookingRequest.requestedText) {
      const availability = await checkStaticAvailability({
        requestedDayLabel: bookingRequest.requestedDay,
        requestedTimeText: bookingRequest.requestedTimeText,
        requestedPreference:
          bookingRequest.preference !== "unknown"
            ? bookingRequest.preference
            : state.answers.bookingRequest?.requestedPreference ?? "unknown",
      });

      if (!availability.isBookable) {
        const suggestionOptions: SuggestedBookingOption[] = availability.suggestions
          .slice(0, 3)
          .map((slot) => ({
            day: formatAvailabilitySlot(slot).split(" um ")[0],
            time: slot.time,
            label: formatAvailabilitySlot(slot),
          }));

        patchAnswers(state, {
          lastSuggestedBookingOptions: suggestionOptions,
        });

        const suggestionReply = buildAvailabilitySuggestionReply(
          suggestionOptions.map((option) => ({
            label: option.label,
          })),
        );

        appendAssistantMessage(state, suggestionReply);
        persistConversationState(state);

        return {
          text: suggestionReply,
          nextStep: "booking",
          detectedIntent: "booking_intent",
          state,
        };
      }

      const matchedSlot = availability.matchedSlot;
      const finalBookingText = matchedSlot
        ? formatAvailabilitySlot(matchedSlot)
        : bookingRequest.requestedText;

      const finalPreference =
        bookingRequest.preference !== "unknown"
          ? bookingRequest.preference
          : state.answers.bookingRequest?.requestedPreference ?? "unknown";

      patchAnswers(state, {
        pendingBookingText: finalBookingText,
        pendingBookingDay: bookingRequest.requestedDay,
        pendingBookingTime: matchedSlot ? matchedSlot.time : bookingRequest.requestedTimeText,
        bookingRequest: buildBookingRequestData({
          requestedText: finalBookingText,
          requestedDay: bookingRequest.requestedDay,
          requestedTimeText: matchedSlot ? matchedSlot.time : bookingRequest.requestedTimeText,
          requestedPreference: finalPreference,
          status: "requested",
        }),
        lastSuggestedBookingOptions: undefined,
      });

      const replyText = buildBookingGuardReply(finalBookingText);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "booking_intent",
        state,
      };
    }

    const bookingWindow = detectBookingWindow(input.messageText);
    if (bookingWindow !== "unknown") {
      const replyText = getBookingPreferenceFollowUpText(bookingWindow);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "booking_intent",
        state,
      };
    }

    const bookingPreference = detectBookingPreference(input.messageText);
    if (bookingPreference === "vormittags" || bookingPreference === "nachmittags") {
      patchAnswers(state, {
        bookingRequest: buildBookingRequestData({
          requestedText: "",
          requestedPreference: bookingPreference,
          status: "requested",
        }),
      });

      const replyText = getBookingPreferenceFollowUpText(bookingPreference);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
        detectedIntent: "booking_intent",
        state,
      };
    }

    const replyText =
      "Nenn mir bitte kurz den Tag und wenn möglich auch direkt eine Uhrzeit, die für dich gut passt.";

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "booking",
      detectedIntent: detectedIntent.intent,
      state,
    };
  }

  const fallbackNextStep = getFlowStepById(campaign.id, state.currentStep);

  if (fallbackNextStep) {
    const replyText = buildQuestionReply(campaign.id, fallbackNextStep);
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: detectedIntent.intent,
      state,
    };
  }

  const fallbackReply = "Alles klar. Lass uns kurz bei dem Punkt bleiben.";
  appendAssistantMessage(state, fallbackReply);
  persistConversationState(state);

  return {
    text: fallbackReply,
    nextStep: state.currentStep,
    detectedIntent: detectedIntent.intent,
    state,
  };
}
