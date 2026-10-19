import { getNormalizedPeteCampaignConfig } from "../utils/dashboardHelpers.js";

// Validate only ephemeral text that would otherwise be silently stripped on
// persistence. An incomplete draft may have empty steps intentionally.
export function getCampaignSaveInputError(campaign) {
  const raw = campaign?.peteCampaign || {};
  if (typeof raw._keywordDraft === "string") {
    const pieces = raw._keywordDraft.split(/[,;\n]/).map((part) => part.trim());
    if (pieces.some((word) => word && !/^[A-ZÄÖÜ0-9_-]{1,32}$/i.test(word))) {
      return "Keyword enthält ungültige Zeichen oder mehr als 32 Zeichen. Bitte korrigieren, bevor du speicherst.";
    }
    const normalized = getNormalizedPeteCampaignConfig(campaign);
    if (pieces.filter(Boolean).length > 20 ||
        normalized.keywords.length !== new Set(pieces.filter(Boolean).map((x) => x.toUpperCase())).size) {
      return "Bitte maximal 20 eindeutige gültige Keywords hinterlegen.";
    }
  }
  if (typeof raw._linkUrlDraft === "string" && raw._linkUrlDraft.trim()) {
    const normalized = getNormalizedPeteCampaignConfig(campaign);
    if (!normalized.linkUrl) {
      return "HTTPS-Link ist noch unvollständig oder ungültig. Bitte korrigieren oder das Feld leeren.";
    }
  }
  return null;
}
