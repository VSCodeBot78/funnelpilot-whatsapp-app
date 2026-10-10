import React from "react";
import LeadList from "../leads/LeadList";

export default function DashboardHome({
  colors,
  campaigns,
  contacts,
  sortedContacts,
  activeContactId,
  onSelectLead,
  onRestartOnboarding,
  onEditConnections,
}) {
  const statAll = contacts.length;
  const statHot = contacts.filter((contact) =>
    contact.tags.includes("Heißer Lead"),
  ).length;
  const statRunning = contacts.filter((contact) =>
    contact.tags.includes("Gespräch läuft"),
  ).length;
  const statAppointments = contacts.filter((contact) => contact.booked).length;

  function renderKpiCard(label, value, helper) {
    return (
      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          padding: 16,
          minHeight: 96,
        }}
      >
        <div style={{ color: colors.sub, fontSize: 12, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
          {value}
        </div>
        {helper ? (
          <div style={{ color: colors.sub, fontSize: 12, marginTop: 8 }}>
            {helper}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, background: colors.panel,
          border: `1px solid ${colors.border}`, borderRadius: 10,
          padding: "14px 16px", marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 750, fontSize: 14 }}>Einrichtung anpassen</div>
          <div style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
            Onboarding jederzeit erneut durchlaufen oder Konten ändern.
            Gespeicherte Einstellungen und Verbindungen bleiben erhalten.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onRestartOnboarding} style={{
            border: `1px solid ${colors.border}`, borderRadius: 8,
            background: colors.panelSoft, color: colors.text, padding: "9px 12px",
            cursor: "pointer", fontWeight: 700,
          }}>Einrichtung neu durchlaufen</button>
          <button type="button" onClick={onEditConnections} style={{
            border: `1px solid ${colors.border}`, borderRadius: 8,
            background: colors.panelSoft, color: colors.text, padding: "9px 12px",
            cursor: "pointer", fontWeight: 700,
          }}>Verbindungen bearbeiten</button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        {renderKpiCard(
          "Aktive Kampagnen",
          campaigns.length,
          "aktuell im System",
        )}
        {renderKpiCard("Offene Leads", statAll, `${statRunning} im Gespräch`)}
        {renderKpiCard("Heiße Leads", statHot, "mit Priorität")}
        {renderKpiCard("Termine", statAppointments, "bereits gebucht")}
      </div>

      <LeadList
        colors={colors}
        contacts={sortedContacts}
        activeContactId={activeContactId}
        onSelectLead={onSelectLead}
      />
    </>
  );
}
