// Editor-only companion to the backend draft schema.
// Never interprets 'enabled' as permission to send Meta messages.
export const AUTOMATION_TRIGGER_OPTIONS = [
  ["post_reel_comment", "Kommentar zu Beitrag/Reel"],
  ["story_reply", "Story-Antwort"],
  ["instagram_message", "Instagram-Nachricht"],
  ["post_reel_share", "Beitrag/Reel in Story geteilt"],
  ["instagram_ad", "Instagram-Anzeige"],
  ["referral_url", "Instagram Referral-Link"],
];

export function getDefaultCampaignAutomation() {
  return {
    enabled: false,
    triggers: Object.fromEntries(AUTOMATION_TRIGGER_OPTIONS.map(([key]) => [key, false])),
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
}
const isRecord = input => Boolean(input && typeof input === "object" && !Array.isArray(input));
const text = (value, n) => typeof value === "string" ? value.trim().slice(0, n) : "";
const values = (raw, limit, n) => Array.isArray(raw)
  ? [...new Set(raw.map(x => text(x, n)).filter(Boolean))].slice(0, limit) : [];

export function getNormalizedCampaignAutomation(raw) {
  const fallback = getDefaultCampaignAutomation();
  const input = isRecord(raw) ? raw : {};
  const triggers = isRecord(input.triggers) ? input.triggers : {};
  return {
    enabled: input.enabled === true,
    triggers: Object.fromEntries(AUTOMATION_TRIGGER_OPTIONS.map(([key]) => [key, triggers[key] === true])),
    commentScope: ["any", "specific", "next"].includes(input.commentScope) ? input.commentScope : "any",
    specificMediaIds: values(input.specificMediaIds, 30, 80),
    keywordMode: input.keywordMode === "any" ? "any" : "specific",
    keywords: values(input.keywords, 15, 48).map(x => x.toLocaleUpperCase("de-DE")),
    publicCommentReplyEnabled: input.publicCommentReplyEnabled !== false,
    publicCommentReplies: input.publicCommentReplies === undefined ? fallback.publicCommentReplies
      : values(input.publicCommentReplies, 6, 180),
    openingDmText: text(input.openingDmText, 1000) || fallback.openingDmText,
    confirmationButtonText: text(input.confirmationButtonText, 40) || fallback.confirmationButtonText,
    resourceLinkSlot: ["", "infoLink1", "infoLink2", "infoLink3", "infoLink4"].includes(input.resourceLinkSlot)
      ? input.resourceLinkSlot : "",
    linkDmText: text(input.linkDmText, 1000) || fallback.linkDmText,
    followUpMode: input.followUpMode === "conditional" ? "conditional" : "off",
    followUpAfterHours: 24,
    followUpDmText: text(input.followUpDmText, 500) || fallback.followUpDmText,
  };
}
