import { getBackendCampaignId } from "../utils/dashboardHelpers";
import { findConversationMatchForContact } from "./inboxStateApi";

const FALLBACK_API_BASE_URL = "http://localhost:3001";

function getApiBaseUrl(apiBaseUrl) {
  return apiBaseUrl || FALLBACK_API_BASE_URL;
}

export function formatGhostingRows(previews) {
  return [...previews].sort((a, b) => {
    const score = (row) => {
      if (row.hasState && row.dueNow) return 100;
      if (row.hasState && row.active) return 80;
      if (row.hasState && row.isDead) return 20;
      if (row.hasState) return 40;
      return 0;
    };

    return score(b) - score(a);
  });
}

async function loadGhostingSchedules(apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/ghosting/schedule`);
  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "ghosting_schedule_load_failed");
  }

  return data.schedules || [];
}

async function loadConversationSummaries(apiBaseUrl) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/conversations`);
  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "ghosting_conversations_load_failed");
  }

  return data.conversations || [];
}

async function loadGhostingPreview({ apiBaseUrl, campaignId, leadId }) {
  const response = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/ghosting/preview/${campaignId}/${leadId}`,
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Preview fehlgeschlagen.");
  }

  return data;
}

function buildMissingConversationRow({ contact, campaign }) {
  return {
    contactId: contact.id,
    leadId: null,
    campaignId: getBackendCampaignId(contact.campaignId),
    campaignName: campaign?.name || contact.campaignId,
    name: contact.name || "(ohne Namen)",
    phone: contact.phone || "(keine Nummer)",
    hasState: false,
    active: false,
    dueNow: false,
    isDead: false,
    cycle: 0,
    stage: "-",
    nextDueAt: null,
    lastAssistantMessageAt: null,
    lastUserMessageAt: null,
    messagePreview: null,
    reason: "Kein passender Conversation State im Backend gefunden.",
  };
}

function buildPreviewErrorRow({
  contact,
  campaign,
  matchedConversation,
  previewData,
  error,
}) {
  return {
    contactId: contact.id,
    leadId: matchedConversation.leadId,
    campaignId: matchedConversation.campaignId,
    campaignName: campaign?.name || matchedConversation.campaignId,
    name: contact.name || matchedConversation.name || "(ohne Namen)",
    phone: contact.phone || matchedConversation.phone || "(keine Nummer)",
    hasState: false,
    active: false,
    dueNow: false,
    isDead: false,
    cycle: 0,
    stage: "-",
    nextDueAt: null,
    lastAssistantMessageAt:
      previewData?.lastAssistantMessageAt ??
      matchedConversation.lastAssistantMessageAt ??
      null,
    lastUserMessageAt:
      previewData?.lastUserMessageAt ??
      matchedConversation.lastUserMessageAt ??
      null,
    messagePreview: null,
    reason:
      previewData?.error ||
      (error instanceof Error ? error.message : "Unbekannter Preview-Fehler."),
  };
}

function buildPreviewSuccessRow({ contact, campaign, matchedConversation, previewData }) {
  return {
    contactId: contact.id,
    leadId: matchedConversation.leadId,
    campaignId: matchedConversation.campaignId,
    campaignName: campaign?.name || matchedConversation.campaignId,
    name: contact.name || matchedConversation.name || "(ohne Namen)",
    phone: contact.phone || matchedConversation.phone || "(keine Nummer)",
    hasState: true,
    active: !!previewData?.evaluation?.active,
    dueNow: !!previewData?.evaluation?.dueNow,
    isDead: !!previewData?.evaluation?.isDead,
    cycle: previewData?.evaluation?.cycle ?? 0,
    stage: previewData?.evaluation?.stage ?? "-",
    nextDueAt: previewData?.evaluation?.nextDueAt ?? null,
    lastAssistantMessageAt:
      previewData?.lastAssistantMessageAt ??
      matchedConversation.lastAssistantMessageAt ??
      null,
    lastUserMessageAt:
      previewData?.lastUserMessageAt ??
      matchedConversation.lastUserMessageAt ??
      null,
    messagePreview: previewData?.messagePreview ?? null,
    reason: previewData?.evaluation?.reason ?? "",
  };
}

export async function loadGhostingDataFromApi({
  apiBaseUrl,
  contacts = [],
  campaigns = [],
}) {
  const schedules = await loadGhostingSchedules(apiBaseUrl);
  const backendConversations = await loadConversationSummaries(apiBaseUrl);

  const previewResults = await Promise.all(
    contacts.map(async (contact) => {
      const campaign = campaigns.find((c) => c.id === contact.campaignId);
      const matchedConversation = findConversationMatchForContact(
        contact,
        backendConversations,
      );

      if (!matchedConversation) {
        return buildMissingConversationRow({ contact, campaign });
      }

      try {
        const previewData = await loadGhostingPreview({
          apiBaseUrl,
          campaignId: matchedConversation.campaignId,
          leadId: matchedConversation.leadId,
        });

        return buildPreviewSuccessRow({
          contact,
          campaign,
          matchedConversation,
          previewData,
        });
      } catch (error) {
        return buildPreviewErrorRow({
          contact,
          campaign,
          matchedConversation,
          previewData: null,
          error,
        });
      }
    }),
  );

  const rows = formatGhostingRows(previewResults);
  const matchedCount = rows.filter((row) => row.hasState).length;

  return {
    schedules,
    rows,
    matchedCount,
    totalCount: rows.length,
  };
}

function validateExecutableGhostingRow(row) {
  if (!row?.leadId || !row?.campaignId) {
    throw new Error("ghosting_missing_backend_ids");
  }

  if (!row?.hasState) {
    throw new Error("Kein passender Conversation State im Backend.");
  }

  if (row?.isDead) {
    throw new Error("Lead ist im Ghosting bereits als tot markiert.");
  }

  if (!row?.dueNow) {
    throw new Error("Aktuell ist noch keine Ghosting-Nachricht fällig.");
  }
}

export async function sendGhostingDueInApi({ apiBaseUrl, row, sendAt }) {
  validateExecutableGhostingRow(row);

  const response = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/ghosting/send-due/${row.campaignId}/${row.leadId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sendAt: sendAt || new Date().toISOString(),
      }),
    },
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "ghosting_send_failed");
  }

  return data;
}

export async function markGhostingSentInApi({ apiBaseUrl, row, sentAt }) {
  validateExecutableGhostingRow(row);

  const response = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/ghosting/mark-sent/${row.campaignId}/${row.leadId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sentAt: sentAt || new Date().toISOString(),
      }),
    },
  );

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "ghosting_mark_sent_failed");
  }

  return data;
}
