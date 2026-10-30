import React from "react";
import LeadList from "./LeadList";
import LeadEditor from "./LeadEditor";

export default function LeadsView({
  colors,
  contacts = [],
  activeContactId,
  leadForm,
  leadMessage,
  campaigns = [],
  onSelectLead,
  onLeadFormChange,
  onCreateNewLead,
  onSaveLead,
  onDeleteLead,
  v2 = false,
}) {
  return (
    <section className={v2 ? "v2-native-page v2-native-leads" : undefined}
      style={v2 ? undefined : { display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: 12 }}>
      {v2 && <header className="v2-native-section-head">
        <div><span className="v2-eyebrow">KONTAKTE & QUALIFIZIERUNG</span>
          <h2>Leads verwalten</h2>
          <p>Kontaktprofil, Kampagne und Gesprächskontext bearbeiten. Keine automatische Pete-Freigabe.</p></div>
        <span className="v2-native-counter">{contacts.length} Kontakte</span>
      </header>}
      <div className={v2 ? "v2-native-lead-grid" : undefined}
        style={v2 ? undefined : { display: "contents" }}>
      <LeadList
        colors={colors}
        contacts={contacts}
        activeContactId={activeContactId}
        onSelectLead={onSelectLead}
      />

      <LeadEditor
        colors={colors}
        leadForm={leadForm}
        leadMessage={leadMessage}
        campaigns={campaigns}
        onLeadFormChange={onLeadFormChange}
        onCreateNewLead={onCreateNewLead}
        onSaveLead={onSaveLead}
        onDeleteLead={onDeleteLead}
      />
      </div>
    </section>
  );
}
