/**
 * Small ManyChat-inspired campaign entry configuration.
 * Intentionally a NON-EXECUTABLE draft until Meta permission and send-window
 * gates are wired and explicitly activated in a separate release.
 * This replaces the visual q1/q2/scale builder for AI-led conversations.
 */
export const AUTOMATION_TRIGGERS = Object.freeze([
  { key: "comments", label: "Kommentar unter Post oder Reel", hint: "Keyword in öffentlichem Kommentar" },
  { key: "storyReplies", label: "Antwort auf Instagram-Story", hint: "Reaktion oder Antwort auf Story" },
  { key: "directMessages", label: "Instagram-DM", hint: "Direkte Nachricht mit Keyword" },
  { key: "adClicks", label: "Instagram-Werbeanzeige", hint: "Aus Ads gestartetes Gespräch" },
  { key: "referrals", label: "Empfehlungslink", hint: "Nutzer kommt über einen markierten Link" },
]);

const triggers = Object.freeze({
  comments: false,
  storyReplies: false,
  directMessages: false,
  adClicks: false,
  referrals: false,
});

export const DEFAULT_AUTOMATION_DRAFT = Object.freeze({
  enabled: false,
  triggers,
  commentScope: "all",
  specificPostIds: "",
  keywords: "CHECK",
  publicReplyEnabled: true,
  publicReplies: [
    "Schau mal in deine DMs.",
    "Ich habe dir eine Nachricht vorbereitet.",
    "Die Infos findest du im Postfach.",
  ],
  openingMessageEnabled: true,
  openingMessage: "Du möchtest den kostenlosen Elterncheck? Soll ich dir den Link schicken?",
  confirmationLabel: "Schick mir den Check",
  resourceKey: "check",
  linkMessage: "Hier findest du den kostenlosen No Bullshit Elternfitness Check.",
  followupMode: "off",
  followupDelayHours: 24,
  followupText: "Hey, konntest du dir den Check schon anschauen?",
});

export function getDefaultAutomationDraft() {
  return {
    ...DEFAULT_AUTOMATION_DRAFT,
    triggers: { ...DEFAULT_AUTOMATION_DRAFT.triggers },
    publicReplies: [...DEFAULT_AUTOMATION_DRAFT.publicReplies],
  };
}

export function parseAutomationKeywords(input) {
  return [...new Set(String(input || "").split(",")
    .map(word => word.trim().toLocaleUpperCase("de-DE"))
    .filter(word => word.length > 0 && word.length <= 32))].slice(0, 12);
}

export function getNormalizedAutomationDraft(campaign) {
  const raw = campaign?.automationDraft && typeof campaign.automationDraft === "object"
    ? campaign.automationDraft : {};
  const base = getDefaultAutomationDraft();
  const sourceTriggers = raw.triggers && typeof raw.triggers === "object" ? raw.triggers : {};
  const normalizedTriggers = Object.fromEntries(
    AUTOMATION_TRIGGERS.map(({ key }) => [key, sourceTriggers[key] === true]),
  );
  const choices = {
    commentScope: ["all", "specific", "next"],
    resourceKey: ["check", "keto", "selfstarter", "none"],
    followupMode: ["off", "when_allowed"],
  };
  const str = (key, max = 1000) => typeof raw[key] === "string"
    ? raw[key].slice(0, max) : base[key];
  return {
    enabled: raw.enabled === true,
    triggers: normalizedTriggers,
    commentScope: choices.commentScope.includes(raw.commentScope) ? raw.commentScope : base.commentScope,
    specificPostIds: str("specificPostIds", 600),
    keywords: str("keywords", 300),
    publicReplyEnabled: raw.publicReplyEnabled !== false,
    publicReplies: Array.isArray(raw.publicReplies)
      ? raw.publicReplies.filter(v => typeof v === "string").slice(0, 6).map(v => v.slice(0, 220))
      : [...base.publicReplies],
    openingMessageEnabled: raw.openingMessageEnabled !== false,
    openingMessage: str("openingMessage", 800),
    confirmationLabel: str("confirmationLabel", 45),
    resourceKey: choices.resourceKey.includes(raw.resourceKey) ? raw.resourceKey : base.resourceKey,
    linkMessage: str("linkMessage", 800),
    followupMode: choices.followupMode.includes(raw.followupMode) ? raw.followupMode : base.followupMode,
    followupDelayHours: Math.min(24, Math.max(1, Number.isFinite(Number(raw.followupDelayHours))
      ? Math.round(Number(raw.followupDelayHours)) : 24)),
    followupText: str("followupText", 500),
  };
}
