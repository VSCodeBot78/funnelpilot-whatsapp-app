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
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "360px minmax(0, 1fr)",
        gap: 12,
      }}
    >
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
  );
}
