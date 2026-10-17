import { getNormalizedPeteCampaignConfig, PETE_CAMPAIGN_SOURCES } from "../utils/dashboardHelpers.js";

// Synthetic-only, in-browser UI demonstration. Never imports a provider, Pete
// runtime, contact storage or backend. Do not promote this matcher to production.
export const DEMO_CAMPAIGNS = [
  {
    id: "demo-check", name: "Elterncheck Demo", trigger: "CHECK",
    useGlobalBookingDefaults: false,
    peteCampaign: {
      sources: ["instagram_dm", "instagram_reel_comment", "instagram_story_reply"],
      keywords: ["CHECK"],
      openingText: "Hey, schön, dass du den Elterncheck ausprobieren möchtest.",
      followUpEnabled: false, reelTarget: "all", reelMediaIds: [],
    },
    offerContext: { infoLink1Enabled: false, infoLink2Enabled: false,
      infoLink3Enabled: false, infoLink4Enabled: false,
      infoLink1Url: "", infoLink2Url: "", infoLink3Url: "", infoLink4Url: "" },
    booking: { provider: "manual", externalBookingUrl: "",
      starterCheckoutUrl: "", onboardingBookingUrl: "" },
    followUp24h: "", followUp3d: "",
  },
  {
    id: "demo-keto", name: "Keto Demo", trigger: "KETO",
    useGlobalBookingDefaults: false,
    peteCampaign: {
      sources: ["instagram_dm", "whatsapp_dm", "whatsapp_ctwa"],
      keywords: ["KETO"],
      openingText: "Hey, danke für deine Nachricht zum Thema Keto.",
      followUpEnabled: false, reelTarget: "all", reelMediaIds: [],
    },
    offerContext: { infoLink1Enabled: false, infoLink2Enabled: false,
      infoLink3Enabled: false, infoLink4Enabled: false,
      infoLink1Url: "", infoLink2Url: "", infoLink3Url: "", infoLink4Url: "" },
    booking: { provider: "manual", externalBookingUrl: "",
      starterCheckoutUrl: "", onboardingBookingUrl: "" },
    followUp24h: "", followUp3d: "",
  },
];

