import React from "react";
import {
  getCampaignById,
  getLeadDisplayName,
} from "../utils/dashboardHelpers";

export default function ChatTabs({
  colors,
  contacts = [],
  campaigns = [],
  activeContactId,
  onSetActiveContactId,
  onCloseChatTab,
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        overflowX: "auto",
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface,
      }}
    >
      {contacts.map((contact) => {
        const active = activeContactId === contact.id;
        const campaign = getCampaignById(campaigns, contact.campaignId);

        return (
          <button
            key={contact.id}
            type="button"
            onClick={() => onSetActiveContactId(contact.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 160,
              maxWidth: 240,
              padding: "9px 12px",
              border: "none",
              borderRight: `1px solid ${colors.border}`,
              background: active ? colors.activeTab : colors.panelSoft,
              color: colors.text,
              cursor: "pointer",
            }}
          >
            <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 12,
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
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {campaign?.name || "-"}
              </div>
            </div>

            <span
              onClick={(event) => onCloseChatTab(contact.id, event)}
              style={{
                fontWeight: 700,
                color: colors.sub,
                padding: "0 4px",
              }}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}