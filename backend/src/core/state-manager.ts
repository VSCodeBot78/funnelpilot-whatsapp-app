import {
  getConversationState,
  saveConversationState,
} from "../data/store.js";
import type {
  ChatMessage,
  ConversationState,
  CreateMessageParams,
  FlowStepId,
  LeadAnswers,
  LeadFlags,
} from "../types/types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function createMessage(params: CreateMessageParams): ChatMessage {
  return {
    id: params.id ?? crypto.randomUUID(),
    role: params.role,
    text: params.text,
    createdAt: params.createdAt ?? nowIso(),
  };
}

function createInitialConversationState(
  leadId: string,
  campaignId: string,
): ConversationState {
  const now = nowIso();

  return {
    leadId,
    campaignId,
    currentStep: "ask_name",
    createdAt: now,
    startedAt: now,
    updatedAt: now,
    lastUserMessageAt: undefined,
    lastAssistantMessageAt: undefined,
    answers: {},
    flags: {
      stopped: false,
      paused: false,
      askedInstallments: false,
      wantsBooking: false,
      wantsLongTermSupport: false,
      wantsDirectBuyStarter: false,
      askedPrice: false,
      wantsInfoOnly: false,
      wantsInfoLinkOnly: false,
    },
    messages: [],
    ghosting: {
      active: false,
      cycle: 1,
      stage: "inactive",
      isDead: false,
      sentHistory: [],
      startedAt: now,
    },
    providerBooking: {
      status: "inactive",
      active: false,
      stage: "inactive",
      sentHistory: [],
    },
  };
}

export function getOrCreateConversationState(
  leadId: string,
  campaignId: string,
): ConversationState {
  const existing = getConversationState(leadId, campaignId);

  if (existing) {
    return existing;
  }

  const created = createInitialConversationState(leadId, campaignId);
  saveConversationState(created);
  return created;
}

export function appendUserMessage(state: ConversationState, text: string): void {
  const message = createMessage({
    role: "user",
    text,
  });

  state.messages.push(message);
  state.lastUserMessageAt = message.createdAt;
  state.updatedAt = message.createdAt;
}

export function appendAssistantMessage(state: ConversationState, text: string): void {
  const message = createMessage({
    role: "assistant",
    text,
  });

  state.messages.push(message);
  state.lastAssistantMessageAt = message.createdAt;
  state.updatedAt = message.createdAt;
}

export function setCurrentStep(state: ConversationState, stepId: FlowStepId): void {
  state.currentStep = stepId;
  state.updatedAt = nowIso();
}

export function updateAnswer<K extends keyof LeadAnswers>(
  state: ConversationState,
  key: K,
  value: LeadAnswers[K],
): void {
  (state.answers as LeadAnswers)[key] = value;
  state.updatedAt = nowIso();
}

export function patchAnswers(
  state: ConversationState,
  updates: Partial<LeadAnswers>,
): void {
  state.answers = {
    ...state.answers,
    ...updates,
  };
  state.updatedAt = nowIso();
}

export function patchFlags(
  state: ConversationState,
  updates: Partial<LeadFlags>,
): void {
  state.flags = {
    ...state.flags,
    ...updates,
  } as LeadFlags;

  state.updatedAt = nowIso();
}

export function persistConversationState(state: ConversationState): void {
  state.updatedAt = nowIso();
  saveConversationState(state);
}