function empty(status) {
  return {
    mode: "preview_only", sendAllowed: false,
    status, matchedCampaignId: null, candidateIds: [],
    matchedKeyword: null, openingTextPreview: null,
    followUpDraftConfigured: false, draftContext: null,
  };
}
const normalizedKeyword = (text) =>
  text.trim().replace(/^#/, "").replace(/[.!?]+$/, "")
    .trim().toLocaleUpperCase("de-DE");
const isReelId = (id) => /^\d{8,32}$/.test(id);
const allowedSources = new Set(PETE_CAMPAIGN_SOURCES.map(([id]) => id));

export function simulateEntry(campaigns, { source, messageText, mediaId }) {
  if (!allowedSources.has(source)) return empty("invalid_source");
  if (typeof messageText !== "string" || messageText.length > 2000) {
    return empty("invalid_message");
  }
  const keyword = normalizedKeyword(messageText);
  const reelId = typeof mediaId === "string" ? mediaId.trim() : "";
  if (source === "instagram_reel_comment" && reelId && !isReelId(reelId)) {
    return empty("manual_review");
  }
  const possible = campaigns.map((campaign) => {
    const config = getNormalizedPeteCampaignConfig(campaign);
    if (!config.sources.includes(source)) return null;
    if (config.keywords.length && !config.keywords.includes(keyword)) return null;
    if (source === "instagram_reel_comment" && config.reelTarget === "specific" &&
      (!reelId || !config.reelMediaIds.includes(reelId))) return null;
    return { campaign, config, score: config.keywords.length ? 2 : 1 };
  }).filter(Boolean);
  if (source === "instagram_reel_comment" && !reelId &&
    campaigns.some((c) => {
      const p = getNormalizedPeteCampaignConfig(c);
      return p.sources.includes(source) &&
        (!p.keywords.length || p.keywords.includes(keyword));
    })) return empty("manual_review");
  if (!possible.length) return empty("no_match");
  const bestScore = Math.max(...possible.map((p) => p.score));
  const preferred = possible.filter((p) => p.score === bestScore);
  const uniqueIds = [...new Set(preferred.map((p) => p.campaign.id))];
  if (source === "instagram_new_follower") {
    return { ...empty("manual_only"), candidateIds: uniqueIds };
  }
  if (uniqueIds.length !== 1) {
    return { ...empty("ambiguous"), candidateIds: uniqueIds };
  }
  const { campaign, config } = preferred[0];
  const matchedKeyword = config.keywords.length ? keyword : null;
  const draftContext = {
    version: 1, mode: "preview_only", sendAllowed: false,
    campaignId: campaign.id, campaignName: String(campaign.name || "").slice(0, 120),
    source, matchedKeyword, openingText: config.openingText || null,
    followUpDraftConfigured: config.followUpEnabled,
    reelTarget: source === "instagram_reel_comment" ? config.reelTarget : null,
    reelMediaIds: source === "instagram_reel_comment" &&
      config.reelTarget === "specific" ? [...config.reelMediaIds] : [],
  };
  return {
    mode: "preview_only", sendAllowed: false, status: "matched",
    matchedCampaignId: campaign.id, candidateIds: uniqueIds, matchedKeyword,
    openingTextPreview: draftContext.openingText,
    followUpDraftConfigured: draftContext.followUpDraftConfigured, draftContext,
  };
}

function manualEvent(reason) {
  return { mode: "preview_only", sendAllowed: false,
    status: "manual_review", reason, source: null, mediaId: null };
}
export function simulateWebhook(campaigns, { channel, payload }) {
  let event = manualEvent("synthetic_only");
  if (channel === "instagram" && payload?.object === "instagram" &&
      Array.isArray(payload.entry) && payload.entry.length === 1) {
    const entry = payload.entry[0];
    const changes = entry?.changes;
    if (Array.isArray(changes) && changes.length === 1 &&
      changes[0]?.field === "comments") {
      const comment = changes[0].value;
      const id = comment?.media?.id;
      if (comment?.id && comment?.from?.id &&
        isReelId(id) && ["REELS", "REEL"].includes(comment.media.media_product_type) &&
        typeof comment.text === "string" && comment.text.trim()) {
        event = { mode: "preview_only", sendAllowed: false,
          status: "recognized", reason: "synthetic_reel_comment",
          source: "instagram_reel_comment", mediaId: id, messageText: comment.text };
      }
    } else if (Array.isArray(entry?.messaging) && entry.messaging.length === 1 &&
      !Array.isArray(changes)) {
      const msg = entry.messaging[0];
      if (msg?.sender?.id && msg?.message?.mid && !msg.message.is_echo &&
        typeof msg.message.text === "string" && msg.message.text.trim()) {
        event = { mode: "preview_only", sendAllowed: false,
          status: "recognized", reason: "synthetic_dm", source: "instagram_dm",
          mediaId: null, messageText: msg.message.text };
      }
    }
  } else if (channel === "whatsapp" &&
      payload?.object === "whatsapp_business_account" &&
      payload.entry?.length === 1 &&
      payload.entry[0]?.changes?.length === 1 &&
      payload.entry[0].changes[0]?.field === "messages") {
    const messages = payload.entry[0].changes[0]?.value?.messages;
    if (Array.isArray(messages) && messages.length === 1) {
      const message = messages[0];
      if (message?.id && message?.from && message?.type === "text" &&
        typeof message?.text?.body === "string" && message.text.body.trim()) {
        const referral = message.referral;
        const validAd = !referral || Boolean(referral?.ctwa_clid ||
          referral?.ad_id || referral?.source_type === "ad");
        if (validAd) {
          event = { mode: "preview_only", sendAllowed: false,
            status: "recognized", reason: "synthetic_whatsapp",
            source: referral ? "whatsapp_ctwa" : "whatsapp_dm",
            mediaId: null, messageText: message.text.body };
        }
      }
    }
  }
  const preview = event.status === "recognized"
    ? simulateEntry(campaigns, { source: event.source,
        messageText: event.messageText, mediaId: event.mediaId }) : null;
  return { ok: true, event, preview };
}
