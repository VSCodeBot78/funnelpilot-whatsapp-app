import {
  normalizePeteCampaignConfig,
  type CampaignRecord,
} from "../data/campaigns.store.js";

// Read-only campaign matching. No AI calls, Meta connections, lead mutation,
// scheduling or outbound sending are reachable from this module.
const ENTRY_SOURCES = [
  "instagram_dm", "instagram_reel_comment", "instagram_story_reply",
  "instagram_new_follower", "whatsapp_dm", "whatsapp_ctwa",
] as const;

export type CampaignEntrySource = typeof ENTRY_SOURCES[number];
export type CampaignPreviewInput = {
  source: unknown;
  messageText: unknown;
  mediaId?: unknown;
};
export type CampaignPreviewStatus =
  | "matched" | "no_match" | "ambiguous" | "manual_only"
  | "invalid_source" | "invalid_message" | "manual_review";

// Versioned, campaign-scoped data contract for the future Pete adapter.
// A preview is NOT an instruction to a model and grants no execution rights.
export type PeteCampaignDraftContext = {
  version: 1;
  mode: "preview_only";
  sendAllowed: false;
  campaignId: string;
  campaignName: string;
  source: CampaignEntrySource;
  matchedKeyword: string | null;
  openingText: string | null;
  followUpDraftConfigured: boolean;
  reelTarget: "all" | "specific" | null;
  reelMediaIds: string[];
  // Serialized config only. These steps are NEVER executed by preview.
  flowDraft: {
    enabled: boolean;
    autoReplyEnabled: boolean;
    text: string | null;
    linkEnabled: boolean;
    linkLabel: string;
    linkUrl: string | null;
    peteHandoffEnabled: boolean;
    commentReplyEnabled: boolean;
    commentReplyVariants: string[];
    openingDmVariants: string[];
    openingDmButtonEnabled: boolean;
    openingDmButtonLabel: string;
    linkMessageText: string;
    sendAllowed: false;
  };
};

export type CampaignEntryPreview = {
  mode: "preview_only";
  sendAllowed: false;
  status: CampaignPreviewStatus;
  matchedCampaignId: string | null;
  candidateIds: string[];
  matchedKeyword: string | null;
  openingTextPreview: string | null;
  followUpDraftConfigured: boolean;
  draftContext: PeteCampaignDraftContext | null;
};

