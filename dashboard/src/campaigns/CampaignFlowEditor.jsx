import React from "react";
import DraftToggle from "./DraftToggle.jsx";
import CampaignFlowPreview from "./CampaignFlowPreview.jsx";
import InfoHint from "../components/layout/common/InfoHint.jsx";
import { getFlowDraftWarnings } from "./flowDraftReadiness.js";
import { inputStyle } from "../theme/dashboardTheme";
import "./campaignFlowEditor.css";

// ManyChat-inspired linear composition, but not a copy of its interface.
// Configuration only: the send engine never imports or executes this component.
export default function CampaignFlowEditor({
  colors, config, onChange,
}) {
  const notConfigured = !config.sources.length || !config.keywords.length;
  const warnings = getFlowDraftWarnings(config);
  const publicVariants = Array.isArray(config.commentReplyVariants) ? config.commentReplyVariants : [];
  const dmAlternatives = Array.isArray(config.openingDmVariants) ? config.openingDmVariants : [];
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
      {config.sources.includes("instagram_reel_comment") && (
        <>
          <div className="fp-flow-arrow" aria-hidden="true">↓</div>
          <div className="fp-flow-step" style={cardStyle}>
            <div className="fp-flow-step-heading">
              {stepLabel("2", "Öffentlich unter dem Reel antworten")}
              <InfoHint title="Öffentliche Kommentarantwort"
                text="Drei Textfelder als Start, bis zu zehn frei editierbare öffentliche Kommentarantworten. Der Entwurf verschickt keine Nachrichten." />
            </div>
            <DraftToggle colors={colors}
              checked={checked("commentReplyEnabled")}
              label="Öffentliche Kommentarantwort vorbereiten"
              hint="Optional. Antwortvarianten werden vor einer DM vorgesehen."
              onChange={toggle("commentReplyEnabled")} />
            {checked("commentReplyEnabled") && <>
              <small style={{ color: colors.sub }}>Alternative Formulierungen. Pro Kommentar später nur eine Antwort, nicht alle auf einmal.</small>
              {Array.from({ length: Math.max(3, publicVariants.length) }, (_, i) => (
                <div className="fp-flow-field" key={i}>
                  <label htmlFor={`fp-public-variant-${i}`}><strong>Antwortvariante {i + 1}</strong></label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input id={`fp-public-variant-${i}`} maxLength={220}
                      style={{ ...inputStyle(colors), flex: "1 1 230px", minWidth: 0 }}
                      value={publicVariants[i] || ""}
                      onChange={(event) => {
                        const next = Array.from({ length: Math.max(3, publicVariants.length) },
                          (_, j) => publicVariants[j] || "");
                        next[i] = event.target.value;
                        onChange("commentReplyVariants", next);
                      }}
                      placeholder={i === 0 ? "Danke dir! Schau mal in deine DMs." : "Weitere Formulierung (optional)"} />
                    {i >= 3 && <button type="button"
                      onClick={() => onChange("commentReplyVariants",
                        publicVariants.filter((_, j) => j !== i))}>Entfernen</button>}
                  </div>
                </div>
              ))}
              {Math.max(3, publicVariants.length) < 10 && (
                <button type="button" onClick={() => onChange("commentReplyVariants", [
                  ...Array.from({ length: Math.max(3, publicVariants.length) },
                    (_, j) => publicVariants[j] || ""), "",
                ])}>Weitere Kommentarvariante hinzufügen</button>
              )}
            </>}
          </div>
        </>
      )}
      <div className="fp-flow-arrow" aria-hidden="true">↓</div>
      <div className="fp-flow-step" style={cardStyle}>
        {stepLabel("3", "Erste DM / Feste Nachricht")}
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
        {checked("autoReplyEnabled") && <>
          <div className="fp-flow-step-heading">
            <strong>Alternative erste DMs</strong>
            <InfoHint title="DM-Textvarianten"
              text="Der Text darüber bleibt die erste Variante. Zwei alternative Eingaben stehen bereit. Weitere bis zu insgesamt zehn Varianten sind möglich. Eine spätere Auswahl darf nur eine DM senden; noch ist alles ein Entwurf." />
          </div>
          <small style={{ color: colors.sub }}>Verschiedene Formulierungen für unterschiedliche Kontakte. Keine zusätzlichen DMs pro Kontakt.</small>
          {Array.from({ length: Math.max(2, dmAlternatives.length) }, (_, i) => (
            <div className="fp-flow-field" key={i}>
              <label htmlFor={`fp-dm-alternative-${i}`}><strong>Alternative DM {i + 2}</strong></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <textarea id={`fp-dm-alternative-${i}`} maxLength={1000}
                  style={{ ...inputStyle(colors), minWidth: 0, flex: "1 1 230px", minHeight: 65, resize: "vertical" }}
                  value={dmAlternatives[i] || ""}
                  onChange={(event) => {
                    const next = Array.from({ length: Math.max(2, dmAlternatives.length) },
                      (_, j) => dmAlternatives[j] || "");
                    next[i] = event.target.value;
                    onChange("openingDmVariants", next);
                  }}
                  placeholder="Andere persönliche Begrüßung (optional)" />
                {i >= 2 && <button type="button"
                  onClick={() => onChange("openingDmVariants",
                    dmAlternatives.filter((_, j) => j !== i))}>Entfernen</button>}
              </div>
            </div>
          ))}
          {Math.max(2, dmAlternatives.length) < 9 && (
            <button type="button" onClick={() => onChange("openingDmVariants", [
              ...Array.from({ length: Math.max(2, dmAlternatives.length) },
                (_, j) => dmAlternatives[j] || ""), "",
            ])}>Weitere DM-Variante hinzufügen</button>
          )}
        </>}
        {checked("autoReplyEnabled") && !config.openingText.trim() &&
          <small role="status" style={{ color: colors.warning || "#d9a441" }}>
            Es fehlt noch dein Antworttext.
          </small>}
        {checked("autoReplyEnabled") && <>
          <div className="fp-flow-step-heading">
            <strong>Button in der ersten DM</strong>
            <InfoHint title="DM-Button"
              text="Der Empfänger soll aktiv auf einen Button antworten können. Erst nach dieser Interaktion wäre ein nächster Schritt geplant. Die aktuelle Vorschau löst keinen Klick aus." />
          </div>
          <DraftToggle colors={colors} checked={checked("openingDmButtonEnabled")}
            label="Antwort-Button vorbereiten"
            hint="Beispiel: Ja, zeig mir das Bundle"
            onChange={toggle("openingDmButtonEnabled")} />
          {checked("openingDmButtonEnabled") && (
            <label className="fp-flow-field">
              <strong>Beschriftung des Antwort-Buttons</strong>
              <input style={inputStyle(colors)} maxLength={80}
                value={config.openingDmButtonLabelDraft ?? config.openingDmButtonLabel ?? ""}
                onChange={(e) => onChange("openingDmButtonLabel", e.target.value)}
                placeholder="Ja, zeig mir das Bundle" />
            </label>
          )}
        </>}
      </div>
      <div className="fp-flow-arrow" aria-hidden="true">↓</div>
      <div className="fp-flow-step" style={cardStyle}>
        {stepLabel("4", "DM mit Link (optional)")}
        <DraftToggle colors={colors}
          checked={checked("linkEnabled")}
          label="Link nach der Antwort vorbereiten"
          hint="Beispielsweise Elterncheck, Anleitung oder ein Angebot."
          onChange={toggle("linkEnabled")} />
        {checked("linkEnabled") && <>
          <div className="fp-flow-step-heading">
            <strong>Nachricht mit Link</strong>
            <InfoHint title="Link nach Button oder Einstieg"
              text="Der Link ist eine separate Nachrichtenstufe. Ist der Antwort-Button eingeschaltet, kommt diese Stufe im geplanten Ablauf nach dem Button-Klick. Ohne Button ist keine Klick-Bedingung eingerichtet. Alles noch ohne Meta-Versand." />
          </div>
          <label className="fp-flow-field">
            <strong>Nachrichtentext vor dem Link</strong>
            <textarea style={{ ...inputStyle(colors), minHeight: 90, resize: "vertical" }}
              value={config.linkMessageText || ""}
              maxLength={1000}
              onChange={(e) => onChange("linkMessageText", e.target.value)}
              placeholder="Perfekt. Hier findest du alle Informationen zum Bundle." />
          </label>
          <label className="fp-flow-field">
            <strong>Link-Button</strong>
            <input style={inputStyle(colors)} maxLength={120}
              value={config.linkLabelDraft ?? config.linkLabel}
              onChange={(e) => onChange("linkLabel", e.target.value)}
              placeholder="Zum Elterncheck" />
          </label>
          <label className="fp-flow-field">
            <strong>HTTPS-Link</strong>
            <input style={inputStyle(colors)} type="url"
              value={config.linkUrlDraft ?? config.linkUrl}
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
        {stepLabel("5", "Übergabe an Pete (optional)")}
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
      <CampaignFlowPreview colors={colors} config={config} />
      <div className="fp-flow-footer" role="status" style={{
        border: `1px solid ${colors.border}`, color: colors.sub,
      }}>
        <strong>{checked("flowDraftEnabled") ? "Ablaufentwurf vorbereitet" : "Ablaufentwurf pausiert"}</strong>
        {checked("flowDraftEnabled") && (
          warnings.length
            ? <div className="fp-flow-warnings" role="status">
                <strong>Vor dem späteren Aktivieren noch prüfen:</strong>
                <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            : <span>Konfiguration vollständig als Entwurf. Noch nicht live.</span>
        )}
        <span>Zum Übernehmen oben bzw. unten „Kampagne speichern“ klicken.</span>
        <span>Diese Schalter geben niemals den Live-Versand frei.</span>
      </div>
    </section>
  );
}
