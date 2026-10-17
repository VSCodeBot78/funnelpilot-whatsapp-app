import React from "react";
import DraftToggle from "./DraftToggle.jsx";
import { inputStyle } from "../theme/dashboardTheme";
import "./campaignFlowEditor.css";

// ManyChat-inspired linear composition, but not a copy of its interface.
// Configuration only: the send engine never imports or executes this component.
export default function CampaignFlowEditor({
  colors, config, onChange,
}) {
  const notConfigured = !config.sources.length || !config.keywords.length;
  const checked = (key) => config[key] === true;
  const toggle = (key) => (next) => onChange(key, next);
  const cardStyle = {
    border: `1px solid ${colors.border}`,
    background: colors.panel,
    color: colors.text,
  };
  const stepLabel = (number, name) => (
    <div className="fp-flow-step-title">
      <span className="fp-flow-step-number">{number}</span>
      <strong>{name}</strong>
    </div>
  );
  return (
    <section className="fp-flow-builder" aria-label="Nachrichtenablauf entwerfen">
      <div className="fp-flow-header" style={cardStyle}>
        <div>
          <strong>Nachrichtenablauf</strong>
          <p style={{ color: colors.sub, margin: "6px 0 0", fontSize: 12 }}>
            Wie bei einem Flow-Builder: Auslöser, feste Antwort, Link, Pete.
            Alles bleibt ein Entwurf, bis die Live-Sicherheitsfreigabe erfolgt.
          </p>
        </div>
        <DraftToggle colors={colors} checked={checked("flowDraftEnabled")}
          label="Ablauf-Entwurf einschalten"
          hint="Schaltet nur die gespeicherte Konfiguration ein. Kein Live-Versand."
          onChange={toggle("flowDraftEnabled")} />
      </div>
      <div className="fp-flow-step" style={cardStyle}>
        {stepLabel("1", "Auslöser")}
        <p style={{ color: colors.sub, fontSize: 12, margin: 0 }}>
          {config.sources.length
            ? config.sources.length + " Eingangskanal/Kanäle ausgewählt"
            : "Noch keinen Einstiegskanal ausgewählt"}
          {" · "}
          {config.keywords.length
            ? "Keyword(s): " + config.keywords.join(", ")
            : "Noch kein Keyword hinterlegt"}
        </p>
        {notConfigured && <div role="status" style={{ color: colors.warning || "#d9a441",
          fontSize: 12, marginTop: 8 }}>
          Für automatische Keyword-Reaktionen bitte oben mindestens einen
          Eingangskanal und ein Keyword auswählen. Ein Follower braucht immer
          eine manuell gestartete erste Nachricht.
        </div>}
      </div>
      <div className="fp-flow-arrow" aria-hidden="true">↓</div>
      <div className="fp-flow-step" style={cardStyle}>
        {stepLabel("2", "Feste Nachricht")}
        <DraftToggle colors={colors}
          checked={checked("autoReplyEnabled")}
          label="Vorgefertigte Antwort verwenden"
          hint="Wird später vor Pete eingeplant. Noch nicht automatisch senden."
          onChange={toggle("autoReplyEnabled")} />
        <label className="fp-flow-field">
          <strong>Text deiner automatischen Antwort</strong>
          <textarea style={{ ...inputStyle(colors), minHeight: 95, resize: "vertical" }}
            value={config.openingText}
            onChange={(e) => onChange("openingText", e.target.value)}
            placeholder="Hey, danke für deinen Kommentar. Hier ist der versprochene Check."
            maxLength={1000} />
        </label>
        {checked("autoReplyEnabled") && !config.openingText.trim() &&
          <small role="status" style={{ color: colors.warning || "#d9a441" }}>
            Es fehlt noch dein Antworttext.
          </small>}
      </div>
      <div className="fp-flow-arrow" aria-hidden="true">↓</div>
      <div className="fp-flow-step" style={cardStyle}>
        {stepLabel("3", "Link oder Aktion (optional)")}
        <DraftToggle colors={colors}
          checked={checked("linkEnabled")}
          label="Link nach der Antwort vorbereiten"
          hint="Beispielsweise Elterncheck, Anleitung oder ein Angebot."
          onChange={toggle("linkEnabled")} />
        {checked("linkEnabled") && <>
          <label className="fp-flow-field">
            <strong>Link-Beschriftung</strong>
            <input style={inputStyle(colors)} maxLength={120}
              value={config.linkLabel}
              onChange={(e) => onChange("linkLabel", e.target.value)}
              placeholder="Zum Elterncheck" />
          </label>
          <label className="fp-flow-field">
            <strong>HTTPS-Link</strong>
            <input style={inputStyle(colors)} type="url"
              value={config.linkUrl}
              onChange={(e) => onChange("linkUrl", e.target.value)}
              placeholder="https://..." />
          </label>
          {!config.linkUrl && <small role="status" style={{ color: colors.warning || "#d9a441" }}>
            Ein gültiger HTTPS-Link fehlt noch. Der Editor speichert nur sichere HTTPS-Adressen.
          </small>}
        </>}
      </div>
      <div className="fp-flow-arrow" aria-hidden="true">↓</div>
      <div className="fp-flow-step" style={cardStyle}>
        {stepLabel("4", "Übergabe an Pete (optional)")}
        <DraftToggle colors={colors}
          checked={checked("peteHandoffEnabled")}
          label="Pete soll anschließend übernehmen"
          hint="Pete qualifiziert später frei und kontextbezogen, ohne A/B/C-Fragenbaum."
          onChange={toggle("peteHandoffEnabled")} />
        <p style={{ color: colors.sub, margin: "10px 0 0", fontSize: 11 }}>
          Keine Live-Verbindung, keine KI-Anfrage und keine automatische
          Nachricht. Human Takeover und Opt-out haben später Vorrang.
        </p>
      </div>
      <div className="fp-flow-footer" role="status" style={{
        border: `1px solid ${colors.border}`, color: colors.sub,
      }}>
        <strong>{checked("flowDraftEnabled") ? "Ablaufentwurf vorbereitet" : "Ablaufentwurf pausiert"}</strong>
        <span>Zum Übernehmen oben bzw. unten „Kampagne speichern“ klicken.</span>
        <span>Diese Schalter geben niemals den Live-Versand frei.</span>
      </div>
    </section>
  );
}