const normalizeKeyword = (text: string): string =>
  text.trim().replace(/^#/, "").replace(/[.!?]+$/, "").trim()
    .toLocaleUpperCase("de-DE");

const emptyResult = (status: CampaignPreviewStatus): CampaignEntryPreview => ({
  mode: "preview_only",
  sendAllowed: false,
  status,
  matchedCampaignId: null,
  candidateIds: [],
  matchedKeyword: null,
  openingTextPreview: null,
  followUpDraftConfigured: false,
  draftContext: null,
});

export function evaluateCampaignEntryPreview(
  campaigns: readonly CampaignRecord[],
  input: CampaignPreviewInput,
): CampaignEntryPreview {
  if (typeof input.source !== "string" ||
      !ENTRY_SOURCES.includes(input.source as CampaignEntrySource)) {
    return emptyResult("invalid_source");
  }
  if (typeof input.messageText !== "string" || input.messageText.length > 2000) {
    return emptyResult("invalid_message");
  }

  const source = input.source as CampaignEntrySource;
  const keyword = normalizeKeyword(input.messageText);
  const mediaId = typeof input.mediaId === "string" ? input.mediaId.trim() : "";
  if (source === "instagram_reel_comment" && mediaId && !/^\d{8,32}$/.test(mediaId)) {
    return emptyResult("manual_review");
  }
  const candidates = campaigns.map(campaign => {
    const config = normalizePeteCampaignConfig(campaign.peteCampaign);
    if (!config.sources.includes(source)) return null;
    if (config.keywords.length > 0) {
      if (!keyword || !config.keywords.includes(keyword)) return null;
      if (source === "instagram_reel_comment" && config.reelTarget === "specific" &&
          (!mediaId || !config.reelMediaIds.includes(mediaId))) return null;
      return { campaign, config, score: 2, matchedKeyword: keyword };
    }
    if (source === "instagram_reel_comment" && config.reelTarget === "specific" &&
        (!mediaId || !config.reelMediaIds.includes(mediaId))) return null;
    return { campaign, config, score: 1, matchedKeyword: null };
  }).filter((candidate): candidate is NonNullable<typeof candidate> =>
    candidate !== null);

  if (source === "instagram_reel_comment" && !mediaId) {
    const possibleWithoutMediaId = campaigns.some(campaign => {
      const config = normalizePeteCampaignConfig(campaign.peteCampaign);
      return config.sources.includes(source) &&
        (config.keywords.length === 0 || config.keywords.includes(keyword));
    });
    if (possibleWithoutMediaId) return emptyResult("manual_review");
  }
  if (candidates.length === 0) return emptyResult("no_match");
  // A Reel comment must carry a verified media identifier before a campaign
  // could eventually be considered for real trigger matching.
  if (source === "instagram_reel_comment" && !mediaId) {
    return emptyResult("manual_review");
  }
  const bestScore = Math.max(...candidates.map(candidate => candidate.score));
  const preferred = candidates.filter(candidate => candidate.score === bestScore);
  const unique = [...new Set(preferred.map(candidate => String(candidate.campaign.id)))];

  // A follower event is never permission to contact someone. It requires
  // a person to initiate the first DM regardless of keyword configuration.
  if (source === "instagram_new_follower") {
    return {
      ...emptyResult("manual_only"),
      candidateIds: unique,
    };
  }
  if (unique.length !== 1) {
    return { ...emptyResult("ambiguous"), candidateIds: unique };
  }

  const chosen = preferred[0];
  const draftContext: PeteCampaignDraftContext = {
    version: 1,
    mode: "preview_only",
    sendAllowed: false,
    campaignId: unique[0],
    campaignName: typeof chosen.campaign.name === "string"
      ? chosen.campaign.name.slice(0, 120) : "",
    source,
    matchedKeyword: chosen.matchedKeyword,
    openingText: chosen.config.openingText || null,
    followUpDraftConfigured: chosen.config.followUpEnabled,
    reelTarget: source === "instagram_reel_comment"
      ? chosen.config.reelTarget as "all" | "specific" : null,
    reelMediaIds: source === "instagram_reel_comment" &&
      chosen.config.reelTarget === "specific"
      ? [...chosen.config.reelMediaIds] : [],
    flowDraft: {
      enabled: chosen.config.flowDraftEnabled,
      autoReplyEnabled: chosen.config.autoReplyEnabled,
      text: chosen.config.autoReplyEnabled ? chosen.config.openingText || null : null,
      linkEnabled: chosen.config.linkEnabled,
      linkLabel: chosen.config.linkLabel,
      linkUrl: chosen.config.linkEnabled ? chosen.config.linkUrl || null : null,
      peteHandoffEnabled: chosen.config.peteHandoffEnabled,
      commentReplyEnabled: chosen.config.commentReplyEnabled,
      commentReplyVariants: [...chosen.config.commentReplyVariants],
      openingDmVariants: [...chosen.config.openingDmVariants],
      openingDmButtonEnabled: chosen.config.openingDmButtonEnabled,
      openingDmButtonLabel: chosen.config.openingDmButtonLabel,
      linkMessageText: chosen.config.linkMessageText,
      sendAllowed: false,
    },
  };
  return {
    mode: "preview_only",
    sendAllowed: false,
    status: "matched",
    matchedCampaignId: unique[0],
    candidateIds: unique,
    matchedKeyword: chosen.matchedKeyword,
    openingTextPreview: draftContext.openingText,
    // Saved setting means "draft prepared", NOT follow-up runtime enabled.
    followUpDraftConfigured: draftContext.followUpDraftConfigured,
    draftContext,
  };
}
