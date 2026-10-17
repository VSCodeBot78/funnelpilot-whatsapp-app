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
  if (JSON.stringify(pick(current)) !== JSON.stringify(pick(baseline))) return true;

  // A half-typed HTTPS link or keyword is not yet a valid persisted value.
  // Do not silently discard such work when switching campaigns. The usual
  // normalized comparison above intentionally strips these UI-only fields.
  const transient = current.peteCampaign || {};
  const savedFlow = getNormalizedPeteCampaignConfig(baseline);
  const drafts = [
    ["_keywordDraft", savedFlow.keywords.join(", ")],
    ["_linkUrlDraft", savedFlow.linkUrl],
    ["_reelMediaDraft", savedFlow.reelMediaIds.join(", ")],
  ];
  return drafts.some(([key, lastSaved]) =>
    typeof transient[key] === "string" &&
    transient[key].trim() !== lastSaved.trim());
}
