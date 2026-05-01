import React from "react";
import { hoursSince, getLeadDisplayName } from "../utils/dashboardHelpers";

export default function LeadList({
  colors,
  contacts = [],
  activeContactId,
  onSelectLead,
}) {
  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${colors.border}`,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        Leads
      </div>

      <div>
        {contacts.map((contact) => (
          <button
            key={contact.id}
            type="button"
            onClick={() => onSelectLead(contact.id)}
            style={{
              width: "100%",
              textAlign: "left",
              background:
                activeContactId === contact.id ? colors.hover : "transparent",
              border: "none",
              borderBottom: `1px solid ${colors.border}`,
              color: colors.text,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
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
                    fontSize: 11,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {contact.phone || "(keine Nummer)"}
                </div>
              </div>

              <div
                style={{
                  fontSize: 11,
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
                {contact.readiness || "cold"}
              </div>

              <div style={{ color: colors.sub, fontSize: 11 }}>
                vor {hoursSince(contact.lastActivityAt)}h
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
