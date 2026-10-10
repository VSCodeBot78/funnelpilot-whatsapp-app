import React, { useState } from "react";
import { filterInboxContacts, getInboxFilterCounts } from "./mobileInboxFilters";
import {
  formatRelativeMinutes,
  getCampaignById,
  getLastMessage,
  getLeadDisplayName,
  getLeadStatusLabel,
} from "../utils/dashboardHelpers";

export default function InboxLeadList({
  colors,
  contacts = [],
  campaigns = [],
  activeContactId,
  onOpenChat,
}) {
  const [filter, setFilter] = useState("all");
  const counts = getInboxFilterCounts(contacts);
  const visible = filterInboxContacts(contacts, filter);
  return (
    <div
      style={{
        background: colors.panel,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>Chats</div>
        <div style={{ color: colors.sub, fontSize: 11 }}>{contacts.length} Leads</div>
      </div>

      <div className="fp-inbox-priority-filters" role="group" aria-label="Lead-Filter">
        {[
          ["all", "Alle", counts.all],
          ["hot", "Heiß", counts.hot],
          ["human", "Übernommen", counts.human],
        ].map(([key, label, count]) => (
          <button type="button" key={key} aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            style={{
              background: filter === key ? colors.hover : colors.panel,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontWeight: filter === key ? 750 : 500,
            }}>
            {label} ({count})
          </button>
        ))}
      </div>
      <div
        style={{
          overflow: "auto",
          flex: 1,
        }}
      >
        {visible.length === 0 ? (
          <div style={{ padding: 15, fontSize: 12, color: colors.sub }}>
            {contacts.length === 0
              ? "Keine Leads geladen. Verbindung prüfen oder Inbox neu laden."
              : "Keine Leads mit diesem gespeicherten Status."}
          </div>
        ) : null}
        {visible.map((contact) => {
          const lastMessage = getLastMessage(contact);
          const isActive = activeContactId === contact.id;
          const campaign = getCampaignById(campaigns, contact.campaignId);

          return (
            <button
              key={contact.id}
              type="button"
              onClick={() => onOpenChat(contact.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderBottom: `1px solid ${colors.border}`,
                background: isActive ? colors.hover : "transparent",
                color: colors.text,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      marginBottom: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {getLeadDisplayName(contact)}
                  </div>
                  <div
                    style={{
                      color: colors.sub,
                      fontSize: 10,
                      marginBottom: 5,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {contact.phone}
                  </div>
                </div>

                <div style={{ color: colors.sub, fontSize: 10, whiteSpace: "nowrap" }}>
                  {formatRelativeMinutes(contact.lastActivityAt)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color:
                      contact.readiness === "hot"
                        ? colors.warning
                        : contact.readiness === "warm"
                          ? colors.success
                          : colors.sub,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {getLeadStatusLabel(contact)}
                </span>

                {campaign ? (
                  <span
                    style={{
                      fontSize: 9,
                      color: colors.sub,
                    }}
                  >
                    {campaign.name}
                  </span>
                ) : null}

                {contact.inboxOwner === "human" || contact.inboxAiPaused === true ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: colors.warning }}>
                    Jochen · Pete pausiert
                  </span>
                ) : null}

                {contact.backendStateConnected ? (
                  <span
                    style={{
                      fontSize: 9,
                      color: colors.text,
                      fontWeight: 700,
                    }}
                  >
                    Backend-State
                  </span>
                ) : null}
              </div>

              <div
                style={{
                  color: colors.sub,
                  fontSize: 10,
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  minHeight: 26,
                }}
              >
                {lastMessage?.text || "Noch keine Nachrichten"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
