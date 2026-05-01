export type SchedulingProvider =
  | "manual"
  | "calendly"
  | "meetergo"
  | "custom";

export type MeetingType = "phone" | "video" | "link";

export type SchedulingStatus =
  | "draft"
  | "requested"
  | "confirmed"
  | "provider_created";

export type SchedulingRequest = {
  leadId: string;
  campaignId: string;
  leadName?: string;
  bookingText: string;
  requestedDay?: string;
  requestedTimeText?: string;
  bookingStatus: SchedulingStatus;
  provider: SchedulingProvider;
  meetingType: MeetingType;
  platform: string;
  externalBookingUrl?: string;
  externalEventId?: string;
  readyForProvider: boolean;
  requestedAt?: string;
  confirmedAt?: string;
  providerLabel?: string;
  providerMode?: "manual" | "booking_link" | "direct_integration";
};

export type SchedulingPreviewResult = {
  ok: boolean;
  ready: boolean;
  schedulingRequest?: SchedulingRequest;
  error?: string;
};
