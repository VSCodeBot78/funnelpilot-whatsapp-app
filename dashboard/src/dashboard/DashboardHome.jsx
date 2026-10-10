import React from "react";
import LeadList from "../leads/LeadList";
import SystemStatusPanel from "../diagnostics/SystemStatusPanel";
import { getWorkSummary } from "../navigation/dashboardNavigation";

export default function DashboardHome({
  colors,
  contacts = [],
  sortedContacts = [],
  activeContactId,
  onSelectLead,
  onOpenInbox = () => {},
  onOpenLeads = () => {},
  onOpenTestChat = () => {},
  apiBaseUrl = "",
  onRestartOnboarding,
  onEditConnections,
}) {
  const stats = getWorkSummary(contacts);
  const priorityContacts = sortedContacts
    .filter(contact => !contact.excluded && !contact.isDraft)
    .slice(0, 5);

  function action(title, detail, handler, primary = false) {
    return (
      <button
        type="button"
        className="fp-quick-action"
        onClick={handler}
        style={{
          background: primary ? colors.accent : colors.panel,
          color: primary ? "#fff" : colors.text,
          border: `1px solid ${primary ? colors.accent : colors.border}`,
          borderRadius: 12,
        }}
      >
        <strong>{title} <span aria-hidden="true">→</span></strong>
        <span style={{ color: primary ? "#eef6ff" : colors.sub }}>{detail}</span>
      </button>
    );
  }

  function metric(label, value) {
    return (
      <div className="fp-home-metric"
        style={{ background: colors.panel, border: `1px solid ${colors.border}` }}>
        <span style={{ color: colors.sub }}>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }

  return (
    <div className="fp-home">
      <section className="fp-home-hero"
        style={{ background: colors.panel, border: `1px solid ${colors.border}` }}>
        <div>
          <h1 style={{ color: colors.text }}>Dein Arbeitsplatz</h1>
          <p style={{ color: colors.sub }}>
            Zuerst Gespräche und interessante Kontakte. Einrichtung nur, wenn du sie brauchst.
          </p>
        </div>
        <div className="fp-home-actions">
          {action("Inbox öffnen", "Gespräche lesen und persönlich übernehmen", onOpenInbox, true)}
          {action("Leads ansehen", "Kontakte prüfen und bearbeiten", onOpenLeads)}
          {action("Pete testen", "Neuen lokalen Testchat öffnen", onOpenTestChat)}
        </div>
      </section>

      <SystemStatusPanel colors={colors} apiBaseUrl={apiBaseUrl}
        onEditConnections={onEditConnections} />

      <section aria-label="Lead-Überblick" className="fp-home-stats">
        {metric("Kontakte", stats.total)}
        {metric("Als heiß markiert", stats.hot)}
        {metric("Als im Gespräch markiert", stats.running)}
        {metric("Als gebucht markiert", stats.booked)}
      </section>

      <section className="fp-home-priority">
        <div className="fp-home-section-heading">
          <div>
            <h2 style={{ color: colors.text }}>Leads im Blick</h2>
            <p style={{ color: colors.sub }}>
              Nach gespeicherter Priorität sortiert – nicht automatisch ungelesene Nachrichten.
            </p>
          </div>
          <button type="button" onClick={onOpenLeads}
            style={{ color: colors.text, background: colors.panelSoft,
              border: `1px solid ${colors.border}`, padding: "9px 12px",
              borderRadius: 9, cursor: "pointer" }}>
            Alle Leads
          </button>
        </div>
        {priorityContacts.length > 0 ? (
          <LeadList colors={colors} contacts={priorityContacts}
            activeContactId={activeContactId} onSelectLead={onSelectLead}/>
        ) : (
          <div style={{ color: colors.sub, padding: 20, border: `1px solid ${colors.border}`,
            background: colors.panel, borderRadius: 9 }}>
            Keine passenden Leads vorhanden. Prüfe die Verbindung oder öffne die Inbox.
          </div>
        )}
      </section>

      <details className="fp-home-setup" style={{ border: `1px solid ${colors.border}`,
        background: colors.panel, borderRadius: 10 }}>
        <summary style={{ color: colors.text, cursor: "pointer", fontWeight: 650 }}>
          Einrichtung und Verbindungen
        </summary>
        <p style={{ color: colors.sub, fontSize: 12 }}>
          Nur bei Änderungen benötigt. Bestehende Einstellungen und Verbindungen bleiben erhalten.
        </p>
        <div className="fp-home-setup-actions">
          <button type="button" onClick={onRestartOnboarding}
            style={{ background: colors.panelSoft, color: colors.text,
              border: `1px solid ${colors.border}`, borderRadius: 8 }}>
            Einrichtung öffnen
          </button>
          <button type="button" onClick={onEditConnections}
            style={{ background: colors.panelSoft, color: colors.text,
              border: `1px solid ${colors.border}`, borderRadius: 8 }}>
            Verbindungen bearbeiten
          </button>
        </div>
      </details>
    </div>
  );
}
