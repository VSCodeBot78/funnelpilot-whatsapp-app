import React from "react";
import AvailabilityPanel from "./AvailabilityPanel";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";
import { formatBookingSlot } from "../utils/dashboardHelpers";

const CANCELED_STATUSES = ["cancelled", "canceled"];
const RESCHEDULED_STATUSES = ["rescheduled", "verschoben"];

function normalizeStatus(contact, inboxContact) {
  const leadBooked = !!contact.booked;
  const leadStatus = String(contact.bookingData?.status || "").trim().toLowerCase();
  const inboxStatus = String(inboxContact?.providerBookingState?.status || "").trim().toLowerCase();
  const isCancelled = CANCELED_STATUSES.includes(leadStatus) || CANCELED_STATUSES.includes(inboxStatus);

  if (isCancelled) {
    return "storniert";
  }

  if (leadBooked || leadStatus === "booked" || inboxStatus === "booked") {
    return "gebucht";
  }

  if (RESCHEDULED_STATUSES.includes(leadStatus) || RESCHEDULED_STATUSES.includes(inboxStatus)) {
    return "verschoben";
  }

  if (leadStatus) {
    return leadStatus;
  }

  return "inaktiv";
}

function formatBookingDateTime(bookingData = {}, selectedSlot = "") {
  const rawStart = bookingData.startAt;
  if (typeof rawStart === "string" && rawStart.trim()) {
    const date = new Date(rawStart);
    if (!Number.isNaN(date.getTime())) {
      return {
        date: date.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        time: date.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    }
  }

  return {
    date: selectedSlot || "-",
    time: selectedSlot ? "-" : "-",
  };
}

function formatDuration(bookingData = {}) {
  const durationMinutes = Number(bookingData.durationMinutes) || 0;
  if (durationMinutes > 0) {
    return `${durationMinutes} min`;
  }

  const startAt = bookingData.startAt;
  const endAt = bookingData.endAt;
  if (typeof startAt === "string" && typeof endAt === "string") {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diff = Math.round((end.getTime() - start.getTime()) / 60000);
      if (diff > 0) {
        return `${diff} min`;
      }
    }
  }

  return "-";
}

function normalizeProvider(rawProvider) {
  const provider = String(rawProvider || "").trim().toLowerCase();
  if (!provider) return "-";
  if (provider === "manual") return "Manuell";
  if (provider === "calendly") return "Calendly";
  return rawProvider;
}

function getAppointmentRows(contacts = [], inboxContacts = []) {
  return contacts
    .map((contact) => {
      const inboxContact = inboxContacts.find(
        (entry) => String(entry.id) === String(contact.id),
      );
      const status = normalizeStatus(contact, inboxContact);
      const selectedSlot =
        formatBookingSlot(contact.bookingData) ||
        formatBookingSlot(inboxContact?.bookingData) ||
        "";
      const bookingData = contact.bookingData || inboxContact?.bookingData || {};
      const { date, time } = formatBookingDateTime(bookingData, selectedSlot);
      const duration = formatDuration(bookingData);
      const provider = normalizeProvider(
        contact.bookingData?.bookingProvider || inboxContact?.providerBookingState?.provider,
      );
      const meetingLink =
        contact.bookingData?.meetingLink ||
        contact.bookingData?.externalBookingUrl ||
        inboxContact?.providerBookingState?.bookingUrl ||
        "";

      const isBooked = status === "gebucht";
      const isCancelled = status === "storniert";
      const isRescheduled = status === "verschoben";

      return {
        id: contact.id,
        name: contact.name || "(kein Name)",
        campaignId: contact.campaignId || "-",
        source: contact.source || "-",
        status,
        date,
        time,
        duration,
        provider,
        meetingLink,
        selectedSlot,
        isBooked,
        isCancelled,
        isRescheduled,
      };
    })
    .filter((entry) => entry.isBooked || entry.isCancelled || entry.isRescheduled);
}

