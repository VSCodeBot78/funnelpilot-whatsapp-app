import React from "react";
import { ghostButtonStyle } from "../theme/dashboardTheme";
import InboxLeadList from "./InboxLeadList";
import InboxChatPanel from "./InboxChatPanel";
import InboxContextPanel from "./InboxContextPanel";

export default function InboxView({
  colors,
  contacts = [],
  campaigns = [],
  activeContact,
  activeContactId,
  openTabContacts = [],
  activeContactBooking = {},
  activeConversation = null,
  mobilePane = "list",
  onMobilePaneChange = () => {},
  loading = false,
  message = "",
  newManualMessage,
  onNewManualMessageChange,
  onOpenChat,
  onSendManualMessage,
  onTakeOverConversation,
  onReleaseConversation,
  onSetActiveContactId,
  onCloseChatTab,
  onReloadInbox,
}) {
  const showConversation = Boolean(activeContact);
  const stopped = activeConversation?.flags?.stopped === true;
  const confirmRelease = () => {
    if (stopped) return;
    if (typeof window !== "undefined" && !window.confirm(
      "Chat wirklich an Pete zurückgeben? Pete darf nur antworten, wenn alle weiteren Freigaben aktiv sind."
    )) return;
    onReleaseConversation?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          padding: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Inbox</div>
          <div style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
            Gespräche ansehen, übernehmen und bei Bedarf wieder an Pete zurückgeben.
          </div>
        </div>

        <button type="button" onClick={onReloadInbox} style={ghostButtonStyle(colors)}>
          {loading ? "Lädt..." : "Inbox neu laden"}
        </button>
      </div>

      {message ? (
        <div
          style={{
            background: colors.panelSoft,
            border: `1px solid ${colors.border}`,
            padding: 12,
            fontSize: 12,
            color: colors.text,
          }}
        >
          {message}
        </div>
      ) : null}

      <nav className="fp-mobile-inbox-nav" aria-label="Mobile Inbox-Ansicht">
        {[
          { key: "list", label: "Chats" },
          { key: "chat", label: "Unterhaltung" },
          { key: "context", label: "Infos" },
        ].map(({ key, label }) => (
          <button key={key} type="button"
            aria-pressed={mobilePane === key}
            disabled={key !== "list" && !showConversation}
            onClick={() => onMobilePaneChange(key)}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 9,
              color: colors.text,
              background: mobilePane === key ? colors.hover : colors.panel,
              fontWeight: mobilePane === key ? 750 : 500,
            }}>
            {label}
          </button>
        ))}
      </nav>

      <div
        className="fp-inbox-grid"
        data-mobile-pane={mobilePane}
        style={{
          display: "grid",
          gap: 0,
          alignItems: "stretch",
          width: "100%",
          minHeight: "calc(100vh - 220px)",
          border: `1px solid ${colors.border}`,
          background: colors.panel,
        }}
      >
        <div
          className="fp-inbox-lead-column"
          style={{
            minWidth: 0,
            borderRight: `1px solid ${colors.border}`,
          }}
        >
          <InboxLeadList
            colors={colors}
            contacts={contacts}
            campaigns={campaigns}
            activeContactId={activeContactId}
            onOpenChat={onOpenChat}
          />
        </div>

        <div
          className="fp-inbox-chat-column"
          style={{
            minWidth: 0,
            borderRight: `1px solid ${colors.border}`,
          }}
        >
          <InboxChatPanel
            colors={colors}
            activeContact={activeContact}
            activeContactId={activeContactId}
            activeConversation={activeConversation}
            openTabContacts={openTabContacts}
            campaigns={campaigns}
            newManualMessage={newManualMessage}
            onNewManualMessageChange={onNewManualMessageChange}
            onSendManualMessage={onSendManualMessage}
            onTakeOverConversation={onTakeOverConversation}
            onReleaseConversation={confirmRelease}
            onSetActiveContactId={onSetActiveContactId}
            onCloseChatTab={onCloseChatTab}
          />
        </div>

        <div
          className="fp-inbox-context-column"
          style={{
            minWidth: 0,
          }}
        >
          <InboxContextPanel
            colors={colors}
            activeContact={activeContact}
            activeConversation={activeConversation}
            campaigns={campaigns}
            activeContactBooking={activeContactBooking}
          />
        </div>
      </div>
    </div>
  );
}
