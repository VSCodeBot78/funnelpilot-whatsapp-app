import { getPriorityScore } from "../utils/dashboardHelpers.js";
import {
  isHotInboxContact,
  isHumanOwnedInboxContact,
} from "../inbox/mobileInboxFilters.js";

export const STATUS_FILTERS = Object.freeze([
  { id: "all", label: "Alle Leads" },
  { id: "human", label: "Human Takeover" },
  { id: "hot", label: "Heiß markiert" },
  { id: "running", label: "Im Gespräch" },
  { id: "booked", label: "Termin markiert" },
  { id: "unknown", label: "Status fehlt" },
  { id: "excluded", label: "Ausgeschlossen" },
]);

// Strict identity join: a similar name/phone is NOT enough evidence to attach
// a private conversation to a lead. Existing campaign aliases are retained.
const CAMPAIGN_ALIASES = {
  fit: "eltern-vital-fit",
  reset: "dummy-kampagne",
  "mama-papa-kampagne": "eltern-vital-fit",
};
export function joinLeads(leads, summaries) {
  if (!Array.isArray(leads)) return [];
  return leads
    .filter((lead) => lead && lead.id != null)
    .map((lead) => {
      const campaignId = String(
        lead.backendCampaignId || lead.campaignId || "",
      );
      const backendCampaign = CAMPAIGN_ALIASES[campaignId] || campaignId;
      const matches = Array.isArray(summaries)
        ? summaries.filter(
            (state) =>
              state &&
              String(state.campaignId) === backendCampaign &&
              String(state.leadId) === String(lead.backendLeadId || lead.id),
          )
        : [];
      const conversation = matches.length === 1 ? matches[0] : null;
      return {
        ...lead,
        id: String(lead.id),
        tags: Array.isArray(lead.tags) ? lead.tags : [],
        backendStateConnected: !!conversation,
        inboxOwner: conversation?.owner,
        inboxAiPaused: conversation?.aiPaused,
        conversation,
      };
    });
}

export function leadStatus(lead) {
  if (lead.excluded)
    return { key: "excluded", label: "Ausgeschlossen", tone: "neutral" };
  if (isHumanOwnedInboxContact(lead))
    return { key: "human", label: "Human Takeover", tone: "purple" };
  if (hasBookingMark(lead))
    return { key: "booked", label: "Termin markiert", tone: "green" };
  if (isHotInboxContact(lead))
    return { key: "hot", label: "Heiß markiert", tone: "orange" };
  if (lead.tags?.includes("Gespräch läuft"))
    return { key: "running", label: "Im Gespräch", tone: "blue" };
  if (!lead.backendStateConnected)
    return { key: "unknown", label: "Status fehlt", tone: "neutral" };
  return { key: "known", label: "Gespräch vorhanden", tone: "neutral" };
}

export function ownership(lead) {
  if (!lead?.backendStateConnected) return "Nicht bestätigt";
  if (lead.inboxOwner === "human")
    return lead.inboxAiPaused === true
      ? "Mensch · Pete pausiert"
      : "Mensch zugeordnet";
  if (lead.inboxAiPaused === true)
    return "Pete pausiert · Zuständigkeit prüfen";
  if (lead.inboxOwner === "ai" && lead.inboxAiPaused === false)
    return "Pete zugeordnet · Ausführung ungeprüft";
  return "Nicht bestätigt";
}

export function hasBookingMark(lead) {
  const status = String(lead.bookingData?.status || "").toLowerCase();
  return (
    !["cancelled", "canceled"].includes(status) &&
    (lead.booked === true || status === "booked")
  );
}

export function priorityReason(lead) {
  if (isHumanOwnedInboxContact(lead))
    return lead.inboxOwner === "human"
      ? "Übernahme im Backend bestätigt"
      : "Pete-Pause im Backend bestätigt";
  if (isHotInboxContact(lead)) return "Im Lead als heiß markiert";
  if (lead.intent === "scheduling") return "Termininteresse hinterlegt";
  if (lead.tags?.includes("Gespräch läuft"))
    return "Als laufendes Gespräch markiert";
  return "Gespeicherte Lead-Priorität";
}

export function filterLeads(
  leads,
  {
    search = "",
    status = "all",
    source = "all",
    campaign = "all",
    sort = "priority",
  } = {},
) {
  const query = String(search).trim().toLocaleLowerCase("de-DE");
  const result = leads.filter((lead) => {
    const haystack = [
      lead.name,
      lead.phone,
      lead.source,
      lead.campaignId,
      lead.intent,
      ...lead.tags,
    ]
      .join(" ")
      .toLocaleLowerCase("de-DE");
    const matchesStatus =
      status === "all" ||
      (status === "human"
        ? isHumanOwnedInboxContact(lead)
        : status === "hot"
          ? isHotInboxContact(lead)
          : status === "booked"
            ? hasBookingMark(lead) && !lead.excluded
            : status === "running"
              ? lead.tags.includes("Gespräch läuft") && !lead.excluded
              : status === "unknown"
                ? !lead.backendStateConnected && !lead.excluded
                : leadStatus(lead).key === status);
    return (
      (!query || haystack.includes(query)) &&
      matchesStatus &&
      (source === "all" || lead.source === source) &&
      (campaign === "all" || String(lead.campaignId) === campaign)
    );
  });
  return result.sort((a, b) =>
    sort === "name"
      ? String(a.name || "").localeCompare(String(b.name || ""), "de")
      : sort === "recent"
        ? activityTime(b) - activityTime(a)
        : Number(isHumanOwnedInboxContact(b)) -
            Number(isHumanOwnedInboxContact(a)) ||
          getPriorityScore(b) - getPriorityScore(a) ||
          String(a.id).localeCompare(String(b.id)),
  );
}

function activityTime(lead) {
  const value = lead.conversation?.updatedAt || lead.lastActivityAt;
  const date = value == null ? NaN : new Date(value).getTime();
  return Number.isFinite(date) ? date : 0;
}
export function formatDate(value) {
  if (value == null || value === "") return "Nicht hinterlegt";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Nicht hinterlegt"
    : date.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      });
}

export function summaryMetrics(
  leads,
  { leadsAvailable, conversationsAvailable },
) {
  const usable = leads.filter((lead) => !lead.excluded && !lead.isDraft);
  return {
    total: leadsAvailable ? usable.length : null,
    hot: leadsAvailable ? usable.filter(isHotInboxContact).length : null,
    human:
      leadsAvailable && conversationsAvailable
        ? usable.filter(isHumanOwnedInboxContact).length
        : null,
    running: leadsAvailable
      ? usable.filter((lead) => lead.tags.includes("Gespräch läuft")).length
      : null,
  };
}
