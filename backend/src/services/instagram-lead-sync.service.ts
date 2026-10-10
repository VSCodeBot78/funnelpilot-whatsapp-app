import {
  DEFAULT_CAMPAIGN_ID,
  getCampaignById,
} from "../config/campaigns.js";
import { env } from "../config/env.js";
import {
  getLeadById,
  saveLead,
  type LeadRecord,
} from "../data/leads.store.js";
import { buildDefaultBookingData } from "../domain/booking-sync.js";

export type InstagramLeadAction = "found" | "created";

export type InstagramLeadSyncResult = {
  action: InstagramLeadAction;
  lead: LeadRecord;
  instagramScopedId: string;
  campaignId: string;
};

type SyncInstagramLeadInput = {
  instagramScopedId: string;
  displayName?: string;
  botEnabledForNewLead?: boolean;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildInstagramLeadId(
  instagramScopedId: string,
): string {
  const normalized = normalizeString(instagramScopedId);
  return normalized
    ? `instagram:${normalized}`
    : `instagram:${crypto.randomUUID()}`;
}

function buildNewInstagramLead(input: {
  leadId: string;
  instagramScopedId: string;
  displayName?: string;
  campaignId: string;
  botEnabled: boolean;
}): LeadRecord {
  const now = Date.now();

  return {
    id: input.leadId,
    backendLeadId: input.leadId,
    name: normalizeString(input.displayName) || "Instagram Lead",
    phone: "",
    source: "Instagram",
    campaignId: input.campaignId,
    tags: ["Neuer Lead", "Instagram"],
    stage: "ask_name",
    resumeStage: null,
    score: null,
    botEnabled: input.botEnabled,
    excluded: false,
    booked: false,
    note: input.botEnabled
      ? `Instagram IGSID: ${input.instagramScopedId}`
      : `Instagram IGSID: ${input.instagramScopedId} | Funnel Pilot wartet auf Handoff`,
    isBotTyping: false,
    intent: "",
    readiness: "cold",
    bookingData: buildDefaultBookingData(),
    messages: [],
    lastActivityAt: now,
  };
}

export function syncInstagramLead(
  input: SyncInstagramLeadInput,
): InstagramLeadSyncResult {
  const instagramScopedId = normalizeString(input.instagramScopedId);
  const campaignId = DEFAULT_CAMPAIGN_ID;
  const leadId = buildInstagramLeadId(instagramScopedId);
  const existingLead = getLeadById(leadId);

  if (existingLead) {
    return {
      action: "found",
      lead: existingLead,
      instagramScopedId,
      campaignId: getCampaignById(
        existingLead.campaignId || campaignId,
      ).id,
    };
  }

  const createdLead = saveLead(
    buildNewInstagramLead({
      leadId,
      instagramScopedId,
      displayName: input.displayName,
      campaignId,
      botEnabled:
        input.botEnabledForNewLead ??
        env.INSTAGRAM_AUTO_ENABLE_NEW_LEADS,
    }),
  );

  return {
    action: "created",
    lead: createdLead,
    instagramScopedId,
    campaignId,
  };
}
