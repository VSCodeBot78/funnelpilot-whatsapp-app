export type ProviderBookingStatus =
  | "inactive"
  | "awaiting_booking"
  | "booked"
  | "canceled";

export type ProviderFollowUpStage =
  | "inactive"
  | "reminder_6h"
  | "reminder_24h"
  | "reminder_48h";

export type ProviderFollowUpSentEntry = {
  stage: ProviderFollowUpStage;
  sentAt: string;
};

export type ProviderBookingState = {
  status: ProviderBookingStatus;
  provider?: string;
  bookingUrl?: string;
  linkSentAt?: string;
  bookedAt?: string;
  canceledAt?: string;
  active: boolean;
  stage: ProviderFollowUpStage;
  nextDueAt?: string;
  sentHistory: ProviderFollowUpSentEntry[];
  externalEventUri?: string;
  externalInviteeUri?: string;
  lastWebhookEventType?: string;
  lastWebhookReceivedAt?: string;
};

export type ProviderFollowUpEvaluationResult = {
  shouldActivate: boolean;
  active: boolean;
  status: ProviderBookingStatus;
  stage: ProviderFollowUpStage;
  nextDueAt?: string;
  dueNow: boolean;
  reason?: string;
  messagePreview?: string | null;
};
