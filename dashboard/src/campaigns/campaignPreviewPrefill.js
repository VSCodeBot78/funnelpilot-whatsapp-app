import { getNormalizedPeteCampaignConfig } from "../utils/dashboardHelpers.js";

// Prefills only an OWNER-initiated read-only preview. It never chooses a
// hypothetical Media ID or triggers a real incoming event.
export function getCampaignPreviewPrefill(savedCampaign) {
  if (!savedCampaign?.id) {
    return { ok: false, reason: "Bitte zuerst eine Kampagne speichern." };
  }
  const config = getNormalizedPeteCampaignConfig(savedCampaign);
  if (!config.sources.length) {
    return { ok: false, reason: "Bitte zuerst einen Einstiegskanal speichern." };
  }

  const source = config.sources[0];
  const messageText = source === "instagram_new_follower"
    ? "" : (config.keywords[0] || "Hallo");
  const mediaId = source === "instagram_reel_comment" &&
      config.reelTarget === "specific"
    ? (config.reelMediaIds[0] || "") : "";
  const needsMediaId = source === "instagram_reel_comment" && !mediaId;
  const notice = needsMediaId
    ? "Bitte eine bestätigte Reel-Media-ID ergänzen. Auch bei Alle Reels benötigt die Vorschau die Media-ID des Beispiel-Kommentars."
    : source === "instagram_new_follower"
      ? "Follower-Begrüßung ist nur manuell. Diese Vorschau löst keine Nachricht aus."
      : "Einstieg und Keyword aus deiner gespeicherten Kampagne übernommen. Zum Prüfen unten auf Simulieren klicken.";

  return { ok: true, source, messageText, mediaId, needsMediaId, notice };
}
