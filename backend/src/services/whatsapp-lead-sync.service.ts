import { DEFAULT_CAMPAIGN_ID } from "../config/campaigns.js";
import {
  getAllLeads,
  getLeadById,
  saveLead,
  type LeadRecord,
} from "../data/leads.store.js";
import { buildDefaultBookingData } from "../domain/booking-sync.js";

export type WhatsappLeadAction = "found" | "created";

export type WhatsappLeadSyncResult = {
  action: WhatsappLeadAction;
  lead: LeadRecord;
  normalizedPhone: string;
  campaignId: string;
};

type SyncWhatsappLeadInput = {
  from: string;
  contactName?: string;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeWhatsappPhone(value: unknown): string {
  return normalizeString(value).replace(/[^\d+]/g, "");
}

function digitsOnly(value: unknown): string {
  return normalizeString(value).replace(/\D+/g, "");
}

function getPhoneMatchCandidates(value: unknown): Set<string> {
  const digits = digitsOnly(value);
  const candidates = new Set<string>();

  if (!digits) {
    return candidates;
  }

  candidates.add(digits);

  if (digits.startsWith("00") && digits.length > 2) {
    candidates.add(digits.slice(2));
  }

  if (digits.startsWith("49") && digits.length > 2) {
    candidates.add(`0${digits.slice(2)}`);
  }

  if (digits.startsWith("0") && digits.length > 1) {
    candidates.add(`49${digits.slice(1)}`);
  }

  return candidates;
}

function isPhoneMatch(left: unknown, right: unknown): boolean {
  const leftCandidates = getPhoneMatchCandidates(left);
  if (leftCandidates.size === 0) {
    return false;
  }

  for (const candidate of getPhoneMatchCandidates(right)) {
    if (leftCandidates.has(candidate)) {
      return true;
    }
  }

  return false;
}

function findLeadByWhatsappPhone(phone: string): LeadRecord | undefined {
  return getAllLeads().find((lead) => isPhoneMatch(lead.phone, phone));
}

function buildLeadIdFromPhone(phone: string): string {
  const digits = digitsOnly(phone);
  return digits ? `whatsapp:${digits}` : `whatsapp:${crypto.randomUUID()}`;
}

function buildNewWhatsappLead(input: {
  leadId: string;
  phone: string;
  contactName?: string;
  campaignId: string;
}): LeadRecord {
  const now = Date.now();

  return {
    id: input.leadId,
    backendLeadId: input.leadId,
    name: normalizeString(input.contactName) || "WhatsApp Lead",
    phone: input.phone,
    source: "WhatsApp",
    campaignId: input.campaignId,
    tags: ["Neuer Lead"],
    stage: "ask_name",
    resumeStage: null,
    score: null,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "",
    isBotTyping: false,
    intent: "",
    readiness: "cold",
    bookingData: buildDefaultBookingData(),
    messages: [],
    lastActivityAt: now,
  };
}

export function syncWhatsappLead(
  input: SyncWhatsappLeadInput,
): WhatsappLeadSyncResult {
  const normalizedPhone = normalizeWhatsappPhone(input.from);
  const campaignId = DEFAULT_CAMPAIGN_ID;
  const existingLead = findLeadByWhatsappPhone(normalizedPhone);

  if (existingLead) {
    return {
      action: "found",
      lead: existingLead,
      normalizedPhone,
      campaignId: existingLead.campaignId || campaignId,
    };
  }

  let leadId = buildLeadIdFromPhone(normalizedPhone);
  if (getLeadById(leadId)) {
    leadId = `${leadId}:${Date.now()}`;
  }

  const createdLead = saveLead(
    buildNewWhatsappLead({
      leadId,
      phone: normalizedPhone,
      contactName: input.contactName,
      campaignId,
    }),
  );

  return {
    action: "created",
    lead: createdLead,
    normalizedPhone,
    campaignId,
  };
}
