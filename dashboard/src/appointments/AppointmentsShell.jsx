import React from "react";
import AppointmentsView from "./AppointmentsView";

export default function AppointmentsShell({
  colors,
  contacts,
  inboxContacts,
  onOpenLead,
  renderPlaceholder,
}) {
  return (
    <AppointmentsView
      colors={colors}
      contacts={contacts}
      inboxContacts={inboxContacts}
      onOpenLead={onOpenLead}
      renderPlaceholder={renderPlaceholder}
    />
  );
}
