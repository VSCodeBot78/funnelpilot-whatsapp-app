import type {
  GhostingCycle,
  GhostingStage,
  GhostingState,
  GhostingSentEntry,
} from "./ghosting.types.js";
import type {
  ProviderBookingState,
  ProviderBookingStatus,
} from "./provider-booking.types.js";

export type GhostingStoppedReason =
  | "manual_stop"
  | "dead"
  | "user_replied"
  | "booked";

export type ProviderBookingProvider =
  | "manual"
  | "calendly"
  | "meetergo"
  | "google_calendar"
  | "zoom"
  | "meet";

export type ProviderBookingWebhookEventType =
  | "invitee.created"
  | "invitee.canceled"
  | "booking.created"
  | "booking.rescheduled"
  | "booking.cancelled";

export type FlowStepId =
  | "ask_name"
  | "intro_ack"
  | "situation_choice"
  | "tried_before_freetext"
  | "consequence_freetext"
  | "goal_choice"
  | "importance_scale"
  | "commitment"
  | "booking"
  | "info_only"
  | "done";

export type FlowStepType =
  | "name"
  | "ack"
  | "choice"
  | "freetext"
  | "scale"
  | "commitment"
  | "message";

export type FlowOption = {
  key: string;
  label: string;
};

export type FlowStepDefinition = {
  id: FlowStepId;
  type: FlowStepType;
  prompt?: string;
  options?: FlowOption[];
  minScale?: number;
  maxScale?: number;
};

export type CommitmentChoice = "really_start" | "info_only" | "info_first";

export type BookingPreference = "vormittags" | "nachmittags" | "unknown";

export type BookingRequestData = {
  requestedText: string;
  requestedDay?: string;
  requestedTimeText?: string;
  requestedPreference: BookingPreference;
  detectedAt: string;
  status: "requested" | "confirmed";
};

export type BookingDataStatus =
  | "inactive"
  | "requested"
  | "pending_confirmation"
  | "booked"
  | "cancelled"
  | "completed";

export type BookingProvider =
  | "manual"
  | "calendly"
  | "google_calendar"
  | "meetergo"
  | "zoom"
  | "meet"
  | "";

export type MeetingType = "phone" | "video" | "in_person" | "unknown" | "";

export type BookingData = {
  selectedSlot: string;
  startAt?: string;
  endAt?: string;
  bookingProvider: BookingProvider;
  bookingId: string;
  externalBookingId: string;
  calendarEventId: string;
  meetingLink: string;
  meetingType: MeetingType;
  status: BookingDataStatus;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  notes: string;
};

export type BookingEventLogStatus = "processed" | "ignored_duplicate" | "failed";

export type BookingEventLogEntry = {
  id: string;
  provider: string;
  eventType: string;
  campaignId: string;
  leadId?: string;
  externalBookingId?: string;
  calendarEventId?: string;
  status: BookingEventLogStatus;
  receivedAt: string;
  processedAt?: string;
  error?: string;
  rawPayload?: unknown;
  idempotencyKey: string;
};

export type BookingRequestDetectionResult = {
  preference: BookingPreference;
  hasConcreteRequest: boolean;
  requestedText?: string;
  requestedDay?: string;
  requestedTimeText?: string;
};

export type SuggestedBookingOption = {
  day: string;
  time: string;
  label: string;
};

export type AvailabilitySlot = {
  day: string;
  time: string;
};

export type AvailabilityCheckResult = {
  isBookable: boolean;
  matchedSlot?: AvailabilitySlot;
  suggestions: AvailabilitySlot[];
};

/**
 * Wichtig:
 * Index-Signature für ältere Generic-Helper in state-manager.ts
 */
export type ConversationAnswerValue =
  | string
  | number
  | boolean
  | CommitmentChoice
  | BookingPreference
  | BookingRequestData
  | SuggestedBookingOption[]
  | undefined;

export type ConversationAnswerMap = {
  [key: string]: ConversationAnswerValue;
  name?: string;
  situationChoice?: string;
  triedBeforeText?: string;
  consequenceText?: string;
  goalChoice?: string;
  importanceScore?: number;
  commitmentChoice?: CommitmentChoice;
  bookingRequest?: BookingRequestData;
  pendingBookingText?: string;
  pendingBookingDay?: string;
  pendingBookingTime?: string;
  lastSuggestedBookingOptions?: SuggestedBookingOption[];
  pausedFromStep?: FlowStepId;
  pausedLastQuestion?: string;
  pausedAt?: string;

  starterCheckoutSentAt?: string;
  starterPurchaseStatus?: "none" | "link_sent" | "paid";
  starterPurchasedAt?: string;
  starterCheckoutSessionId?: string;
  starterProductId?: string;
  onboardingBookingUrl?: string;
  onboardingPromptSentAt?: string;
};

export type ConversationFlags = {
  [key: string]: boolean;
  stopped: boolean;
  paused: boolean;
  askedInstallments: boolean;
  wantsBooking: boolean;
  wantsLongTermSupport: boolean;
  wantsDirectBuyStarter: boolean;
  askedPrice: boolean;
  wantsInfoOnly: boolean;
  wantsInfoLinkOnly: boolean;
};

export type ConversationMessageRole = "user" | "assistant";

export type MessageOutboundStatus =
  | "prepared"
  | "dry_run"
  | "sent"
  | "send_failed";

export type ConversationMessage = {
  id: string;
  role: ConversationMessageRole;
  text: string;
  createdAt: string;
  outboundStatus?: MessageOutboundStatus;
  transport?: "meta_whatsapp" | string;
  dryRun?: boolean;
  sentAt?: string | null;
  metaMessageId?: string | null;
  sent?: boolean;
  sendError?: string | null;
};

