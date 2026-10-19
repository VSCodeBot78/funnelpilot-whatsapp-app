// Desktop-only draft validation. This is a UX checklist, not a runtime gate.
// A green checklist NEVER authorizes Pete, Meta, WhatsApp or outbound messages.
export function getFlowDraftWarnings(config) {
  if (!config || typeof config !== "object") return ["Kampagnenentwurf fehlt."];
  const warnings = [];
  const sources = Array.isArray(config.sources) ? config.sources : [];
  const keywords = Array.isArray(config.keywords) ? config.keywords : [];
  if (!sources.length) warnings.push("Mindestens einen Eingangskanal auswählen.");
  const autoSources = sources.filter((source) => source !== "instagram_new_follower");
  if (autoSources.length && !keywords.length) {
    warnings.push("Für die geplante Keyword-Automatik ein Keyword hinterlegen.");
  }
  if (sources.includes("instagram_reel_comment") && config.reelTarget === "specific" &&
      (!Array.isArray(config.reelMediaIds) || !config.reelMediaIds.length)) {
    warnings.push("Bei ausgewählten Reels mindestens eine Reel-Media-ID hinterlegen.");
  }
  if (sources.includes("instagram_reel_comment") && config.commentReplyEnabled &&
      !(config.commentReplyVariants || []).some((v) => typeof v === "string" && v.trim())) {
    warnings.push("Mindestens eine öffentliche Kommentarantwort hinterlegen.");
  }
  if (config.autoReplyEnabled && config.openingDmButtonEnabled &&
      !String(config.openingDmButtonLabel || "").trim()) {
    warnings.push("Beschriftung für den DM-Antwortbutton ergänzen.");
  }
  const normalizedReply = (value) => typeof value === "string"
    ? value.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ") : "";
  const duplicates = (values) => {
    const texts = values.map(normalizedReply).filter(Boolean);
    return new Set(texts).size !== texts.length;
  };
  if (config.commentReplyEnabled && duplicates(config.commentReplyVariants || [])) {
    warnings.push("Öffentliche Kommentarantworten enthalten doppelte Texte.");
  }
  if (config.autoReplyEnabled && duplicates([config.openingText, ...(config.openingDmVariants || [])])) {
    warnings.push("Erste DM und Alternativen enthalten doppelte Texte.");
  }
  if (config.autoReplyEnabled && !String(config.openingText || "").trim()) {
    warnings.push("Text für die feste Antwort ergänzen.");
  }
  if (config.linkEnabled && !config.linkUrl) {
    warnings.push("Gültigen HTTPS-Link hinterlegen.");
  }
  if (config.flowDraftEnabled && !config.autoReplyEnabled &&
      !config.linkEnabled && !config.peteHandoffEnabled) {
    warnings.push("Mindestens eine Aktion auswählen: Nachricht, Link oder Pete.");
  }
  if (config.flowDraftEnabled && !autoSources.length &&
      sources.includes("instagram_new_follower")) {
    warnings.push("Follower-Begrüßung: erste Nachricht bleibt immer manuell.");
  }
  return warnings;
}
