/** Safe owner diagnostics, never lead/model text, secrets or a fake handover. */
export function peteLabTechnicalFailure(reason: string): string | null {
  const messages: Record<string, string> = {
    not_authorized: "Die Freigabe oder lokale API-Konfiguration fehlt.",
    provider_unavailable: "Der KI-Anbieter hat keine nutzbare Antwort geliefert.",
    invalid_output: "Die KI-Antwort hat die Antwort- oder Sicherheitsprüfung nicht bestanden.",
    budget_exhausted: "Das freigegebene Testbudget ist ausgeschöpft.",
    budget_unavailable: "Der Budgetstatus oder der Verbrauchsbeleg ist nicht verfügbar.",
  };
  return Object.hasOwn(messages, reason)
    ? "Pete-Labortest: " + messages[reason] + " Es wurde keine persönliche Übernahme durch Jochen ausgelöst. Kein automatischer Wiederholungsversuch."
    : null;
}
