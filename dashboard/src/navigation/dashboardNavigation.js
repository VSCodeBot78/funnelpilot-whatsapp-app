// One navigation source for the operator-facing workspace. The existing
// internal section keys intentionally stay unchanged to preserve all routes.
export const DAILY_NAV = Object.freeze([
  { key: "dashboard", label: "Übersicht" },
  { key: "inbox", label: "Inbox" },
  { key: "leads", label: "Leads" },
  { key: "appointments", label: "Termine" },
  { key: "ghosting", label: "Nachfassaktionen" },
]);

export const ADMIN_NAV = Object.freeze([
  { key: "campaigns", label: "Kampagnen" },
  { key: "settings", label: "Einstellungen" },
  { key: "onboarding", label: "Einrichtung" },
  { key: "booking-events", label: "Buchungsprotokoll" },
]);

export const ALL_NAV = Object.freeze([...DAILY_NAV, ...ADMIN_NAV]);

export function isAdminSection(section) {
  return ADMIN_NAV.some(item => item.key === section);
}

export function getSectionLabel(section) {
  return ALL_NAV.find(item => item.key === section)?.label || "Übersicht";
}

// A red/amber score is not evidence of an unread DM. Only surface confirmed
// lead metadata and avoid invented "needs your answer" counts.
export function getWorkSummary(contacts = []) {
  const usable = contacts.filter(contact => !contact.excluded && !contact.isDraft);
  return {
    total: usable.length,
    hot: usable.filter(contact =>
      contact.readiness === "hot" || (contact.tags || []).includes("Heißer Lead")
    ).length,
    running: usable.filter(contact =>
      (contact.tags || []).includes("Gespräch läuft")
    ).length,
    booked: usable.filter(contact => contact.booked === true).length,
  };
}
