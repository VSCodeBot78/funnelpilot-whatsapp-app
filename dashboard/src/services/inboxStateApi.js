import { buildApiUrl } from "./apiBase";

export function buildExpectedSeedLeadId(name) {
  const clean = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!clean) return "";
  return `lead_${clean}`;
}

export function normalizePhone(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\d+]/g, "")
    .trim();
}

export function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findConversationMatchForContact(contact, conversations) {
  const campaignMap = {
    fit: "mama-papa-kampagne",
    reset: "dummy-kampagne",
    "mama-papa-kampagne": "mama-papa-kampagne",
    "dummy-kampagne": "dummy-kampagne",
  };

  const backendCampaignId =
    campaignMap[
      String(contact.backendCampaignId || contact.campaignId || "").trim()
        .toLowerCase()
    ] || String(contact.backendCampaignId || contact.campaignId || "").trim();

  const contactBackendLeadId = String(contact.backendLeadId || "").trim();
  const contactLeadId = String(contact.id || "").trim();
  const expectedLeadId = buildExpectedSeedLeadId(contact.name);
  const contactPhone = normalizePhone(contact.phone);
  const contactName = normalizeName(contact.name);

  const normalizeEntryName = (entry) =>
    normalizeName(entry.leadName || entry.name || "");

  const matchesCampaign = (entry) =>
    String(entry.campaignId || "").trim() === backendCampaignId;

  const exactLeadIdMatch = (entryLeadId) =>
    String(entryLeadId || "").trim() !== "";

  const findByLeadId = (leadId) =>
    conversations.find(
      (entry) =>
        matchesCampaign(entry) &&
        exactLeadIdMatch(entry.leadId) &&
        String(entry.leadId).trim() === String(leadId).trim(),
    );

  if (backendCampaignId && contactBackendLeadId) {
    const match = findByLeadId(contactBackendLeadId);
    if (match) {
      return match;
    }
  }

  if (backendCampaignId && contactLeadId) {
    const match = findByLeadId(contactLeadId);
    if (match) {
      return match;
    }
  }

  if (backendCampaignId && expectedLeadId) {
    const match = findByLeadId(expectedLeadId);
    if (match) {
      return match;
    }
  }

  const phoneMatch = conversations.find((entry) => {
    if (!matchesCampaign(entry)) {
      return false;
    }

    const entryPhone = normalizePhone(entry.phone);
    return contactPhone && entryPhone && contactPhone === entryPhone;
  });

  if (phoneMatch) {
    return phoneMatch;
  }

  const nameMatch = conversations.find((entry) => {
    if (!matchesCampaign(entry)) {
      return false;
    }

    const entryName = normalizeEntryName(entry);
    return contactName && entryName && contactName === entryName;
  });

  return nameMatch || null;
}

function formatInboxMessageTime(value) {
  if (!value) {
    return new Date().toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mapConversationMessagesToInbox(messages = []) {
  return messages.map((msg, index) => ({
    id: msg.id || `${msg.role}_${msg.createdAt || index}`,
    role: msg.role === "user" ? "contact" : "bot",
    text: msg.text || "",
    time: formatInboxMessageTime(msg.createdAt),
    createdAt: msg.createdAt,
  }));
}

export async function loadConversationSummaries(apiBaseUrl) {
  const response = await fetch(buildApiUrl("/conversations", apiBaseUrl));
  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "conversations_load_failed");
  }

  return data.conversations || [];
}

export async function loadConversationStateDetail({
  apiBaseUrl,
  campaignId,
  leadId,
}) {
  const response = await fetch(
    buildApiUrl(`/conversations/${campaignId}/${leadId}`, apiBaseUrl),
  );

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.state) {
    throw new Error(data?.error || "conversation_state_detail_load_failed");
  }

  return data.state;
}

export async function loadInboxConversationMapForContacts({
  contacts = [],
  apiBaseUrl,
}) {
  const conversationSummaries = await loadConversationSummaries(apiBaseUrl);

  const matchedPairs = contacts
    .map((contact) => ({
      contact,
      match: findConversationMatchForContact(contact, conversationSummaries),
    }))
    .filter((entry) => !!entry.match);

  const detailEntries = await Promise.all(
    matchedPairs.map(async ({ contact, match }) => {
      try {
        const state = await loadConversationStateDetail({
          apiBaseUrl,
          campaignId: match.campaignId,
          leadId: match.leadId,
        });

        return [contact.id, state];
      } catch (error) {
        console.error("inbox state detail load error:", error);
        return [contact.id, null];
      }
    }),
  );

  const conversationMap = {};

  detailEntries.forEach(([contactId, state]) => {
    if (contactId && state) {
      conversationMap[contactId] = state;
    }
  });

  return {
    conversationMap,
    matchedCount: Object.keys(conversationMap).length,
    totalCount: contacts.length,
  };
}

const BACKEND_CONVERSATION_CAMPAIGN_MAP = {
  fit: "mama-papa-kampagne",
  reset: "dummy-kampagne",
  "eltern-vital-fit": "mama-papa-kampagne",
  "mama-papa-kampagne": "mama-papa-kampagne",
  "dummy-kampagne": "dummy-kampagne",
};

function mapToBackendConversationCampaignId(campaignId) {
  return (
    BACKEND_CONVERSATION_CAMPAIGN_MAP[String(campaignId || "").trim()] ||
    String(campaignId || "").trim()
  );
}

export async function ensureConversationStateInApi(
  contact,
  apiBaseUrl,
) {
  const bookingDataStatus = String(contact.bookingData?.status || "").trim().toLowerCase();
  const isCancelled = bookingDataStatus === "cancelled" || bookingDataStatus === "canceled";
  const booked = !isCancelled && (!!contact.booked || bookingDataStatus === "booked");
  const normalizedStatus = bookingDataStatus || (booked ? "booked" : "inactive");

  const payload = {
    leadId: String(contact.id),
    backendLeadId: String(contact.backendLeadId || contact.id),
    campaignId: mapToBackendConversationCampaignId(contact.campaignId),
    leadName: String(contact.name || "").trim(),
    phone: String(contact.phone || "").trim(),
    source: String(contact.source || "").trim(),
    note: String(contact.note || "").trim(),
    booked,
    bookingData: {
      ...contact.bookingData,
      status: normalizedStatus,
      meetingType: contact.bookingData?.meetingType || "unknown",
    },
  };

  const response = await fetch(buildApiUrl("/conversations/ensure", apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.ok || !data?.state) {
    throw new Error(data?.error || "conversation_ensure_failed");
  }

  return data.state;
}
