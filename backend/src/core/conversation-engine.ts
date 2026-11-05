import { getCampaignById } from "../config/campaigns.js";
import { getNaturalConversationReply } from "./natural-conversation.js";
import {
  isSalesFollowUpOptOut,
  isPeteTrialFactFollowUp,
  getPeteVerifiedTransactionAnswer,
  isGeneralNonMedicalKnowledgeRequest,
  isPeteChestBreathingEmergency,
  isPeteNonMedicalPostPregnancyBodyImage,
  peteSafeRoutineRepairReply,
  peteSafeNoncriticalExplanationReply,
} from "./pete-conversation-quality.js";
import { getConversationState } from "../data/store.js";
import {
  getPeteLlmConversationReply,
  isExplicitPeteHumanTakeoverRequest,
  isPeteLlmConversationSelected,
} from "./pete-llm-conversation.js";
import { isRetryableDesktopTechnicalFailure } from "./pete-desktop-error-policy.js";
import { desktopCallMode } from "../services/pete-desktop-lab.service.js";
import {
  detectBookingPreference,
  detectBookingRequest,
  detectBookingWindow,
  getBookingPreferenceFollowUpText,
  isNoShowGuardConfirmation,
  tryMatchSuggestedOption,
  isProviderBookingCompletion,
  isProviderBookingLinkRequest,
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
  canSendCoachingEntryCheckoutDirectly,
  isSelfstarterInterest,
  mustGoToCall,
} from "../domain/pricing-rules.js";
import {
  buildHumanChoiceClarifier,
  buildNaturalChoiceAcknowledgement,
  extractScaleValue,
  interpretChoiceDeterministically,
  parseParentContext,
} from "../domain/qualification-intelligence.js";
import {
  generateAlreadyTriedBridgeReply,
  generateConsequenceBridgeReply,
} from "../services/ai-funnel.service.js";
import {
  checkStaticAvailability,
  formatAvailabilitySlot,
} from "../services/availability.service.js";
import { interpretChoiceWithAi } from "../services/qualification-ai.service.js";
import {
  activateProviderBookingState,
  markProviderBookingBooked,
} from "../services/provider-booking.service.js";
import {
  buildSchedulingPreviewFromState,
  resolveProviderBookingUrlFromState,
} from "../services/scheduling-request.service.js";
import type {
  BookingRequestData,
  ConversationState,
  EngineInput,
  EngineReply,
  FlowStepDefinition,
  FlowStepId,
  LeadIntent,
  SuggestedBookingOption,
} from "../types/types.js";
import {
  getCommitmentBranches,
  getFlowStepById,
  getNextFlowStep,
} from "./flow-definition.js";
import { detectLeadIntent, isIntroAckAccepted, isPostDoneThanks, isPauseRequest } from "./intent-detector.js";
import {
  classifyPeteObjection,
  evaluatePeteObjection,
  type ObjectionIntent,
  type PeteObjectionResult,
} from "./pete-objection-handler.js";
import {
  buildPeteRuntimeInfoLinkReply,
  buildPeteRuntimeHandoffPendingReply,
  evaluatePeteRuntimeSafety,
} from "./pete-runtime-safety.js";
import {
  appendAssistantMessage,
  appendUserMessage,
  getOrCreateConversationState,
  getPendingAiFollowUpQuestion,
  getPendingAiReturnStep,
  getPendingAiSource,
  resetPriceFlowState,
  patchAnswers,
  patchFlags,
  persistConversationState,
  setCurrentStep,
  takeOverByHuman,
  updateAnswer,
} from "./state-manager.js";
import {
  buildDoneReply,
  buildPauseReply,
  buildResumeReply,
  buildPlayfulNameReply,
  buildMultiplePeopleReply,
  buildLowScoreReply,
  buildAvailabilitySuggestionReply,
  buildBookingGuardReply,
  buildCoachingEntryDirectBuyLeadReply,
  buildProviderBookingPendingReply,
  buildProviderBookingSimpleAckReply,
  buildBookingConfirmedReply,
  buildBookingPrompt,
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
  buildSelfstarterReply,
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
import {
  decidePeteNextAction,
  type PeteDecision,
} from "./pete-decision-layer.js";
import {
  composePeteResponse,
  type PeteComposedResponse,
} from "./pete-response-composer.js";

/** One-time, application-owned disclosure; never delegated to the model. */
function disclosePeteIdentity(state: ConversationState, text: string): string {
  const identifiesPete = (value: string) => /\bPete\b.{0,60}\bKI[- ]Assistent\w*\b/i.test(value);
  const alreadyDisclosed = state.answers.peteIdentityDisclosed === true ||
    state.messages.some(message => message.role === "assistant" && identifiesPete(message.text));
  patchAnswers(state, { peteIdentityDisclosed: true });
  return alreadyDisclosed || identifiesPete(text) ? text :
    "Ich bin Pete, Jochens KI-Assistent. " + text;
}

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

const COACHING_ENTRY_BUY_SIGNAL_KEYWORDS = [
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

function isScaleValue(input: string, min: number, max: number): boolean {
  return extractScaleValue(input, min, max) !== null;
}

async function resolveAdaptiveChoice(params: {
  stepId: FlowStepId;
  input: string;
  step: FlowStepDefinition;
  leadName?: string;
}): Promise<string | null> {
  const options = params.step.options ?? [];
  const deterministic = interpretChoiceDeterministically({
    stepId: params.stepId,
    input: params.input,
    options,
  });

  if (deterministic.mappedChoice) {
    return deterministic.mappedChoice;
  }

  const aiResult = await interpretChoiceWithAi({
    stepId: params.stepId,
    input: params.input,
    options,
    leadName: params.leadName,
  });

  if (
    aiResult?.mappedChoice &&
    aiResult.confidence >= 0.72 &&
    options.some((option) => option.key === aiResult.mappedChoice)
  ) {
    return aiResult.mappedChoice;
  }

  return null;
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
    !isHttpUrl(schedulingRequest.externalBookingUrl)
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

function hasActiveProviderBooking(
  state: ReturnType<typeof getOrCreateConversationState>,
): boolean {
  return (
    state.providerBooking?.status === "awaiting_booking" &&
    !!state.providerBooking.bookingUrl
  );
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

function isStrongCoachingEntryBuySignal(input: string): boolean {
  const normalized = normalizeText(input);

  if (!normalized) {
    return false;
  }

  return COACHING_ENTRY_BUY_SIGNAL_KEYWORDS.some(
    (keyword) => normalized === keyword || normalized.includes(keyword),
  );
}

function buildProviderBookingResendReply(
  state: ReturnType<typeof getOrCreateConversationState>,
): string {
  const preview = getExternalProviderPreview(state);
  const configuredProviderBookingUrl = resolveProviderBookingUrlFromState(state);
  const bookingUrl = [
    configuredProviderBookingUrl,
    preview?.externalBookingUrl,
    state.providerBooking?.bookingUrl,
  ].find(isHttpUrl)?.trim();

  if (!bookingUrl) {
    return (
      "Ja, das macht Sinn.\n" +
      "Dann halte ich kurz fest, worum es geht, und Jochen meldet sich pers\u00f6nlich bei dir."
    );
  }

  state.providerBooking = activateProviderBookingState({
    current: state.providerBooking,
    provider: inferBookingProviderFromUrl(bookingUrl),
    bookingUrl,
    linkSentAt: nowIso(),
  });

  const providerName =
    preview?.providerLabel || state.providerBooking.provider || "dem Buchungslink";

  return (
    "Klar 👍\n\n" +
    `Hier ist der Link nochmal für die finale Eintragung über ${providerName}:\n` +
    `${bookingUrl}\n\n` +
    "Wenn du durch bist, sag mir kurz Bescheid."
  );
}

function isHttpUrl(value: string | undefined): value is string {
  const url = value?.trim();
  return Boolean(url && (url.startsWith("http://") || url.startsWith("https://")));
}

function getLastAssistantText(
  state: ReturnType<typeof getOrCreateConversationState>,
): string | undefined {
  return [...state.messages]
    .reverse()
    .find((message) => message.role === "assistant")
    ?.text.trim();
}

function getRuntimeBookingUrl(params: {
  state: ReturnType<typeof getOrCreateConversationState>;
}): string | undefined {
  const preview = getExternalProviderPreview(params.state);
  const configuredProviderBookingUrl = resolveProviderBookingUrlFromState(
    params.state,
  );
  const candidates = [
    configuredProviderBookingUrl,
    preview?.externalBookingUrl,
    params.state.providerBooking?.bookingUrl,
  ];

  return candidates.find(isHttpUrl)?.trim();
}

function mapPeteDecisionToIntent(decision: PeteDecision): LeadIntent {
  if (decision.decisionType === "hard_stop") {
    return "stop";
  }

  if (
    decision.decisionType === "human_request" ||
    decision.decisionType === "booking_request"
  ) {
    return "booking_intent";
  }

  if (decision.decisionType === "link_request") {
    return decision.metadata?.linkTarget === "booking"
      ? "booking_intent"
      : "info_link_only";
  }

  if (
    decision.decisionType === "price_question" ||
    decision.decisionType === "price_objection"
  ) {
    return "price_question";
  }

  if (
    decision.decisionType === "offer_info" ||
    decision.decisionType === "frustration_previous_attempts"
  ) {
    return "info_only";
  }

  if (decision.decisionType === "question_intro_confirmed") {
    return "flow_answer";
  }

  return "unknown";
}

function getStoredAnswerString(
  state: ReturnType<typeof getOrCreateConversationState>,
  key: string,
): string | undefined {
  const value = state.answers[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getStoredAnswerNumber(
  state: ReturnType<typeof getOrCreateConversationState>,
  key: string,
): number | undefined {
  const value = state.answers[key];
  return typeof value === "number" ? value : undefined;
}

function applyPeteDecisionStatePatch(params: {
  decision: PeteDecision;
  composed: PeteComposedResponse;
  state: ReturnType<typeof getOrCreateConversationState>;
  runtimeBookingUrl?: string;
}): void {
  const { decision, composed, state, runtimeBookingUrl } = params;

  patchAnswers(state, {
    peteDecisionType: decision.decisionType,
    peteDecisionAction: decision.action,
    peteDecisionReason: decision.reason,
    peteDecisionLastAt: nowIso(),
  });

  if (decision.decisionType === "hard_stop") {
    patchFlags(state, { stopped: true });
    setCurrentStep(state, "done");
    return;
  }

  if (
    decision.decisionType === "medical_critical" ||
    decision.decisionType === "legal_privacy" ||
    decision.decisionType === "emotional_crisis"
  ) {
    patchFlags(state, {
      peteRuntimeHandoffRequested: true,
      peteRuntimeHandoffActive: true,
    });
    patchAnswers(state, {
      peteRuntimeSafetyCategory: decision.decisionType,
      peteRuntimeSafetyReason: decision.reason,
      peteRuntimeSafetyLastAt: nowIso(),
    });
    // A critical safety escalation belongs to a human. Taking ownership now
    // prevents a second automatic medical answer on the next incoming DM.
    takeOverByHuman(state);
    return;
  }

  if (
    decision.decisionType === "human_request" ||
    decision.decisionType === "booking_request" ||
    (decision.decisionType === "link_request" &&
      decision.metadata?.linkTarget === "booking")
  ) {
    resetPriceFlowState(state);
    patchFlags(state, { wantsBooking: true });
    setCurrentStep(state, "booking");

    if (runtimeBookingUrl) {
      state.providerBooking = activateProviderBookingState({
        current: state.providerBooking,
        provider: inferBookingProviderFromUrl(runtimeBookingUrl),
        bookingUrl: runtimeBookingUrl,
        linkSentAt: nowIso(),
      });
    }
    return;
  }

  if (
    decision.decisionType === "link_request" &&
    decision.metadata?.linkTarget === "info"
  ) {
    resetPriceFlowState(state);
    patchFlags(state, {
      wantsInfoOnly: true,
      wantsInfoLinkOnly: true,
    });
    setCurrentStep(state, "info_only");
    return;
  }

  if (decision.decisionType === "price_question") {
    patchFlags(state, { askedPrice: true });
    resetPriceFlowState(state);
    return;
  }

  if (decision.decisionType === "price_objection") {
    patchFlags(state, { askedPrice: true });

    if (decision.metadata?.shouldSetInfoOnly) {
      resetPriceFlowState(state);
      patchFlags(state, { wantsInfoOnly: true });
      setCurrentStep(state, "info_only");
      return;
    }

    if (decision.action === "offer_booking") {
      resetPriceFlowState(state);
      patchFlags(state, { wantsBooking: true });
      setCurrentStep(state, "booking");
    }
    return;
  }

  if (decision.decisionType === "objection") {
    patchAnswers(state, {
      objectionIntent:
        typeof decision.metadata?.objectionIntent === "string"
          ? decision.metadata.objectionIntent
          : undefined,
      objectionAction: decision.action,
      objectionCount:
        typeof decision.metadata?.objectionCount === "number"
          ? decision.metadata.objectionCount
          : undefined,
      objectionTemplateId:
        typeof decision.metadata?.templateId === "string"
          ? decision.metadata.templateId
          : undefined,
      objectionLastAt: nowIso(),
    });

    if (decision.action === "close") {
      setCurrentStep(state, "done");
    } else if (decision.metadata?.shouldSetInfoOnly) {
      resetPriceFlowState(state);
      patchFlags(state, { wantsInfoOnly: true });
      setCurrentStep(state, "info_only");
    }
    return;
  }

  if (decision.decisionType === "offer_info") {
    resetPriceFlowState(state);
    patchFlags(state, { wantsInfoOnly: true });
    setCurrentStep(state, "info_only");
    return;
  }

  if (decision.decisionType === "question_intro_confirmed" && composed.nextStep) {
    setCurrentStep(state, composed.nextStep);
  }
}

function inferBookingProviderFromUrl(bookingUrl: string | undefined): string {
  const normalized = bookingUrl?.toLowerCase() ?? "";

  if (normalized.includes("calendly.")) {
    return "calendly";
  }

  if (normalized.includes("meetergo.")) {
    return "meetergo";
  }

  return "booking_link";
}

function mapPeteSafetyCategoryToIntent(
  category: ReturnType<typeof evaluatePeteRuntimeSafety>["category"],
): LeadIntent {
  if (category === "price") {
    return "price_question";
  }

  if (category === "human_request" || category === "booking_link") {
    return "booking_intent";
  }

  if (category === "info_link") {
    return "info_link_only";
  }

  if (category === "unclear") {
    return "unknown";
  }

  return "unknown";
}

function buildPeteSafetyStatePatch(
  safety: ReturnType<typeof evaluatePeteRuntimeSafety>,
) {
  return {
    peteRuntimeSafetyCategory: safety.category,
    peteRuntimeSafetyLeadTemperature: safety.leadTemperature,
    peteRuntimeSafetyReason: safety.reason,
    peteRuntimeSafetyLastAt: nowIso(),
  };
}

function shouldLetObjectionModuleHandlePeteSafety(
  safety: ReturnType<typeof evaluatePeteRuntimeSafety>,
): boolean {
  return safety.category === "price" || safety.category === "distrust_aggression";
}

function getPeteObjectionCount(
  state: ReturnType<typeof getOrCreateConversationState>,
  intent: ObjectionIntent,
): number {
  const previousIntent =
    typeof state.answers.objectionIntent === "string"
      ? state.answers.objectionIntent
      : "";
  const previousCount =
    typeof state.answers.objectionCount === "number"
      ? state.answers.objectionCount
      : 0;

  return previousIntent === intent ? previousCount + 1 : 1;
}

function buildPeteObjectionStatePatch(result: PeteObjectionResult) {
  return {
    objectionIntent: result.intent,
    objectionAction: result.action,
    objectionCount: result.objectionCount,
    objectionTemplateId: result.templateId,
    objectionMatchedKeyword: result.matchedKeyword,
    handoffReason: result.shouldHandoffToJochen ? result.reason : undefined,
    objectionLastAt: nowIso(),
  };
}

function mapPeteObjectionIntentToLeadIntent(
  result: PeteObjectionResult,
): LeadIntent {
  if (result.intent === "hard_stop") {
    return "stop";
  }

  if (result.intent === "price") {
    return "price_question";
  }

  if (result.intent === "info") {
    return result.shouldSendInfoLink ? "info_link_only" : "info_only";
  }

  if (result.action === "offer_booking") {
    return "booking_intent";
  }

  return "unknown";
}

function handlePeteObjectionResult(params: {
  campaign: ReturnType<typeof getCampaignById>;
  state: ReturnType<typeof getOrCreateConversationState>;
  result: PeteObjectionResult;
  inputText: string;
}): EngineReply | null {
  const { campaign, state, result, inputText } = params;

  if (result.intent === "none") {
    return null;
  }

  const replyText = result.shouldSendInfoLink
    ? buildPeteRuntimeInfoLinkReply(inputText, campaign, {
        campaign,
        lastAssistantText: getLastAssistantText(state),
      })
    : result.replyText;

  if (!replyText?.trim()) {
    return null;
  }

  patchAnswers(state, buildPeteObjectionStatePatch(result));

  if (result.intent === "hard_stop") {
    patchFlags(state, { stopped: true });
    setCurrentStep(state, "done");
  } else if (result.shouldClose) {
    setCurrentStep(state, "done");
  } else if (result.shouldSetInfoOnly) {
    resetPriceFlowState(state);
    patchFlags(state, { wantsInfoOnly: true });
    setCurrentStep(state, "info_only");
  } else if (result.shouldSetBooking) {
    resetPriceFlowState(state);
    patchFlags(state, { wantsBooking: true });
    setCurrentStep(state, "booking");
  }

  if (result.shouldHandoffToJochen) {
    patchFlags(state, { peteRuntimeHandoffRequested: true });
  }

  appendAssistantMessage(state, replyText);
  persistConversationState(state);

  return {
    text: replyText,
    nextStep: state.currentStep,
    detectedIntent: mapPeteObjectionIntentToLeadIntent(result),
    state,
  };
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
  // Persist before an async model call; later scheduled sends must see refusal.
  if (isSalesFollowUpOptOut(input.messageText)) {
    patchFlags(state, { salesFollowUpsOptedOut: true });
    persistConversationState(state);
  }
  const lastIncomingMessageId = state.messages.at(-1)?.id;

  if (state.flags.stopped) {
    persistConversationState(state);

    return {
      text: null,
      nextStep: state.currentStep,
      detectedIntent: "stop",
      state,
      replySuppressedReason: "stopped",
    };
  }

  if (state.owner === "human" || state.aiPaused === true) {
    persistConversationState(state);

    return {
      text: null,
      nextStep: state.currentStep,
      detectedIntent: "unknown",
      state,
      replySuppressedReason: "human_owned",
    };
  }

  // Older conversations can be marked for handover before the owner field is
  // migrated. Never re-run medical/sales decisions while such a handover awaits.
  if (state.flags.peteRuntimeHandoffActive) {
    takeOverByHuman(state);
    persistConversationState(state);
    return { text: null, nextStep: state.currentStep,
      detectedIntent: "unknown", state, replySuppressedReason: "human_owned" };
  }

  // Critical safety gate before ANY natural-flow classifier or model call.
  // "Brustschmerz und bekomme schlecht Luft" was under-triaged in holdout H12.
  // The first answer must direct emergency help and no sales/fitness questions.
  if (isPeteChestBreathingEmergency(input.messageText)) {
    patchAnswers(state, { peteReplySource: "guarded_safety" });
    patchFlags(state, { peteRuntimeHandoffRequested: true, peteRuntimeHandoffActive: true });
    const urgent = "Brustschmerzen zusammen mit Atemproblemen können ein medizinischer Notfall sein. Ruf bitte jetzt 112 an oder lass den Notruf wählen. Nicht trainieren oder selbst zum Arzt fahren.";
    // Record the permitted emergency notice before human ownership is set.
    appendAssistantMessage(state, urgent);
    takeOverByHuman(state);
    persistConversationState(state);
    return { text: urgent, nextStep: state.currentStep,
      detectedIntent: "unknown", state };
  }

  if (input.conversationMode === "natural") {
    const bookingUrl = getRuntimeBookingUrl({ state });
    let decision = decidePeteNextAction(input.messageText, {
      campaign,
      currentStep: state.currentStep,
      lastAssistantText: getLastAssistantText(state),
      bookingUrl,
    });

    // Explicit chest pressure/pain with breathing difficulty must never reach
    // the model due to missing synonyms in the legacy decision classifier.
    if (isPeteChestBreathingEmergency(input.messageText) &&
        decision.decisionType !== "medical_critical") {
      decision = { ...decision, decisionType: "medical_critical" } as typeof decision;
    }

    // Preserve precedence of STOP, medical crises, legal/privacy and hard
    // safety handoffs even if the user asks a sales-related question.
    const safeGeneralKnowledge =
      isPeteLlmConversationSelected() &&
      (isGeneralNonMedicalKnowledgeRequest(input.messageText) ||
       isPeteNonMedicalPostPregnancyBodyImage(input.messageText));
    // A narrowly verified trial-facts follow-up can mention the word
    // "Vertragsbedingungen" without being a legal dispute. Real deletion,
    // withdrawal and payment concerns still take precedence.
    const harmlessTrialFacts = isPeteLlmConversationSelected() &&
      decision.decisionType === "legal_privacy" &&
      isPeteTrialFactFollowUp(input.messageText, state);
    if ([
      "hard_stop", "medical_critical", "medical_soft",
      "emotional_crisis", "legal_privacy",
    ].includes(decision.decisionType) && !harmlessTrialFacts &&
        !(safeGeneralKnowledge &&
          ["medical_critical", "medical_soft"].includes(decision.decisionType))) {
      const guarded = composePeteResponse(decision, {
        campaign, currentStep: state.currentStep,
        userText: input.messageText,
        lastAssistantText: getLastAssistantText(state),
        bookingUrl,
      });
      if (guarded) {
        const transfersSafetyOwnership = ["medical_critical", "emotional_crisis",
          "legal_privacy"].includes(decision.decisionType);
        // Record the one permitted safety notice BEFORE human takeover.
        // appendAssistantMessage changes lastActor to AI; the Inbox must keep
        // lastActor=human once Jochen owns the conversation.
        if (transfersSafetyOwnership) appendAssistantMessage(state, guarded.text);
        applyPeteDecisionStatePatch({
          decision, composed: guarded, state, runtimeBookingUrl: bookingUrl,
        });
        // A previous LLM reply must not remain the reported source of this
        // deterministic STOP/medical/privacy response in QA transcripts.
        updateAnswer(state, "peteReplySource", "guarded_safety");
        if (!transfersSafetyOwnership) appendAssistantMessage(state, guarded.text);
        persistConversationState(state);
        return { text: guarded.text, nextStep: state.currentStep,
          detectedIntent: mapPeteDecisionToIntent(decision), state };
      }
    }

    if (state.flags.peteRuntimeHandoffActive) {
      persistConversationState(state);
      return { text: null, nextStep: state.currentStep,
        detectedIntent: "unknown", state, replySuppressedReason: "human_owned" };
    }

    // Phase 1: an explicitly selected LLM path is separate from the legacy
    // deterministic natural flow. Safety and ownership checks above remain
    // authoritative. Trusted product/transaction requests stay deterministic.
    // Bot identity is factual, not a model-generated guess. Keep this
    // deterministic even when the LLM feature has been selected.
    if (isPeteLlmConversationSelected() &&
        /\b(?:wer schreibt mir|wer antwortet mir|bist du (?:ein )?bot|bist du (?:eine )?ki|schreibt jochen (?:pers[oö]nlich)?|bist du jochen)\b/i.test(input.messageText)) {
      const identity = "Ich bin Pete, Jochens KI-Assistent. Ich helfe bei der ersten Einordnung. Wenn du persönlich mit Jochen sprechen möchtest, sage es einfach.";
      updateAnswer(state, "peteReplySource", "deterministic");
      updateAnswer(state, "peteIdentityDisclosed", true);
      appendAssistantMessage(state, identity);
      persistConversationState(state);
      return { text: identity, nextStep: state.currentStep,
        detectedIntent: "flow_answer", state };
    }

    if (isPeteLlmConversationSelected() &&
        isExplicitPeteHumanTakeoverRequest(input.messageText)) {
      patchAnswers(state, { peteReplySource: "human_handoff" });
      patchFlags(state, {
        peteRuntimeHandoffRequested: true,
        peteRuntimeHandoffActive: true,
      });
      takeOverByHuman(state);
      // Owner takeover is an internal state transition, never an automatic
      // system announcement to the lead. Human replies remain attributable.
      persistConversationState(state);
      return { text: null, nextStep: state.currentStep,
        detectedIntent: "flow_answer", state,
        replySuppressedReason: "human_owned" };
    }

    // A mention of prices, terms or appointments must NOT force a
    // context-rich question into the mechanical legacy funnel. First answer
    // ONLY a verifiable transaction request, otherwise let the LLM respond.
    if (isPeteLlmConversationSelected()) {
      const verified = getPeteVerifiedTransactionAnswer(input.messageText, state, bookingUrl);
      if (verified) {
        updateAnswer(state, "peteReplySource", "verified_transaction");
        if (verified.nextPhase) updateAnswer(state, "naturalPhase", verified.nextPhase);
        if (verified.handoff) {
          patchFlags(state, {
            peteRuntimeHandoffRequested: true,
            peteRuntimeHandoffActive: true,
          });
          // Answer once as Pete before transferring ownership; otherwise
          // appendAssistantMessage would incorrectly reset lastActor to AI
          // after the owner had already taken the conversation.
          if (verified.text) appendAssistantMessage(state, verified.text);
          takeOverByHuman(state);
          // Do not announce the internal takeover or fabricate verification.
          // Explicit requests for Jochen to write are handled above and stay
          // completely silent. Future model/automation replies are blocked.
          persistConversationState(state);
          return { text: verified.text || null, nextStep: state.currentStep,
            detectedIntent: "flow_answer", state,
            ...(verified.text ? {} : { replySuppressedReason: "human_owned" as const }) };
        }
        if (verified.nextPhase === "booking_offered" && bookingUrl) {
          patchFlags(state, { wantsBooking: true });
          setCurrentStep(state, "booking");
          state.providerBooking = activateProviderBookingState({
            current: state.providerBooking,
            provider: inferBookingProviderFromUrl(bookingUrl),
            bookingUrl, linkSentAt: nowIso(),
          });
        }
        const text = disclosePeteIdentity(state, verified.text);
        appendAssistantMessage(state, text);
        persistConversationState(state);
        return { text, nextStep: state.currentStep,
          detectedIntent: "flow_answer", state };
      }
    }

    if (isPeteLlmConversationSelected()) {
      const result = await getPeteLlmConversationReply(state, bookingUrl);
      // The LLM call is asynchronous. A human may take over, STOP may arrive,
      // or another incoming message may supersede this one during the await.
      // Always reload the authoritative state before appending its response.
      const latest = getConversationState(input.leadId, campaign.id);
      if (!latest || latest.flags.stopped) {
        return { text: null, nextStep: latest?.currentStep ?? state.currentStep,
          detectedIntent: "stop", state: latest ?? state,
          replySuppressedReason: "stopped" };
      }
      if (latest.owner === "human" || latest.aiPaused === true ||
          latest.flags.peteRuntimeHandoffActive) {
        return { text: null, nextStep: latest.currentStep,
          detectedIntent: "unknown", state: latest,
          replySuppressedReason: "human_owned" };
      }
      if (latest.messages.at(-1)?.id !== lastIncomingMessageId) {
        return { text: null, nextStep: latest.currentStep,
          detectedIntent: "unknown", state: latest,
          replySuppressedReason: "superseded" };
      }
      if (result.kind === "suppressed") {
        // An owner switching the local test OFF is not a human takeover.
        // Preserve the conversation so a later explicit ON can resume it.
        return { text: null, nextStep: latest.currentStep,
          detectedIntent: "unknown", state: latest,
          replySuppressedReason: "desktop_switched_off" };
      }
      if (result.kind === "llm" || result.kind === "safe_reply" || result.kind === "verified_next_step") {
        patchAnswers(latest, {
          peteProviderUsageMetered: false, peteProviderModel: undefined,
          peteProviderInputTokens: undefined, peteProviderOutputTokens: undefined,
          peteSemanticNextStep: undefined,
          peteSemanticProposalRejected: result.kind === "llm" && result.rejectedNextStep === true,
        });
        updateAnswer(latest, "peteReplySource", result.kind === "llm" ? "llm" :
          result.kind === "verified_next_step" ? "verified_transaction" : "safe_noncritical");
        if (result.kind === "llm" || result.kind === "verified_next_step") patchAnswers(latest, {
          peteProviderUsageMetered: Boolean(result.usage),
          peteProviderModel: result.usage?.model,
          peteProviderInputTokens: result.usage?.inputTokens,
          peteProviderOutputTokens: result.usage?.outputTokens,
        });
        if (result.kind === "verified_next_step") {
          updateAnswer(latest, "peteSemanticNextStep", result.nextStep);
          if (result.nextPhase) updateAnswer(latest, "naturalPhase", result.nextPhase);
          // Link-only browsing is NOT booking intent or follow-up authorization.
          if (result.nextPhase === "booking_offered" && bookingUrl) {
            patchFlags(latest, { wantsBooking: true });
            setCurrentStep(latest, "booking");
            latest.providerBooking = activateProviderBookingState({
              current: latest.providerBooking, provider: inferBookingProviderFromUrl(bookingUrl),
              bookingUrl, linkSentAt: nowIso(),
            });
          }
        }
        const text = disclosePeteIdentity(latest, result.text);
        appendAssistantMessage(latest, text);
        persistConversationState(latest);
        return { text, nextStep: latest.currentStep,
          detectedIntent: "flow_answer", state: latest };
      }
      // Policy-v4: a narrow, verified non-medical answer can repair a
      // needless escalation for a routine interruption by a sick child.
      // Never override STOP, human ownership, actual emergencies, failed
      // provider authorization or budget exhaustion. All such guards ran above.
      if ((result.reason === "model_handoff" || result.reason === "invalid_output")) {
        const routine = peteSafeRoutineRepairReply(latest);
        if (routine) {
          patchAnswers(latest, {
            peteReplySource: "safe_noncritical",
            peteLlmFailureReason: result.reason,
            peteLlmFailureDetail: "verified_family_routine_repair",
          });
          appendAssistantMessage(latest, routine);
          persistConversationState(latest);
          return { text: routine, nextStep: latest.currentStep,
            detectedIntent: "flow_answer", state: latest };
        }
        // Only a model-initiated handoff (not unsafe/invalid model output) may
        // use a narrowly verified explanation. Medical/sales/privacy excluded.
        const noncritical = result.reason === "model_handoff"
          ? peteSafeNoncriticalExplanationReply(latest) : null;
        if (noncritical) {
          patchAnswers(latest, {
            peteReplySource: "safe_noncritical",
            peteLlmFailureReason: result.reason,
            peteLlmFailureDetail: "verified_method_or_entry_answer",
          });
          appendAssistantMessage(latest, noncritical);
          persistConversationState(latest);
          return { text: noncritical, nextStep: latest.currentStep,
            detectedIntent: "flow_answer", state: latest };
        }
      }
      // In an authenticated synthetic desktop lab, a provider/network/budget
      // failure must not permanently transfer this test contact to a human.
      // The real customer path and model/safety-driven handoffs stay unchanged.
      if (isRetryableDesktopTechnicalFailure(result.reason, desktopCallMode() !== null)) {
        patchAnswers(latest, {
          peteReplySource: "llm_handoff",
          peteLlmFailureReason: result.reason,
          peteLlmFailureDetail: result.detail ?? "unspecified",
        });
        const localNotice = "Lokaler Test: Keine bestätigte OpenAI-Antwort. Ursache im Pete-KI-Diagnosefeld prüfen.";
        appendAssistantMessage(latest, localNotice);
        persistConversationState(latest);
        return { text: localNotice, nextStep: latest.currentStep,
          detectedIntent: "flow_answer", state: latest };
      }
      // Fail closed: never silently continue the old broken question loop.
      patchAnswers(latest, {
        peteReplySource: "llm_handoff",
        peteLlmFailureReason: result.reason,
        peteLlmFailureDetail: result.detail ?? "unspecified",
      });
      patchFlags(latest, {
        peteRuntimeHandoffRequested: true,
        peteRuntimeHandoffActive: true,
      });
      takeOverByHuman(latest);
      // No technical handoff text may be sent to a real contact.
      persistConversationState(latest);
      return { text: null, nextStep: latest.currentStep,
        detectedIntent: "flow_answer", state: latest,
        replySuppressedReason: "human_owned" };
    }

    const natural = getNaturalConversationReply({
      text: input.messageText, state, bookingUrl,
    });
    if (natural) {
      updateAnswer(state, "peteReplySource", "deterministic");
      if (natural.phase) updateAnswer(state, "naturalPhase", natural.phase);
      if (natural.track) updateAnswer(state, "naturalTrack", natural.track);
      if (natural.infoOnly) {
        patchFlags(state, { wantsInfoOnly: true });
        setCurrentStep(state, "info_only");
      }
      if (natural.handoff) {
        patchFlags(state, {
          peteRuntimeHandoffRequested: true,
          peteRuntimeHandoffActive: true,
        });
        takeOverByHuman(state);
        // The natural responder's handoff wording is for internal routing only.
        // Keep urgent safety notices on their earlier, separate guarded path.
        updateAnswer(state, "peteReplySource", "human_handoff");
        persistConversationState(state);
        return { text: null, nextStep: state.currentStep,
          detectedIntent: "flow_answer", state,
          replySuppressedReason: "human_owned" };
      }
      if (natural.booking) {
        patchFlags(state, { wantsBooking: true });
        setCurrentStep(state, "booking");
        if (bookingUrl) {
          state.providerBooking = activateProviderBookingState({
            current: state.providerBooking,
            provider: inferBookingProviderFromUrl(bookingUrl),
            bookingUrl,
            linkSentAt: nowIso(),
          });
        }
      }
      appendAssistantMessage(state, natural.text);
      persistConversationState(state);
      return { text: natural.text, nextStep: state.currentStep,
        detectedIntent: natural.booking ? "booking_intent" : "flow_answer", state };
    }

    // A natural conversation must never fall through into the legacy A/B/C
    // questionnaire, even if a future natural responder returns no answer.
    // Hand over rather than resuming an unrelated scripted funnel step.
    updateAnswer(state, "peteReplySource", "natural_handoff");
    patchFlags(state, {
      peteRuntimeHandoffRequested: true,
      peteRuntimeHandoffActive: true,
    });
    takeOverByHuman(state);
    persistConversationState(state);
    return { text: null, nextStep: state.currentStep,
      detectedIntent: "unknown", state,
      replySuppressedReason: "human_owned" };
  }

  if (isSelfstarterInterest(input.messageText)) {
    const replyText = buildSelfstarterReply();
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: "selfstarter_interest",
      state,
    };
  }

  const runtimeBookingUrl = getRuntimeBookingUrl({ state });
  const peteDecision = decidePeteNextAction(input.messageText, {
    campaign,
    currentStep: state.currentStep,
    hasPendingBooking: Boolean(state.answers.pendingBookingText),
    hasActiveProviderBooking: hasActiveProviderBooking(state),
    askedPrice: state.flags.askedPrice,
    lastAssistantText: getLastAssistantText(state),
    bookingUrl: runtimeBookingUrl,
    handoffActive: Boolean(state.flags.peteRuntimeHandoffActive),
    previousObjectionIntent: getStoredAnswerString(state, "objectionIntent"),
    previousObjectionCount: getStoredAnswerNumber(state, "objectionCount"),
  });
  const peteComposedResponse = composePeteResponse(peteDecision, {
    campaign,
    currentStep: state.currentStep,
    userText: input.messageText,
    lastAssistantText: getLastAssistantText(state),
    bookingUrl: runtimeBookingUrl,
  });

  if (peteComposedResponse) {
    applyPeteDecisionStatePatch({
      decision: peteDecision,
      composed: peteComposedResponse,
      state,
      runtimeBookingUrl,
    });

    appendAssistantMessage(state, peteComposedResponse.text);
    persistConversationState(state);

    return {
      text: peteComposedResponse.text,
      nextStep: peteComposedResponse.nextStep ?? state.currentStep,
      detectedIntent: mapPeteDecisionToIntent(peteDecision),
      state,
    };
  }

  const hardStopObjection = classifyPeteObjection(input.messageText);
  if (hardStopObjection.intent === "hard_stop") {
    const objectionResult = evaluatePeteObjection(input.messageText, {
      objectionCount: getPeteObjectionCount(state, hardStopObjection.intent),
    });
    const handledObjection = handlePeteObjectionResult({
      campaign,
      state,
      result: objectionResult,
      inputText: input.messageText,
    });

    if (handledObjection) {
      return handledObjection;
    }
  }

  const detectedIntent = detectLeadIntent(input.messageText);

  if (
    detectedIntent.intent === "stop" &&
    hardStopObjection.intent !== "no_interest"
  ) {
    patchFlags(state, { stopped: true });
    setCurrentStep(state, "done");

    const replyText =
      "Alles klar, danke für die Rückmeldung. Dann schreibe ich dir dazu nicht weiter.";
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: "done",
      detectedIntent: "stop",
      state,
    };
  }

  const peteSafety = evaluatePeteRuntimeSafety(input.messageText, {
    campaign,
    currentStep: state.currentStep,
    hasPendingBooking: Boolean(state.answers.pendingBookingText),
    hasActiveProviderBooking: hasActiveProviderBooking(state),
    askedPrice: state.flags.askedPrice,
    lastAssistantText: getLastAssistantText(state),
    bookingUrl: runtimeBookingUrl,
  });

  if (
    peteSafety.shouldIntercept &&
    peteSafety.replyText &&
    !shouldLetObjectionModuleHandlePeteSafety(peteSafety)
  ) {
    patchAnswers(state, buildPeteSafetyStatePatch(peteSafety));

    if (peteSafety.category === "price") {
      patchFlags(state, { askedPrice: true });
    }

    if (peteSafety.category === "info_link") {
      patchFlags(state, {
        wantsInfoOnly: true,
        wantsInfoLinkOnly: true,
      });
      setCurrentStep(state, "info_only");
    }

    if (
      peteSafety.category === "human_request" ||
      peteSafety.category === "booking_link"
    ) {
      patchFlags(state, {
        wantsBooking: true,
        peteRuntimeHandoffRequested: Boolean(peteSafety.shouldHandoffToJochen),
      });
      setCurrentStep(state, "booking");

      if (runtimeBookingUrl && !peteSafety.shouldHandoffToJochen) {
        state.providerBooking = activateProviderBookingState({
          current: state.providerBooking,
          provider: inferBookingProviderFromUrl(runtimeBookingUrl),
          bookingUrl: runtimeBookingUrl,
          linkSentAt: nowIso(),
        });
      }
    } else if (peteSafety.shouldHandoffToJochen) {
      patchFlags(state, {
        peteRuntimeHandoffRequested: true,
      });
    }

    if (peteSafety.shouldStopAutomation) {
      patchFlags(state, {
        peteRuntimeHandoffActive: true,
      });
    }

    const replyText = peteSafety.replyText;
    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: state.currentStep,
      detectedIntent: mapPeteSafetyCategoryToIntent(peteSafety.category),
      state,
    };
  }

  const objectionClassification = classifyPeteObjection(input.messageText);
  if (objectionClassification.intent !== "none") {
    const objectionResult = evaluatePeteObjection(input.messageText, {
      objectionCount: getPeteObjectionCount(state, objectionClassification.intent),
    });
    const handledObjection = handlePeteObjectionResult({
      campaign,
      state,
      result: objectionResult,
      inputText: input.messageText,
    });

    if (handledObjection) {
      return handledObjection;
    }
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

  if (hasActiveProviderBooking(state)) {
    if (isProviderBookingCompletion(input.messageText)) {
      // A chat user's "ich habe gebucht" is not provider confirmation.
      // Stay awaiting_booking until the verified booking webhook arrives.
      const replyText =
        "Danke dir 👍 Wenn du den Termin über den Buchungslink bestätigt hast, " +
        "bekommst du die Bestätigung vom Buchungstool. " +
        "Ich prüfe den Terminstatus erst nach der tatsächlichen Buchungsbestätigung.";

      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "booking",
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
    isStrongCoachingEntryBuySignal(input.messageText)
  ) {
    resetPriceFlowState(state);
    patchFlags(state, {
      wantsDirectBuyCoachingEntry: true,
      wantsDirectBuyStarter: true,
    });

    const replyText = canSendCoachingEntryCheckoutDirectly({
      hasInstallmentRequest: state.flags.askedInstallments,
      wantsLongTermSupport: state.flags.wantsLongTermSupport,
    })
      ? buildCoachingEntryDirectBuyLeadReply(campaign.id)
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
      detectedIntent: "direct_buy_coaching_entry",
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

  if (detectedIntent.intent === "direct_buy_coaching_entry") {
    resetPriceFlowState(state);
    patchFlags(state, {
      wantsDirectBuyCoachingEntry: true,
      wantsDirectBuyStarter: true,
    });

    const replyText = canSendCoachingEntryCheckoutDirectly({
      hasInstallmentRequest: state.flags.askedInstallments,
      wantsLongTermSupport: state.flags.wantsLongTermSupport,
    })
      ? buildCoachingEntryDirectBuyLeadReply(campaign.id)
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
      detectedIntent: "direct_buy_coaching_entry",
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
      // Preserve disclosed parental context while still asking for a real
      // first name. Otherwise "Ich bin Papa von zwei Kindern" would either
      // be treated as two people or ask the parent question a second time.
      const parentContextFromIntro = parseParentContext(input.messageText);
      if (parentContextFromIntro.explicit) {
        patchAnswers(state, {
          parentRole: parentContextFromIntro.role,
          parentContextText: parentContextFromIntro.rawText,
          isTargetParent: parentContextFromIntro.role !== "not_parent",
        });
      }
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

    const parentContextFromName = parseParentContext(input.messageText);
    if (parentContextFromName.explicit) {
      patchAnswers(state, {
        parentRole: parentContextFromName.role,
        parentContextText: parentContextFromName.rawText,
        isTargetParent: parentContextFromName.role !== "not_parent",
      });
    }

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

    const parentContextFromAck = parseParentContext(input.messageText);
    if (parentContextFromAck.explicit) {
      patchAnswers(state, {
        parentRole: parentContextFromAck.role,
        parentContextText: parentContextFromAck.rawText,
        isTargetParent: parentContextFromAck.role !== "not_parent",
      });
    }

    if (state.answers.parentRole === "not_parent") {
      patchFlags(state, { wantsInfoOnly: true });
      setCurrentStep(state, "info_only");

      const replyText =
        "Danke für die Klarheit. Mein Coaching ist wirklich auf den Elternalltag zugeschnitten, deshalb würde ich dir hier nichts aufdrücken.\nWenn du trotzdem nur einen Einblick in die Methode willst, kann ich dir den passenden Link schicken.";
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "info_only",
        detectedIntent: "flow_answer",
        state,
      };
    }

    let nextStep = getNextFlowStep(campaign.id, "intro_ack");
    if (!nextStep) {
      throw new Error("Missing next flow step after intro_ack.");
    }

    if (
      nextStep.id === "parent_context" &&
      state.answers.parentRole &&
      state.answers.parentRole !== "unknown"
    ) {
      const afterParent = getNextFlowStep(campaign.id, "parent_context");
      if (!afterParent) {
        throw new Error("Missing next flow step after parent_context.");
      }
      nextStep = afterParent;
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

  if (state.currentStep === "parent_context") {
    const parentContext = parseParentContext(input.messageText);

    if (!parentContext.explicit || parentContext.role === "unknown") {
      const replyText =
        "Nur damit ich dich wirklich richtig einordne: Bist du Mama, Papa oder grundsätzlich Elternteil?\nDas Alter der Kinder kannst du gern direkt dazuschreiben.";
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "parent_context",
        detectedIntent: "flow_answer",
        state,
      };
    }

    patchAnswers(state, {
      parentRole: parentContext.role,
      parentContextText: parentContext.rawText,
      isTargetParent: parentContext.role !== "not_parent",
    });

    if (parentContext.role === "not_parent") {
      patchFlags(state, { wantsInfoOnly: true });
      setCurrentStep(state, "info_only");

      const replyText =
        "Danke dir. Mein Coaching ist bewusst für Eltern gebaut. Deshalb macht es keinen Sinn, dich jetzt durch einen Eltern-Funnel zu drücken.\nWenn du nur die Methode anschauen willst, kann ich dir den Link schicken.";
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "info_only",
        detectedIntent: "flow_answer",
        state,
      };
    }

    const situationStep = getStepOrThrow(campaign.id, "situation_choice");
    const situationChoice = await resolveAdaptiveChoice({
      stepId: "situation_choice",
      input: input.messageText,
      step: situationStep,
      leadName: state.answers.name,
    });

    if (situationChoice) {
      patchAnswers(state, {
        situationChoice,
        situationChoiceText: input.messageText.trim(),
      });

      const nextStep = getNextFlowStep(campaign.id, "situation_choice");
      if (!nextStep) {
        throw new Error("Missing next flow step after situation_choice.");
      }

      setCurrentStep(state, nextStep.id);
      const replyText =
        buildNaturalChoiceAcknowledgement("situation_choice", situationChoice) +
        "\n\n" +
        buildQuestionReply(campaign.id, nextStep);
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: nextStep.id,
        detectedIntent: "flow_answer",
        state,
      };
    }

    const nextStep = getNextFlowStep(campaign.id, "parent_context");
    if (!nextStep) {
      throw new Error("Missing next flow step after parent_context.");
    }

    setCurrentStep(state, nextStep.id);

    const replyText =
      "Perfekt, danke. Dann weiß ich schon mal, aus welchem Alltag du kommst.\n\n" +
      buildQuestionReply(campaign.id, nextStep);
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
    const mappedChoice = await resolveAdaptiveChoice({
      stepId: "situation_choice",
      input: input.messageText,
      step,
      leadName: state.answers.name,
    });

    if (!mappedChoice) {
      const replyText = buildHumanChoiceClarifier("situation_choice");
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "situation_choice",
        detectedIntent: detectedIntent.intent,
        state,
      };
    }

    patchAnswers(state, {
      situationChoice: mappedChoice,
      situationChoiceText: input.messageText.trim(),
    });

    const nextStep = getNextFlowStep(campaign.id, "situation_choice");
    if (!nextStep) {
      throw new Error("Missing next flow step after situation_choice.");
    }

    setCurrentStep(state, nextStep.id);

    const replyText =
      buildNaturalChoiceAcknowledgement("situation_choice", mappedChoice) +
      "\n\n" +
      buildQuestionReply(campaign.id, nextStep);
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

    setCurrentStep(state, nextStep.id);

    const replyText = aiBridge?.replyText?.trim()
      ? aiBridge.replyText.trim() + "\n\n" + nextQuestion
      : nextQuestion;

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
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

    setCurrentStep(state, nextStep.id);

    const replyText = aiBridge?.replyText?.trim()
      ? aiBridge.replyText.trim() + "\n\n" + nextQuestion
      : nextQuestion;

    appendAssistantMessage(state, replyText);
    persistConversationState(state);

    return {
      text: replyText,
      nextStep: nextStep.id,
      detectedIntent: "flow_answer",
      state,
    };
  }

  if (state.currentStep === "goal_choice") {
    const step = getStepOrThrow(campaign.id, "goal_choice");
    const mappedChoice = await resolveAdaptiveChoice({
      stepId: "goal_choice",
      input: input.messageText,
      step,
      leadName: state.answers.name,
    });

    if (!mappedChoice) {
      const replyText = buildHumanChoiceClarifier("goal_choice");
      appendAssistantMessage(state, replyText);
      persistConversationState(state);

      return {
        text: replyText,
        nextStep: "goal_choice",
        detectedIntent: detectedIntent.intent,
        state,
      };
    }

    patchAnswers(state, {
      goalChoice: mappedChoice,
      goalChoiceText: input.messageText.trim(),
    });

    const nextStep = getNextFlowStep(campaign.id, "goal_choice");
    if (!nextStep) {
      throw new Error("Missing next flow step after goal_choice.");
    }

    setCurrentStep(state, nextStep.id);

    const replyText =
      buildNaturalChoiceAcknowledgement("goal_choice", mappedChoice) +
      "\n\n" +
      buildQuestionReply(campaign.id, nextStep);
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

    const score = extractScaleValue(input.messageText, minScale, maxScale);
    if (score === null) {
      throw new Error("Scale value passed validation but could not be extracted.");
    }
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
