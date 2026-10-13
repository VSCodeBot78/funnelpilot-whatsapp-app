/**
 * Draft configuration for a compact ManyChat-like Instagram campaign entry.
 * Saving this structure MUST NOT send a comment, DM or follow-up. Execution
 * requires a separate reviewed Meta adapter and its independent send gates.
 */
export const AUTOMATION_TRIGGER_KEYS = [
  "post_reel_comment",
  "story_reply",
  "instagram_message",
  "post_reel_share",
  "instagram_ad",
  "referral_url",
] as const;

export type CampaignAutomationTrigger = typeof AUTOMATION_TRIGGER_KEYS[number];
export type CampaignAutomationTriggerFlags = Record<CampaignAutomationTrigger, boolean>;
export type CampaignAutomationConfig = {
  enabled: boolean;
  triggers: CampaignAutomationTriggerFlags;
  commentScope: "any" | "specific" | "next";
  specificMediaIds: string[];
  keywordMode: "specific" | "any";
  keywords: string[];
  publicCommentReplyEnabled: boolean;
  publicCommentReplies: string[];
  openingDmText: string;
  confirmationButtonText: string;
  resourceLinkSlot: "" | "infoLink1" | "infoLink2" | "infoLink3" | "infoLink4";
  linkDmText: string;
  followUpMode: "off" | "conditional";
  followUpAfterHours: 24;
  followUpDmText: string;
};

export const DEFAULT_CAMPAIGN_AUTOMATION: CampaignAutomationConfig = {
  enabled: false,
  triggers: {
    post_reel_comment: false,
    story_reply: false,
    instagram_message: false,
    post_reel_share: false,
    instagram_ad: false,
    referral_url: false,
  },
  commentScope: "any",
  specificMediaIds: [],
  keywordMode: "specific",
  keywords: [],
  publicCommentReplyEnabled: true,
  publicCommentReplies: [
    "Schau mal in deine Nachrichten.",
    "Ich habe dir eine DM vorbereitet.",
    "Die Infos findest du in deinem Postfach.",
  ],
  openingDmText: "Hey, soll ich dir den gewünschten Link schicken?",
  confirmationButtonText: "Ja, schick mir den Link",
  resourceLinkSlot: "",
  linkDmText: "Hier findest du den Link:",
  followUpMode: "off",
  followUpAfterHours: 24,
  followUpDmText: "Hey, konntest du dir die Infos schon anschauen?",
};

function short(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function textList(value: unknown, maxItems: number, maxTextLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => short(item, maxTextLength)).filter(Boolean))].slice(0, maxItems);
}

export function normalizeCampaignAutomation(input: unknown): CampaignAutomationConfig {
  const raw = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const rawTriggers = raw.triggers && typeof raw.triggers === "object" && !Array.isArray(raw.triggers)
    ? raw.triggers as Record<string, unknown>
    : {};
  const triggers = { ...DEFAULT_CAMPAIGN_AUTOMATION.triggers };
  for (const key of AUTOMATION_TRIGGER_KEYS) triggers[key] = rawTriggers[key] === true;

  const commentScope = ["any", "specific", "next"].includes(String(raw.commentScope))
    ? raw.commentScope as CampaignAutomationConfig["commentScope"] : "any";
  const keywordMode = raw.keywordMode === "any" ? "any" : "specific";
  const allowedSlots: CampaignAutomationConfig["resourceLinkSlot"][] =
    ["", "infoLink1", "infoLink2", "infoLink3", "infoLink4"];
  const requestedSlot = short(raw.resourceLinkSlot, 12) as CampaignAutomationConfig["resourceLinkSlot"];
  return {
    enabled: raw.enabled === true,
    triggers,
    commentScope,
    specificMediaIds: textList(raw.specificMediaIds, 30, 80),
    keywordMode,
    keywords: textList(raw.keywords, 15, 48).map(value => value.toLocaleUpperCase("de-DE")),
    publicCommentReplyEnabled: raw.publicCommentReplyEnabled !== false,
    publicCommentReplies: raw.publicCommentReplies === undefined
      ? [...DEFAULT_CAMPAIGN_AUTOMATION.publicCommentReplies]
      : textList(raw.publicCommentReplies, 6, 180),
    openingDmText: short(raw.openingDmText, 1000) || DEFAULT_CAMPAIGN_AUTOMATION.openingDmText,
    confirmationButtonText: short(raw.confirmationButtonText, 40) ||
      DEFAULT_CAMPAIGN_AUTOMATION.confirmationButtonText,
    resourceLinkSlot: allowedSlots.includes(requestedSlot) ? requestedSlot : "",
    linkDmText: short(raw.linkDmText, 1000) || DEFAULT_CAMPAIGN_AUTOMATION.linkDmText,
    followUpMode: raw.followUpMode === "conditional" ? "conditional" : "off",
    followUpAfterHours: 24,
    followUpDmText: short(raw.followUpDmText, 500) || DEFAULT_CAMPAIGN_AUTOMATION.followUpDmText,
  };
}
