import { getNormalizedPeteCampaignConfig } from "../utils/dashboardHelpers.js";

// Pure, local dashboard search. No backend calls or automatic messaging.
export const CAMPAIGN_FILTER_OPTIONS = [
  { id: "all", label: "Alle Kampagnen" },
  { id: "draft_on", label: "Flow vorbereitet" },
  { id: "draft_off", label: "Flow pausiert" },
];

export function filterCampaignDirectory(campaigns, search = "", filter = "all") {
  if (!Array.isArray(campaigns)) return [];
  const query = typeof search === "string" ? search.trim().toLocaleLowerCase("de-DE") : "";
  return campaigns.filter((campaign) => {
    const flow = getNormalizedPeteCampaignConfig(campaign);
    if (filter === "draft_on" && !flow.flowDraftEnabled) return false;
    if (filter === "draft_off" && flow.flowDraftEnabled) return false;
    if (filter !== "all" && filter !== "draft_on" && filter !== "draft_off") return false;
    if (!query) return true;
    const searchable = [
      typeof campaign.name === "string" ? campaign.name : "",
      ...flow.keywords,
    ].join(" ").toLocaleLowerCase("de-DE");
    return searchable.includes(query);
  });
}
