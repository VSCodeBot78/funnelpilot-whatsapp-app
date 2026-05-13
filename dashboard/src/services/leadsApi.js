import { getDefaultBookingData } from "../utils/dashboardHelpers";
import { buildApiUrl } from "./apiBase";

export function normalizeLeadFromBackend(lead) {
  const bookingData = lead.bookingData
    ? {
        ...getDefaultBookingData(),
        ...lead.bookingData,
      }
    : getDefaultBookingData();
  const status = String(bookingData.status || "").trim().toLowerCase();
  const booked = !!lead.booked || status === "booked";
  bookingData.status = status || (booked ? "booked" : "inactive");
  bookingData.meetingType = bookingData.meetingType || "unknown";

  if (bookingData.status === "booked" && !bookingData.bookingProvider) {
    bookingData.bookingProvider = "manual";
  }

  return {
    id: String(lead.id),
    backendLeadId: lead.backendLeadId ? String(lead.backendLeadId) : String(lead.id),
    name: lead.name || "",
    phone: lead.phone || "",
    source: lead.source || "Instagram",
    campaignId: lead.campaignId || "fit",
    tags: Array.isArray(lead.tags) && lead.tags.length ? lead.tags : ["Neuer Lead"],
    stage: lead.stage || "",
    resumeStage:
      lead.resumeStage === undefined ? null : lead.resumeStage,
    score:
      lead.score === undefined || lead.score === "" ? null : lead.score,
    botEnabled: !!lead.botEnabled,
    excluded: !!lead.excluded,
    booked,
    note: lead.note || "",
    isBotTyping: !!lead.isBotTyping,
    intent: lead.intent || "",
    readiness: lead.readiness || "cold",
    bookingData,
    messages: Array.isArray(lead.messages) ? lead.messages : [],
    lastActivityAt:
      typeof lead.lastActivityAt === "number"
        ? lead.lastActivityAt
        : Date.now(),
  };
}

export function buildLeadPayload(contact) {
  return {
    id: String(contact.id),
    backendLeadId: String(contact.backendLeadId || contact.id),
    name: contact.name || "",
    phone: contact.phone || "",
    source: contact.source || "Instagram",
    campaignId: contact.campaignId || "fit",
    tags: Array.isArray(contact.tags) && contact.tags.length
      ? contact.tags
      : ["Neuer Lead"],
    stage: contact.stage || "",
    resumeStage:
      contact.resumeStage === undefined ? null : contact.resumeStage,
    score:
      contact.score === undefined || contact.score === "" ? null : contact.score,
    botEnabled: !!contact.botEnabled,
    excluded: !!contact.excluded,
    note: contact.note || "",
    isBotTyping: !!contact.isBotTyping,
    intent: contact.intent || "",
    readiness: contact.readiness || "cold",
    bookingData: {
      ...getDefaultBookingData(),
      ...(contact.bookingData || {}),
      status: contact.booked
        ? "booked"
        : String(contact.bookingData?.status || "").trim() || "inactive",
      meetingType:
        contact.bookingData?.meetingType || "unknown",
    },
    booked:
      !!contact.booked ||
      String(contact.bookingData?.status || "").trim().toLowerCase() === "booked",
    messages: Array.isArray(contact.messages) ? contact.messages : [],
    lastActivityAt:
      typeof contact.lastActivityAt === "number"
        ? contact.lastActivityAt
        : Date.now(),
  };
}

export async function loadLeadsFromApi(apiBaseUrl) {
  const response = await fetch(buildApiUrl("/leads", apiBaseUrl));
  const data = await response.json();

  if (!response.ok || !data?.ok || !Array.isArray(data?.leads)) {
    throw new Error(data?.error || "leads_load_failed");
  }

  return data.leads.map(normalizeLeadFromBackend);
}

export async function createLeadInApi(contact, apiBaseUrl) {
  const payload = buildLeadPayload(contact);

  const response = await fetch(buildApiUrl("/leads", apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.lead) {
    throw new Error(data?.error || "lead_create_failed");
  }

  return normalizeLeadFromBackend(data.lead);
}

export async function updateLeadInApi(contact, apiBaseUrl) {
  const payload = buildLeadPayload(contact);

  const response = await fetch(
    buildApiUrl(`/leads/${String(contact.id)}`, apiBaseUrl),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.lead) {
    throw new Error(data?.error || "lead_update_failed");
  }

  return normalizeLeadFromBackend(data.lead);
}

export async function deleteLeadInApi(leadId, apiBaseUrl) {
  const response = await fetch(
    buildApiUrl(`/leads/${String(leadId)}`, apiBaseUrl),
    {
      method: "DELETE",
    },
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "lead_delete_failed");
  }

  return true;
}
