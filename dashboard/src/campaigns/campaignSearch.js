import { getNormalizedPeteCampaignConfig, PETE_CAMPAIGN_SOURCES } from "../utils/dashboardHelpers.js";

// Narrow, deterministic local filtering. No API, no tracking, no send triggers.
export function filterCampaigns(campaigns, query) {
  const needle = String(query || "").trim().toLocaleLowerCase("de-DE");
  if (!needle) return campaigns;
  return campaigns.filter((camp) => {
    const config = getNormalizedPeteCampaignConfig(camp);
    const sourceNames = PETE_CAMPAIGN_SOURCES
      .filter(([id]) => config.sources.includes(id))
      .map(([, label]) => label);
    const searchable = [camp.name, ...config.keywords, ...sourceNames]
      .filter((value) => typeof value === "string")
      .join(" ").toLocaleLowerCase("de-DE");
    return searchable.includes(needle);
  });
}
