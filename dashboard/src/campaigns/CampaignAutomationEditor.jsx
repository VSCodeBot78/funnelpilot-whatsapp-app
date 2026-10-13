import React from "react";
import { inputStyle } from "../theme/dashboardTheme";
import {
  AUTOMATION_TRIGGER_OPTIONS,
  getNormalizedCampaignAutomation,
} from "./campaignAutomationDraft";

const labelStyle = { display: "block", fontSize: 12, fontWeight: 650, marginBottom: 6 };
const space = { marginBottom: 15 };
const choices = { display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 };

export default function CampaignAutomationEditor({ colors, automation, offerContext, onChange }) {
  const value = getNormalizedCampaignAutomation(automation);
  const inputCss = inputStyle(colors);
  const update = patch => onChange({ ...value, ...patch });
  const updateTrigger = (key, enabled) =>
    update({ triggers: { ...value.triggers, [key]: enabled } });
  const updateVariant = (index, text) =>
    update({ publicCommentReplies: value.publicCommentReplies.map((item, i) => i === index ? text : item) });

  return (
    <div style={{ padding: 12, border: `1px solid ${colors.border}`, background: colors.panelSoft }}>
      <div style={{ fontWeight: 750, fontSize: 14, marginBottom: 5 }}>
        Mini-Automation für diese Kampagne
      </div>
      <div style={{ color: colors.sub, fontSize: 12, lineHeight: 1.55, marginBottom: 14 }}>
        Wie bei ManyChat, aber nur als kompakter Einstieg zu Pete: Auslöser,
        Keyword, Kommentarantwort, Bestätigungs-DM, Link und optionales Nachfassen.
        Mehrere Auslöser können gleichzeitig gewählt werden.
      </div>

      <div style={space}>
        <div style={labelStyle}>Auslöser (Mehrfachauswahl)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 9 }}>
          {AUTOMATION_TRIGGER_OPTIONS.map(([key, name]) => (
            <label key={key} style={{ display: "flex", gap: 9, alignItems: "center",
              border: `1px solid ${colors.border}`, background: colors.surface, padding: "8px 10px",
              fontSize: 12, cursor: "pointer", minHeight: 42 }}>
              <input type="checkbox" checked={value.triggers[key]}
                onChange={e => updateTrigger(key, e.target.checked)} />
              <span>{name}</span>
            </label>
          ))}
        </div>
      </div>

      {value.triggers.post_reel_comment ? (
        <div style={space}>
          <div style={labelStyle}>Welche Beiträge oder Reels?</div>
          <div style={choices}>
            {[["any", "Alle"], ["specific", "Bestimmte"], ["next", "Nächstes"]].map(([id, title]) => (
              <label key={id}><input type="radio" name="campaign-comment-scope"
                checked={value.commentScope === id}
                onChange={() => update({ commentScope: id })} /> {title}</label>
            ))}
          </div>
          {value.commentScope === "specific" ? (
            <>
              <div style={{ ...labelStyle, marginTop: 10 }}>Meta-Media-IDs (kommagetrennt)</div>
              <input style={inputCss} defaultValue={value.specificMediaIds.join(", ")}
                onBlur={e => update({ specificMediaIds: e.target.value.split(",").map(v => v.trim()) })} />
            </>
          ) : null}
        </div>
      ) : null}

      <div style={space}>
        <div style={labelStyle}>Keyword-Matching</div>
        <div style={choices}>
          <label><input type="radio" name="campaign-keyword-mode" checked={value.keywordMode === "specific"}
            onChange={() => update({ keywordMode: "specific" })} /> Bestimmte Wörter</label>
          <label><input type="radio" name="campaign-keyword-mode" checked={value.keywordMode === "any"}
            onChange={() => update({ keywordMode: "any" })} /> Alle Wörter</label>
        </div>
        {value.keywordMode === "specific" ? (
          <div style={{ marginTop: 9 }}>
            <input style={inputCss} placeholder="CHECK, KETO, BULLSHIT"
              defaultValue={value.keywords.join(", ")}
              onBlur={e => update({ keywords: e.target.value.split(",").map(v => v.trim()) })} />
            <div style={{ color: colors.sub, fontSize: 11, marginTop: 4 }}>
              Mehrere Keywords mit Komma trennen. Maximal 15.
            </div>
          </div>
        ) : null}
      </div>

      {value.triggers.post_reel_comment ? (
        <div style={space}>
          <label style={{ ...labelStyle, display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={value.publicCommentReplyEnabled}
              onChange={e => update({ publicCommentReplyEnabled: e.target.checked })} />
            Öffentliche Kommentarantworten nutzen
          </label>
          {value.publicCommentReplyEnabled ? (
            <>
              {value.publicCommentReplies.map((message, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 7 }}>
                  <input style={{ ...inputCss, flex: 1 }} value={message}
                    aria-label={`Kommentarantwort ${i + 1}`}
                    onChange={e => updateVariant(i, e.target.value)} />
                  <button type="button" aria-label={`Kommentarantwort ${i + 1} entfernen`}
                    style={{ border: `1px solid ${colors.border}`, background: colors.surface,
                      color: colors.text, cursor: "pointer", padding: "3px 9px" }}
                    onClick={() => update({ publicCommentReplies: value.publicCommentReplies.filter((_, x) => x !== i) })}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" disabled={value.publicCommentReplies.length >= 6}
                onClick={() => update({ publicCommentReplies: [...value.publicCommentReplies, ""] })}
                style={{ border: `1px solid ${colors.borderStrong}`, padding: "7px 10px",
                  background: colors.surface, color: colors.text, cursor: "pointer", fontSize: 12 }}>
                + Antwort hinzufügen (max. 6)
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div style={space}>
        <div style={labelStyle}>Private Einstiegsnachricht</div>
        <textarea style={{ ...inputCss, minHeight: 80, resize: "vertical" }}
          value={value.openingDmText} onChange={e => update({ openingDmText: e.target.value })} />
      </div>

      <div style={space}>
        <div style={labelStyle}>Bestätigungsaktion / Buttontext</div>
        <input style={inputCss} value={value.confirmationButtonText}
          onChange={e => update({ confirmationButtonText: e.target.value })} />
        <div style={{ color: colors.sub, fontSize: 11, marginTop: 4 }}>
          Ob ein nativer Button möglich ist, hängt vom Meta-Nachrichtentyp ab.
          Sonst muss Pete eine bestätigende Textantwort verstehen.
        </div>
      </div>

      <div style={space}>
        <div style={labelStyle}>Hinterlegter Info-Link</div>
        <select style={inputCss} value={value.resourceLinkSlot}
          onChange={e => update({ resourceLinkSlot: e.target.value })}>
          <option value="">Bitte Link auswählen</option>
          {[1, 2, 3, 4].map(i => (
            <option key={i} value={`infoLink${i}`}>
              {offerContext?.[`infoLink${i}Label`] || `Info-Link ${i}`}
            </option>
          ))}
        </select>
        <div style={{ color: colors.sub, fontSize: 11, marginTop: 4 }}>
          Der Link kommt aus dem geprüften Angebots- &amp; Info-Kontext, nicht aus einem erfundenen KI-Link.
        </div>
      </div>

      <div style={space}>
        <div style={labelStyle}>Nachricht zum ausgewählten Link</div>
        <textarea style={{ ...inputCss, minHeight: 64, resize: "vertical" }}
          value={value.linkDmText} onChange={e => update({ linkDmText: e.target.value })} />
      </div>

      <div style={space}>
        <div style={labelStyle}>Nachfassen</div>
        <div style={choices}>
          <label><input type="radio" name="campaign-followup" checked={value.followUpMode === "conditional"}
            onChange={() => update({ followUpMode: "conditional" })} />
            Einmal nach 24 Stunden, falls erlaubt und sinnvoll</label>
          <label><input type="radio" name="campaign-followup" checked={value.followUpMode === "off"}
            onChange={() => update({ followUpMode: "off" })} />
            Kein automatisches Nachfassen</label>
        </div>
        {value.followUpMode === "conditional" ? (
          <textarea style={{ ...inputCss, minHeight: 64, resize: "vertical", marginTop: 9 }}
            value={value.followUpDmText} onChange={e => update({ followUpDmText: e.target.value })} />
        ) : null}
        <div style={{ color: colors.sub, fontSize: 11, marginTop: 5 }}>
          Nur bei zulässigem Messaging-Fenster, ohne Opt-out, STOP oder menschliche Übernahme.
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 650, fontSize: 12 }}>
          <input type="checkbox" checked={value.enabled}
            onChange={e => update({ enabled: e.target.checked })} />
          Kampagne aktiviert (nach technischer Freigabe)
        </label>
        <div style={{ fontSize: 11, color: colors.sub, marginTop: 6 }}>
          Diese Version speichert nur einen Entwurf. Der Instagram-Versand ist nicht
          angeschlossen. Auch bei aktiviertem Haken findet kein Versand statt.
        </div>
      </div>
    </div>
  );
}
