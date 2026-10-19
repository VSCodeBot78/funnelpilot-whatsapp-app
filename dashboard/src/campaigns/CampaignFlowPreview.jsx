import React from "react";

// Plain-text mock chat. No href, fetch, send, model call, provider or timers.
// Inputs can be user-authored; React escapes them automatically.
export default function CampaignFlowPreview({ colors, config }) {
  const stepsEnabled = config.flowDraftEnabled === true;
  const showText = config.autoReplyEnabled === true;
  const showLink = config.linkEnabled === true;
  const showPete = config.peteHandoffEnabled === true;
  const showPublicReply = config.sources?.includes("instagram_reel_comment") &&
    config.commentReplyEnabled === true;
  const publicVariants = (config.commentReplyVariants || []).filter((v) => v.trim());
  const showOpeningButton = showText && config.openingDmButtonEnabled === true;
  const openingAlternatives = (config.openingDmVariants || []).filter((text) =>
    typeof text === "string" && text.trim());
  const anyStep = showPublicReply || showText || showLink || showPete;
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
        {showPublicReply && (
          <div className="fp-flow-chat-public-reply">
            <small>Öffentliche Antwort unter dem Reel (nur Entwurf)</small>
            <div>{publicVariants.length
              ? publicVariants.join(" / ")
              : "Bitte mindestens eine Antwortvariante ergänzen."}</div>
            <small>Alternative Antworten, nicht mehrere Sends pro Kommentar.</small>
          </div>
        )}
        {showText && (
          <div className="fp-flow-chat-bubble">
            <small>Erste DM als Entwurf</small>
            <div>{config.openingText?.trim() || "Antworttext fehlt noch."}</div>
            {openingAlternatives.length > 0 && <div style={{ borderTop: "1px solid rgba(255,255,255,.3)", paddingTop: 8 }}>
              <small>Alternative DM-Texte (nicht nacheinander versenden):</small>
              {openingAlternatives.map((message, i) =>
                <div key={i} style={{ paddingTop: 5 }}>Variante {i + 2}: {message}</div>)}
            </div>}
            {showOpeningButton && (
              <div className="fp-flow-chat-fake-button">
                {config.openingDmButtonLabel || "Buttontext fehlt noch."}
              </div>
            )}
          </div>
        )}
        {showOpeningButton && showLink && (
          <div className="fp-flow-chat-info">
            Nächster Schritt erst nach geplanter Button-Interaktion. Kein echter Klick möglich.
          </div>
        )}
        {showLink && (
          <div className="fp-flow-chat-bubble">
            <small>Separate DM mit Link (nur Entwurf)</small>
            {config.linkMessageText && <div>{config.linkMessageText}</div>}
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
