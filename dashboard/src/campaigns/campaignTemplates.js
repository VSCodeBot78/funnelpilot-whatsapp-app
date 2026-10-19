import { getNormalizedPeteCampaignConfig } from "../utils/dashboardHelpers.js";

// Editable examples, not globally activated Automations or SaaS defaults.
// Start with every execution-style toggle OFF, even when an example text exists.
export const CAMPAIGN_STARTER_TEMPLATES = Object.freeze([
  { id: "blank", label: "Leer starten", description: "Vollständig selbst gestalten",
    name: "Neue Kampagne", sources: [], keywords: [], openingText: "" },
  { id: "ig_dm", label: "Instagram-DM mit Keyword", description: "Zum Beispiel CHECK",
    name: "Instagram-DM · CHECK", sources: ["instagram_dm"], keywords: ["CHECK"],
    openingText: "Hey, danke für deine Nachricht. Schön, dass du dich meldest." },
  { id: "ig_reel", label: "Reel-Kommentar mit Keyword", description: "Alle oder ausgewählte Reels",
    name: "Reel-Kommentar · BULLSHIT", sources: ["instagram_reel_comment"], keywords: ["BULLSHIT"],
    openingText: "Hey, danke für deinen Kommentar. Schön, dass du dich meldest." },
  { id: "ig_story", label: "Story-Antwort mit Keyword", description: "Zum Beispiel KETO",
    name: "Story-Antwort · KETO", sources: ["instagram_story_reply"], keywords: ["KETO"],
    openingText: "Hey, danke für deine Antwort auf meine Story." },
  { id: "wa_dm", label: "WhatsApp mit Keyword", description: "Nachricht oder Anzeige",
    name: "WhatsApp · START", sources: ["whatsapp_dm", "whatsapp_ctwa"], keywords: ["START"],
    openingText: "Hey, danke für deine Nachricht. Was interessiert dich besonders?" },
  { id: "follower_manual", label: "Follower-Begrüßung (manuell)", description: "Kein automatisches Anschreiben",
    name: "Follower-Begrüßung · Manuell", sources: ["instagram_new_follower"], keywords: [],
    openingText: "Hey, schön, dass du da bist." },
]);

export function applyCampaignStarterTemplate(baseCampaign, templateId) {
  const preset = CAMPAIGN_STARTER_TEMPLATES.find((item) => item.id === templateId);
  if (!preset) throw new Error("unknown_campaign_template");
  const peteCampaign = getNormalizedPeteCampaignConfig({ peteCampaign: {
    sources: [...preset.sources], keywords: [...preset.keywords],
    openingText: preset.openingText,
    flowDraftEnabled: false, autoReplyEnabled: false,
    linkEnabled: false, linkLabel: "", linkUrl: "",
    peteHandoffEnabled: false, followUpEnabled: false,
    reelTarget: "all", reelMediaIds: [],
  } });
  return {
    ...baseCampaign,
    name: preset.name,
    peteCampaign,
    // No extra legacy scripted question-chain is introduced.
    welcome: "", q1: "", q2: "", q3: "", goal: "", scale: "", hot: "",
    followUp24h: "", followUp3d: "",
  };
}
