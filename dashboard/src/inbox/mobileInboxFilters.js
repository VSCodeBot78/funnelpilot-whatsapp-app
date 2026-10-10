/**
 * Operator-only presentation filters.
 * "Hot" is an existing saved flag, not evidence of unread/urgent messages.
 * "Human" requires a real backend state, never an inferred owner.
 */
export function isHotInboxContact(contact) {
  if (!contact || contact.excluded || contact.isDraft) return false;
  return contact.readiness === "hot" ||
    (contact.tags || []).includes("Heißer Lead");
}
export function isHumanOwnedInboxContact(contact) {
  if (!contact || contact.excluded || contact.isDraft) return false;
  return contact.backendStateConnected === true &&
    (contact.inboxOwner === "human" || contact.inboxAiPaused === true);
}
export function filterInboxContacts(contacts = [], filter = "all") {
  if (filter === "hot") return contacts.filter(isHotInboxContact);
  if (filter === "human") return contacts.filter(isHumanOwnedInboxContact);
  return contacts;
}
export function getInboxFilterCounts(contacts = []) {
  return {
    all: contacts.length,
    hot: filterInboxContacts(contacts, "hot").length,
    human: filterInboxContacts(contacts, "human").length,
  };
}
