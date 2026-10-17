import React from "react";

// Plain-text mock chat. No href, fetch, send, model call, provider or timers.
// Inputs can be user-authored; React escapes them automatically.
export default function CampaignFlowPreview({ colors, config }) {
  const stepsEnabled = config.flowDraftEnabled === true;
  const showText = config.autoReplyEnabled === true;
  const showLink = config.linkEnabled === true;
  const showPete = config.peteHandoffEnabled === true;
  const anyStep = showText || showLink || showPete;
  return (
    <aside className="fp-flow-chat-preview" aria-label="Nachrichtenablauf als Chat-Vorschau"
      style={{ border: `1px solid ${colors.border}`, background: colors.panel }}>
      <div className="fp-flow-chat-heading">
        <strong>So sieht dein Ablauf aus</strong>
        <span>VORSCHAU · KEIN LIVE-VERSAND</span>
      </div>
      <div className="fp-flow-chat-content">
        <div className="fp-flow-chat-info">
          <strong>Auslöser:</strong> {config.keywords?.length
            ? config.keywords.join(", ") : "noch kein Keyword"}
          {" · "}{config.sources?.length || 0} Eingangskanal/Kanäle
        </div>
        {!stepsEnabled && <div className="fp-flow-chat-info">
          Entwurfsschalter ist aus. Die folgenden Schritte sind nicht aktiviert.
        </div>}
        {showText && (
          <div className="fp-flow-chat-bubble">
            <small>Feste Antwort als Entwurf</small>
            <div>{config.openingText?.trim() || "Antworttext fehlt noch."}</div>
          </div>
        )}
        {showLink && (
          <div className="fp-flow-chat-bubble">
            <small>Link als Entwurf</small>
            <strong>{config.linkLabel || "Link öffnen"}</strong>
            <div className="fp-flow-chat-url">
              {config.linkUrl || "Gültiger HTTPS-Link fehlt noch."}
            </div>
          </div>
        )}
        {showPete && (
          <div className="fp-flow-chat-handoff">
            Pete übernimmt danach optional. Keine KI-Antwort in dieser Vorschau.
          </div>
        )}
        {!anyStep && (
          <div className="fp-flow-chat-info">
            Noch keine feste Nachricht, kein Link und keine Pete-Übergabe ausgewählt.
          </div>
        )}
      </div>
    </aside>
  );
}
