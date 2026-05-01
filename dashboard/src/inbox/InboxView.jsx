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
  loading = false,
  message = "",
  newManualMessage,
  onNewManualMessageChange,
  onOpenChat,
  onSendManualMessage,
  onSetActiveContactId,
  onCloseChatTab,
  onReloadInbox,
}) {
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
            Chatverlauf und Funnel-Status werden hier schrittweise an echte Backend-Conversations gekoppelt.
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 2.6fr) 300px",
          gap: 0,
          alignItems: "stretch",
          width: "100%",
          minHeight: "calc(100vh - 220px)",
          border: `1px solid ${colors.border}`,
          background: colors.panel,
        }}
      >
        <div
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
            onSetActiveContactId={onSetActiveContactId}
            onCloseChatTab={onCloseChatTab}
          />
        </div>

        <div
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
