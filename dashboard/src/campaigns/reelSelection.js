// Pure UI validation for manually confirmed IG numeric media IDs.
// Never convert public Reel shortcodes/URLs to internal media IDs by guessing.
export const MAX_REEL_IDS = 40;
const MEDIA_ID_PATTERN = /^\d{8,32}$/;

export function parseReelMediaIds(text, already = []) {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return { ok: false, ids: [...already], error: "Bitte mindestens eine Reel-Media-ID eintragen." };
  const tokens = raw.split(/[\s,;]+/).map((id) => id.trim()).filter(Boolean);
  if (!tokens.every((id) => MEDIA_ID_PATTERN.test(id))) {
    return {
      ok: false, ids: [...already],
      error: "Nur bestätigte numerische Reel-Media-IDs mit 8 bis 32 Ziffern eingeben. Reel-Links können noch nicht automatisch aufgelöst werden.",
    };
  }
  const ids = [...new Set([...already, ...tokens])];
  if (ids.length > MAX_REEL_IDS) {
    return {
      ok: false, ids: [...already],
      error: "Maximal 40 einzelne Reels pro Kampagne auswählen.",
    };
  }
  return { ok: true, ids, error: "" };
}
