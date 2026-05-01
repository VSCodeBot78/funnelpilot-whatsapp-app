import React from "react";
import {
  formatBookingSlot,
  formatRelativeMinutes,
  getCampaignById,
} from "../utils/dashboardHelpers";
import { ghostButtonStyle } from "../theme/dashboardTheme";

function getGhostingSummary(activeConversation) {
  if (!activeConversation?.ghosting) {
    return "kein Ghosting-State";
  }

  const ghosting = activeConversation.ghosting;

  if (ghosting.isDead) {
    return "Lead tot";
  }

  if (ghosting.stage === "inactive") {
    return `inaktiv · Zyklus ${ghosting.cycle || 0}`;
  }

  return `${ghosting.stage} · Zyklus ${ghosting.cycle || 0}`;
}

function getBookingSummary(activeConversation, activeContactBooking) {
  const bookingSlot = formatBookingSlot(activeContactBooking);
  const bookingStatus = String(
    activeContactBooking?.status || activeConversation?.providerBooking?.status || "",
  )
    .trim()
    .toLowerCase();
  const isCancelled = bookingStatus === "cancelled" || bookingStatus === "canceled";

  if (isCancelled) {
    return bookingSlot ? `storniert · ${bookingSlot}` : "storniert";
  }

  if (bookingSlot) {
    return `gebucht · ${bookingSlot}`;
  }

  if (activeConversation?.providerBooking?.status) {
    return activeConversation.providerBooking.status;
  }

  return "kein Termin gebucht";
}

export default function InboxContextPanel({
  colors,
  activeContact,
  activeConversation,
  campaigns = [],
  activeContactBooking = {},
}) {
  if (!activeContact) {
    return (
      <div
        style={{
          background: colors.panel,
          padding: 14,
          color: colors.sub,
          height: "100%",
        }}
      >
        Kein Lead ausgewählt.
      </div>
    );
  }

  const campaign = getCampaignById(campaigns, activeContact.campaignId);
  const conversationUpdatedAt = activeConversation?.updatedAt
    ? new Date(activeConversation.updatedAt).getTime()
    : activeContact.lastActivityAt;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        height: "100%",
        background: colors.panel,
      }}
    >
      <div>
        <div
          style={{
            padding: "12px 14px",
            borderBottom: `1px solid ${colors.border}`,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Lead-Kontext
        </div>
        <div style={{ padding: 14 }}>
          {[
            ["Backend-State", activeConversation ? "verbunden" : "nicht verbunden"],
            ["Readiness", activeContact.readiness || "-"],
            ["Funnel-Status", activeConversation?.currentStep || activeContact.stage || "-"],
            ["Letzte Aktivität", formatRelativeMinutes(conversationUpdatedAt)],
            ["Kampagne", campaign?.name || "-"],
            ["Quelle", activeContact.source || "-"],
            ["Ghosting", getGhostingSummary(activeConversation)],
            ["Termine", getBookingSummary(activeConversation, activeContactBooking)],
            ["Provider", activeConversation?.providerBooking?.provider || activeContactBooking.bookingProvider || "-"],
            ["Gebuchter Slot", formatBookingSlot(activeContactBooking) || "-"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr",
                gap: 10,
                padding: "8px 0",
                borderBottom: `1px solid ${colors.border}`,
                fontSize: 12,
              }}
            >
              <span style={{ color: colors.sub }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${colors.border}` }}>
        <div
          style={{
            padding: "12px 14px",
            borderBottom: `1px solid ${colors.border}`,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Notizen
        </div>
        <div style={{ padding: 14 }}>
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              padding: 12,
              color: activeContact.note ? colors.text : colors.sub,
              lineHeight: 1.5,
              fontSize: 12,
              minHeight: 80,
            }}
          >
            {activeContact.note || "Keine Notizen vorhanden"}
          </div>
          <button
            type="button"
            style={{ ...ghostButtonStyle(colors), width: "100%", marginTop: 10 }}
          >
            Notiz hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