export default function AppointmentsView({
  colors,
  contacts,
  inboxContacts,
  availabilityForm,
  availabilityLoading,
  availabilitySaving,
  availabilityMessage,
  onAvailabilityFormChange,
  onReload,
  onSave,
  onReset,
  onOpenLead,
  renderPlaceholder,
}) {
  const rows = getAppointmentRows(contacts, inboxContacts);
  const activeRows = rows.filter((row) => row.isBooked);
  const historyRows = rows.filter((row) => !row.isBooked && (row.isCancelled || row.isRescheduled));

  const renderLinkCell = (link) => {
    if (!link) return "-";
    const isExternal = link.startsWith("http://") || link.startsWith("https://");
    return isExternal ? (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        style={{ color: colors.primary || "#1f7ed0", textDecoration: "underline" }}
      >
        Link
      </a>
    ) : (
      link
    );
  };

  const renderRows = (appointmentRows) => (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 0.9fr 0.9fr 0.7fr 0.8fr 1fr 1fr",
          gap: 12,
          padding: "12px 0",
          borderBottom: `1px solid ${colors.border}`,
          fontSize: 12,
          color: colors.sub,
          fontWeight: 600,
        }}
      >
        <div>Lead</div>
        <div>Kampagne</div>
        <div>Quelle</div>
        <div>
          <FieldLabelWithInfo
            label="Status"
            title="Status"
            text="Zeigt, ob ein Termin aktiv gebucht, storniert oder intern vorbereitet ist."
            placement="right"
            labelStyle={{ marginBottom: 0 }}
          />
        </div>
        <div>Datum</div>
        <div>Uhrzeit</div>
        <div>Dauer</div>
        <div>
          <FieldLabelWithInfo
            label="Provider"
            title="Provider / Link"
            text="Zeigt, ob der Termin manuell, über Calendly oder einen anderen Anbieter entstanden ist. Falls vorhanden, erscheint hier der Meeting- oder Buchungslink."
            placement="right"
            labelStyle={{ marginBottom: 0 }}
          />
        </div>
        <div>Meeting-Link</div>
      </div>
      {appointmentRows.map((row) => (
        <div
          key={row.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr 0.9fr 0.9fr 0.7fr 0.8fr 1fr 1fr",
            gap: 12,
            padding: "12px 0",
            borderBottom: `1px solid ${colors.border}`,
            fontSize: 12,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>{row.name}</span>
            {onOpenLead ? (
              <button
                type="button"
                onClick={() => onOpenLead(row.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: colors.primary || "#1f7ed0",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                }}
              >
                Lead öffnen
              </button>
            ) : null}
          </div>
          <div>{row.campaignId}</div>
          <div>{row.source}</div>
          <div>{row.status}</div>
          <div>{row.date}</div>
          <div>{row.time}</div>
          <div>{row.duration}</div>
          <div>{row.provider}</div>
          <div>{renderLinkCell(row.meetingLink)}</div>
        </div>
      ))}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <AvailabilityPanel
        colors={colors}
        availabilityForm={availabilityForm}
        availabilityLoading={availabilityLoading}
        availabilitySaving={availabilitySaving}
        availabilityMessage={availabilityMessage}
        onAvailabilityFormChange={onAvailabilityFormChange}
        onReload={onReload}
        onSave={onSave}
        onReset={onReset}
      />

      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          padding: 14,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          Aktive Termine
        </div>
        <div style={{ color: colors.sub, fontSize: 12, marginBottom: 14 }}>
          Hier stehen nur aktuell gebuchte Termine. Stornierte Termine werden nicht als aktiv gezählt.
        </div>

        {activeRows.length === 0 ? (
          <div style={{ color: colors.sub, fontSize: 12, padding: 12, background: colors.panelSoft }}>
            Es sind aktuell keine aktiven Termine gebucht.
          </div>
        ) : (
          renderRows(activeRows)
        )}
      </div>

      {historyRows.length > 0 ? (
        <div
          style={{
            background: colors.panel,
            border: `1px solid ${colors.border}`,
            padding: 14,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            Stornierte / Historische Termine
          </div>
          <div style={{ color: colors.sub, fontSize: 12, marginBottom: 14 }}>
            Hier stehen abgesagte oder ersetzte Termine zur Kontrolle.
          </div>
          {renderRows(historyRows)}
        </div>
      ) : null}

      {activeRows.length === 0 && historyRows.length === 0
        ? renderPlaceholder(
            "Termin-Modul",
            "Hier kommen später gebuchte Gespräche, offene Terminierungen und Kalenderstatus sauber zusammen.",
          )
        : null}
    </div>
  );
}
