import React from "react";
import AppointmentsView from "./AppointmentsView";

export default function AppointmentsShell({
  colors,
  contacts,
  inboxContacts,
  availabilityForm,
  availabilityLoading,
  availabilitySaving,
  availabilityMessage,
  onAvailabilityFormChange,
  onReloadAvailability,
  onSaveAvailability,
  onResetAvailability,
  onOpenLead,
  renderPlaceholder,
}) {
  return (
    <AppointmentsView
      colors={colors}
      contacts={contacts}
      inboxContacts={inboxContacts}
      availabilityForm={availabilityForm}
      availabilityLoading={availabilityLoading}
      availabilitySaving={availabilitySaving}
      availabilityMessage={availabilityMessage}
      onAvailabilityFormChange={onAvailabilityFormChange}
      onReload={onReloadAvailability}
      onSave={onSaveAvailability}
      onReset={onResetAvailability}
      onOpenLead={onOpenLead}
      renderPlaceholder={renderPlaceholder}
    />
  );
}
