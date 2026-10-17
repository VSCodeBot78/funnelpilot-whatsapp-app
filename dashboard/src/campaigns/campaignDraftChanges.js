import {
  getNormalizedBookingConfig,
  getNormalizedEntryConfig,
  getNormalizedOfferContext,
  getNormalizedPeteCampaignConfig,
} from "../utils/dashboardHelpers.js";

// Compare editable values, not object identity or UI-only typing fields.
// Backend provider defaults are compared to the latest loaded baseline.
export function getCampaignDraftChanges(current, baseline, settings = {}) {
  if (!current || !baseline || current.id !== baseline.id) return false;
  const pick = (campaign) => ({
    name: campaign.name || "",
    trigger: campaign.trigger || "",
    useGlobalBookingDefaults: campaign.useGlobalBookingDefaults === true,
    peteCampaign: getNormalizedPeteCampaignConfig(campaign),
    offerContext: getNormalizedOfferContext(campaign),
    entryConfig: getNormalizedEntryConfig(campaign),
    booking: getNormalizedBookingConfig(campaign, settings),
    followUp24h: campaign.followUp24h || "",
    followUp3d: campaign.followUp3d || "",
    // Legacy fields remain editable in some dashboard sections.
    welcome: campaign.welcome || "",
    q1: campaign.q1 || "",
    q2: campaign.q2 || "",
    q3: campaign.q3 || "",
    goal: campaign.goal || "",
    scale: campaign.scale || "",
    hot: campaign.hot || "",
  });
  return JSON.stringify(pick(current)) !== JSON.stringify(pick(baseline));
}
