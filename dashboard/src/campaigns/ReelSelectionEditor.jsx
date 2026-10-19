import React, { useEffect, useState } from "react";
import { inputStyle, secondaryButtonStyle } from "../theme/dashboardTheme";
import { MAX_REEL_IDS, parseReelMediaIds } from "./reelSelection.js";

// Manual verified-ID fallback until a read-only, owner-authorized IG media
// catalog is available. No fetching, no fabricated thumbnails, no sending.
export default function ReelSelectionEditor({ colors, campaignId, reelMediaIds, onChange }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft("");
    setError("");
  }, [campaignId]);

  function addReels() {
    const result = parseReelMediaIds(draft, reelMediaIds);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(result.ids);
    setDraft("");
    setError("");
  }

  return (
    <section className="fp-reel-selector"
      aria-label="Einzelne Reels auswählen"
      style={{ border: `1px solid ${colors.border}`, padding: 14, marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
        Ausgewählte Reels ({reelMediaIds.length}/{MAX_REEL_IDS})
      </div>
      <p style={{ fontSize: 11, lineHeight: 1.5, color: colors.sub, marginTop: 0 }}>
        Hier kannst du mehrere bestätigte Reel-Media-IDs auswählen und einzeln entfernen.
        Eine automatische Medienübersicht mit Bildern folgt erst mit erlaubtem,
        lesendem Instagram-Zugriff. Ein Reel-Link ist nicht automatisch eine Media-ID.
      </p>
      {reelMediaIds.length ? (
        <div className="fp-reel-selected-list" role="list" aria-label="Ausgewählte Reel-Media-IDs">
          {reelMediaIds.map((id, index) => (
            <div role="listitem" className="fp-reel-selected-item"
              style={{ border: `1px solid ${colors.border}`, background: colors.surface }}
              key={id}>
              <div style={{ minWidth: 0 }}>
                <strong>Reel {index + 1}</strong>
                <span style={{ color: colors.sub, overflowWrap: "anywhere", fontSize: 11 }}>{id}</span>
              </div>
              <button type="button" style={secondaryButtonStyle(colors)}
                aria-label={`Reel-Media-ID ${id} entfernen`}
                onClick={() => {
                  onChange(reelMediaIds.filter((selected) => selected !== id));
                  setError("");
                }}>
                Entfernen
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div role="status" style={{ fontSize: 12, color: colors.warning || "#d9a441" }}>
          Noch kein Reel ausgewählt. Diese Kampagne trifft damit keine einzelnen Reels.
        </div>
      )}
      <label style={{ display: "block", marginTop: 14, fontSize: 12 }}>
        <strong>Reel-Media-IDs hinzufügen</strong>
        <textarea style={{ ...inputStyle(colors), marginTop: 6, minHeight: 66,
          resize: "vertical", width: "100%", boxSizing: "border-box" }}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(""); }}
          placeholder="Bestätigte Media-ID einfügen. Mehrere IDs mit Komma oder Zeilenumbruch trennen."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "fp-reel-selection-error" : undefined} />
      </label>
      {error && (
        <div id="fp-reel-selection-error" role="alert"
          style={{ color: colors.warning || "#d9a441", fontSize: 12, marginTop: 5 }}>
          {error}
        </div>
      )}
      <button type="button" onClick={addReels}
        disabled={!draft.trim() || reelMediaIds.length >= MAX_REEL_IDS}
        style={{ ...secondaryButtonStyle(colors), marginTop: 10 }}>
        + Reel zur Auswahl hinzufügen
      </button>
      <p style={{ color: colors.sub, fontSize: 11, marginBottom: 0 }}>
        Auswahl ist zunächst nur eine gespeicherte Entwurfs-Konfiguration.
        Kein Instagram-/WhatsApp-Versand.
      </p>
    </section>
  );
}
