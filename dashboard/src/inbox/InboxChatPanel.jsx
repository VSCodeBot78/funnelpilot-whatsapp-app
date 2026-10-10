import React from "react";
import { getLeadDisplayName } from "../utils/dashboardHelpers";
import {
  ghostButtonStyle,
  inputStyle,
  primaryButtonStyle,
} from "../theme/dashboardTheme";
import ChatTabs from "./ChatTabs";

function getBackendConnectionLabel(activeConversation) {
  if (!activeConversation) {
    return "Lokaler Frontend-Stand";
  }
  return "Echter Backend-State verbunden";
}

function getOutboundLabel(msg) {
  if (msg.role === "contact") {
    return "";
  }

  const actor = msg.actor === "human" ? "Jochen" : "Pete";

  if (msg.outboundStatus === "sent" || msg.sent === true) {
    return `${actor} · gesendet`;
  }

  if (msg.outboundStatus === "send_failed") {
    return `${actor} · Sendefehler`;
  }

  if (msg.outboundStatus === "dry_run" || msg.dryRun === true) {
    return `${actor} · nicht gesendet (Dry-run)`;
  }

  return actor;
}

export default function InboxChatPanel({
  colors,
  activeContact,
  activeContactId,
  activeConversation,
  openTabContacts = [],
  campaigns = [],
  newManualMessage,
  onNewManualMessageChange,
  onSendManualMessage,
  onTakeOverConversation,
  onReleaseConversation,
  onSetActiveContactId,
  onCloseChatTab,
}) {
  if (!activeContact) {
    return (
      <div
        style={{
          background: colors.panel,
          minHeight: 640,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.sub,
          height: "100%",
        }}
      >
        Kein Chat ausgewählt.
      </div>
    );
  }

  const owner = activeConversation?.owner || "ai";
  const aiPaused = activeConversation?.aiPaused === true;
  const humanOwned = owner === "human" || aiPaused;
  const stopped = activeConversation?.flags?.stopped === true;
  // A disconnected inbox must never display a fake locally "sent" message.
  const manualInputDisabled = !activeConversation;

  return (
    <div
      style={{
        background: colors.panel,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 640,
        height: "100%",
      }}
    >
      <ChatTabs
        colors={colors}
        contacts={openTabContacts}
        campaigns={campaigns}
        activeContactId={activeContactId}
        onSetActiveContactId={onSetActiveContactId}
        onCloseChatTab={onCloseChatTab}
      />

      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {getLeadDisplayName(activeContact)}
          </div>
          <div style={{ color: colors.sub, marginTop: 3, fontSize: 12 }}>
            {activeContact.phone} · {activeContact.source}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 8px",
                border: `1px solid ${colors.border}`,
                background: colors.panelSoft,
                fontSize: 11,
                fontWeight: 700,
                color: colors.text,
              }}
            >
              {getBackendConnectionLabel(activeConversation)}
            </span>

            <span
              style={{
                display: "inline-block",
                padding: "4px 8px",
                border: `1px solid ${colors.border}`,
                background: colors.panelSoft,
                fontSize: 11,
                color: colors.sub,
              }}
            >
              Funnel: {activeConversation?.currentStep || activeContact.stage || "-"}
            </span>

            {activeConversation ? (
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 8px",
                  border: `1px solid ${colors.border}`,
                  background: colors.panelSoft,
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.text,
                }}
              >
                Owner: {humanOwned ? "Jochen · KI pausiert" : "KI"}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {activeConversation ? (
            humanOwned ? (
              stopped ? (
                <span style={{ color: colors.warning, fontSize: 12, fontWeight: 700 }}>
                  STOP aktiv · Pete bleibt gesperrt
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onReleaseConversation}
                  className="fp-inbox-owner-action"
                  style={primaryButtonStyle(colors)}
                >
                  An Pete zurückgeben
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={onTakeOverConversation}
                className="fp-inbox-owner-action"
                style={ghostButtonStyle(colors)}
              >
                Pete pausieren · Übernehmen
              </button>
            )
          ) : null}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          background: colors.surface,
          padding: 18,
          overflow: "auto",
        }}
      >
        {(activeContact.messages || []).map((msg) => {
          const isContact = msg.role === "contact";
          const bubbleBackground = colors.bg === "#111111"
            ? isContact
              ? "#2a2d2e"
              : "#252526"
            : isContact
              ? "#0e639c"
              : "#e9ecef";
          const bubbleTextColor = colors.bg === "#111111"
            ? "#f3f3f3"
            : isContact
              ? "#ffffff"
              : "#1f1f1f";
          const metaTextColor = colors.bg === "#111111"
            ? "#9da1a6"
            : isContact
              ? "rgba(255,255,255,0.8)"
              : "#666666";

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: isContact ? "flex-end" : "flex-start",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: "72%",
                  background: bubbleBackground,
                  color: bubbleTextColor,
                  border: `1px solid ${colors.border}`,
                  padding: "10px 12px",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.45,
                  fontSize: 13,
                }}
              >
                {msg.text}
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: metaTextColor,
                    textAlign: "right",
                  }}
                >
                  {msg.time}
                  {getOutboundLabel(msg) ? ` · ${getOutboundLabel(msg)}` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          borderTop: `1px solid ${colors.border}`,
          padding: 12,
          display: "flex",
          gap: 8,
          background: colors.panel,
          flexDirection: "column",
        }}
      >
        <div
          style={{ fontSize: 12, color: colors.sub, lineHeight: 1.5 }}
        >
          {activeConversation
            ? "Manuelle Nachricht pausiert Pete. Im Testmodus bleibt sie ungesendet und im Eingabefeld."
            : "Kein bestätigter Backend-Chat. Manuelle Nachrichten sind gesperrt, bis der Status geladen ist."}
        </div>

        <div className="fp-inbox-compose">
          <input
            value={newManualMessage}
            onChange={(e) => onNewManualMessageChange(e.target.value)}
            placeholder="Manuelle Nachricht eingeben..."
            disabled={manualInputDisabled}
            style={{
              ...inputStyle(colors),
              flex: 1,
              opacity: 1,
            }}
          />
          <button
            type="button"
            onClick={onSendManualMessage}
            disabled={manualInputDisabled}
            style={primaryButtonStyle(colors)}
          >
            Senden
          </button>
        </div>
      </div>
    </div>
  );
}