export type ConversationState = {
  leadId: string;
  backendLeadId?: string;
  campaignId: string;
  currentStep: FlowStepId;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
  lastUserMessageAt?: string;
  lastAssistantMessageAt?: string;
  leadName?: string;
  phone?: string;
  source?: string;
  notes?: string;
  stage?: FlowStepId;
  answers: ConversationAnswerMap;
  flags: ConversationFlags;
  messages: ConversationMessage[];
  ghosting: GhostingState;
  providerBooking: ProviderBookingState;
  bookingData?: BookingData;
};

export type CampaignTexts = {
  introTemplate: string;
  infoShortText: string;
  infoPageUrl: string;
  commitmentPrompt: string;
  bookingPrompt: string;
  bookingFollowUpPrompt: string;
  bookingNoShowGuardTemplate: string;
  bookingConfirmedTemplate: string;
  starterPriceText: string;
  starterCheckoutUrl: string;
  starterDirectBuyText: string;
  starterPriceReply: string;
  longTermReply: string;
  installmentsReply: string;
  infoLinkReply: string;
  introAckValidationReply: string;

  onboardingBookingUrl: string;
  starterPurchaseSuccessReply: string;
};

export type CampaignOfferContext = {
  priceInquiryText: string;
  infoLink1Enabled: boolean;
  infoLink1Label: string;
  infoLink1Url: string;
  infoLink2Enabled: boolean;
  infoLink2Label: string;
  infoLink2Url: string;
  internalNote: string;
};

export type CampaignEntryChannel =
  | "meta_ctwa"
  | "website_whatsapp_link"
  | "qr_shortlink"
  | "organic_dm"
  | "manual";

export type CampaignStarterMode =
  | "prefilled_message"
  | "start_conversation_prompt"
  | "whatsapp_flow"
  | "free_text";

export type CampaignEntryMatchingMode =
  | "hybrid"
  | "referral_only"
  | "text_only"
  | "fallback_only";

export type CampaignEntryConfig = {
  entryChannel: CampaignEntryChannel;
  starterMode: CampaignStarterMode;
  suggestedEntryMessage: string;
  matchingMode: CampaignEntryMatchingMode;
  exactTriggerRequired: boolean;
  triggerFallbackEnabled: boolean;
  ctwaAttributionEnabled: boolean;
  metaAdId: string;
  metaAdName: string;
  metaCampaignId: string;
  metaCampaignName: string;
  unknownEntryFallbackText: string;
};

export type CampaignConfig = {
  id: string;
  name: string;
  triggerKeywords: string[];
  flow: FlowStepDefinition[];
  texts: CampaignTexts;
  offerContext?: CampaignOfferContext;
  entryConfig?: CampaignEntryConfig;
};

export type LeadIntent =
  | "stop"
  | "installments"
  | "long_term_support"
  | "direct_buy_starter"
  | "price_question"
  | "info_link_only"
  | "info_only"
  | "booking_intent"
  | "flow_answer"
  | "unknown";

export type PriceIntentSubtype =
  | "price_info"
  | "price_test"
  | "price_objection";

export type PriceIntentTone =
  | "neutral"
  | "direct"
  | "resistant";

export type IntentDetectionResult = {
  intent: LeadIntent;
  confidence: number;
  matchedText?: string;
  priceSubtype?: PriceIntentSubtype;
  priceTone?: PriceIntentTone;
};

export type EngineInput = {
  leadId: string;
  campaignId: string;
  messageText: string;
};

export type EngineReply = {
  text: string;
  nextStep: FlowStepId;
  detectedIntent: LeadIntent;
  state: ConversationState;
};

export type IncomingMessagePayload = {
  leadId?: string;
  phone?: string;
  from?: string;
  contactId?: string;
  campaignId?: string;
  trigger?: string;
  messageText?: string;
  message?: string;
  text?: string;
  source?: string;
  channel?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
};

export type MappedIncomingMessage = {
  leadId: string;
  campaignId: string;
  messageText: string;
  source: string;
  externalId?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
};

export type IncomingMessageResponse = {
  ok: boolean;
  reply?: string;
  nextStep?: FlowStepId;
  detectedIntent?: LeadIntent;
  leadId?: string;
  campaignId?: string;
  source?: string;
  state?: ConversationState;
  error?: string;
};

export type CheckoutWebhookPayload = {
  leadId?: string;
  campaignId?: string;
  event?: string;
  status?: string;
  paymentStatus?: string;
  orderStatus?: string;
  checkoutId?: string;
  productId?: string;
  onboardingBookingUrl?: string;
  successReply?: string;
  metadata?: Record<string, unknown>;
};

export type CheckoutWebhookResponse = {
  ok: boolean;
  duplicated?: boolean;
  leadId?: string;
  campaignId?: string;
  status?: string;
  message?: string;
  reply?: string;
  error?: string;
};

/**
 * -----------------------------------------
 * Backward compatibility für bestehende Dateien
 * -----------------------------------------
 */
export type ChatMessage = ConversationMessage;
export type LeadAnswers = ConversationAnswerMap;
export type LeadFlags = ConversationFlags;
export type CreateMessageParams = {
  id?: string;
  role: ConversationMessageRole;
  text: string;
  createdAt?: string;
};
export type StoreRecord = Record<string, ConversationState>;

export type {
  GhostingCycle,
  GhostingStage,
  GhostingState,
  GhostingSentEntry,
  ProviderBookingState,
  ProviderBookingStatus,
};
