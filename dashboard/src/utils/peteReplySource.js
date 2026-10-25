/** Human-readable evidence for the most recent /test-chat/message reply. */
export function describePeteReplySource(source) {
  switch (source) {
    case "llm":
      return "OpenAI-KI-Modell (echte Modellantwort)";
    case "verified_transaction":
      return "Verifizierte Angebots- oder Buchungsregel (kein KI-Text)";
    case "guarded_safety":
      return "Feste Sicherheitsregel (kein KI-Text)";
    case "deterministic":
    case "legacy":
      return "Festes Regelwerk (kein KI-Text)";
    case "human_handoff":
      return "Übergabe an einen Menschen (kein KI-Text)";
    case "llm_handoff":
      return "KI-Handoff oder Fehler, keine Modellantwort";
    case "lab_error":
      return "Technischer Laborfehler, keine Modellantwort oder persönliche Übergabe";
    case "safe_noncritical":
      return "Sichere Ersatzantwort (kein KI-Text)";
    default:
      return "Antwortquelle nicht verifiziert";
  }
}
