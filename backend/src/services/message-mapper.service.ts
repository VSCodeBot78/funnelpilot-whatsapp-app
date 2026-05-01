import { DEFAULT_CAMPAIGN_ID, getCampaignByTrigger } from "../config/campaigns.js";
import type {
  IncomingMessagePayload,
  MappedIncomingMessage,
} from "../types/types.js";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "").trim();
}

function buildLeadIdFromPhone(phone: string): string {
  const sanitized = sanitizePhone(phone);

  if (!sanitized) {
    return "";
  }

  return `phone:${sanitized}`;
}

function buildLeadIdFromExternalId(externalId: string): string {
  const cleaned = normalizeWhitespace(externalId);

  if (!cleaned) {
    return "";
  }

  return `ext:${cleaned}`;
}

function extractMessageText(payload: IncomingMessagePayload): string {
  const raw =
    payload.messageText ??
    payload.message ??
    payload.text ??
    "";

  return normalizeWhitespace(String(raw));
}

function extractCampaignId(payload: IncomingMessagePayload): string {
  const directCampaignId = normalizeWhitespace(String(payload.campaignId ?? ""));

  if (directCampaignId) {
    return directCampaignId;
  }

  const trigger = normalizeWhitespace(String(payload.trigger ?? ""));

  if (trigger) {
    return getCampaignByTrigger(trigger).id;
  }

  return DEFAULT_CAMPAIGN_ID;
}

function extractSource(payload: IncomingMessagePayload): string {
  const source =
    normalizeWhitespace(String(payload.source ?? "")) ||
    normalizeWhitespace(String(payload.channel ?? "")) ||
    normalizeWhitespace(String(payload.provider ?? ""));

  return source || "external";
}

function extractLeadId(payload: IncomingMessagePayload): {
  leadId: string;
  phone?: string;
  externalId?: string;
} {
  const directLeadId = normalizeWhitespace(String(payload.leadId ?? ""));
  if (directLeadId) {
    return {
      leadId: directLeadId,
    };
  }

  const phoneCandidate =
    normalizeWhitespace(String(payload.phone ?? "")) ||
    normalizeWhitespace(String(payload.from ?? ""));

  if (phoneCandidate) {
    const sanitizedPhone = sanitizePhone(phoneCandidate);
    const leadIdFromPhone = buildLeadIdFromPhone(sanitizedPhone);

    if (leadIdFromPhone) {
      return {
        leadId: leadIdFromPhone,
        phone: sanitizedPhone,
      };
    }
  }

  const externalId =
    normalizeWhitespace(String(payload.contactId ?? ""));

  if (externalId) {
    const leadIdFromExternal = buildLeadIdFromExternalId(externalId);

    if (leadIdFromExternal) {
      return {
        leadId: leadIdFromExternal,
        externalId,
      };
    }
  }

  return {
    leadId: "",
  };
}

export function mapIncomingMessagePayload(
  payload: IncomingMessagePayload,
): MappedIncomingMessage {
  const messageText = extractMessageText(payload);

  if (!messageText) {
    throw new Error("messageText fehlt oder ist leer.");
  }

  const campaignId = extractCampaignId(payload);
  const source = extractSource(payload);
  const leadData = extractLeadId(payload);

  if (!leadData.leadId) {
    throw new Error("leadId fehlt. Sende leadId, phone, from oder contactId mit.");
  }

  return {
    leadId: leadData.leadId,
    campaignId,
    messageText,
    source,
    externalId: leadData.externalId,
    phone: leadData.phone,
    metadata: payload.metadata,
  };
}
