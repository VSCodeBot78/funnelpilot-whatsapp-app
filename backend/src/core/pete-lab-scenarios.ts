/**
 * Purpose-built, synthetic-only Pete Mobile Lab test starters.
 * Never used to deliver real messages or to infer that a shared Reel was viewed.
 */
export const PETE_LAB_SCENARIOS = [
  { id: "follower", label: "Neuer Follower", note: "Muster-Begrüßung als echter Chatverlauf. Noch kein automatischer Instagram-Welcome-Flow." },
  { id: "check", label: "CHECK", note: "Echtes Pete-Verhalten auf das Keyword CHECK prüfen, inklusive Link." },
  { id: "bullshit", label: "BULLSHIT", note: "Echtes Pete-Verhalten auf das Keyword BULLSHIT prüfen." },
  { id: "keto", label: "KETO", note: "Echtes Pete-Verhalten auf das Keyword KETO prüfen, inklusive Guide." },
  { id: "guide", label: "GUIDE", note: "Echtes Pete-Verhalten auf GUIDE prüfen." },
  { id: "video", label: "VIDEO", note: "Echtes Pete-Verhalten auf VIDEO prüfen." },
  { id: "reel_only", label: "Reel ohne Text", note: "Simulierter sicherer Zielzustand: Reel-Inhalt unbekannt, kein Sales-Autoreply." },
  { id: "reel_casual", label: "Reel + 😂", note: "Simulierter sicherer Zielzustand: private Reaktion, kein Sales-Autoreply." },
  { id: "reel_question", label: "Reel + Trainingsfrage", note: "Reel-Inhalt unbekannt. Trainingsfrage geht an die echte Pete-Engine." },
  { id: "free", label: "Freier DM-Start", note: "Leerer fiktiver Chat. Starte selbst mit einer Nachricht." },
] as const;

export type PeteLabScenarioId = (typeof PETE_LAB_SCENARIOS)[number]["id"];

export function isPeteLabScenarioId(value: unknown): value is PeteLabScenarioId {
  return typeof value === "string" &&
    PETE_LAB_SCENARIOS.some(s => s.id === value);
}

export function peteLabEntryMessage(id: PeteLabScenarioId): string | null {
  const messages: Partial<Record<PeteLabScenarioId, string>> = {
    check: "CHECK",
    bullshit: "BULLSHIT",
    keto: "KETO",
    guide: "GUIDE",
    video: "VIDEO",
    reel_question: "Wie kann ich mit so einem Training anfangen?",
  };
  return messages[id] ?? null;
}

export const PETE_LAB_REEL_MARKER =
  "[Instagram-Reel geteilt. Inhalt und Bilder sind Pete nicht zugänglich.]";

export const PETE_LAB_FOLLOWER_GREETING =
  "Hey, schön, dass du da bist 🙂 Ich bin Pete und unterstütze Jochen bei den Nachrichten. " +
  "Wenn du Fragen zu Training, Ernährung oder mehr Energie im Elternalltag hast, schreib einfach.";

export function isReelScenario(id: PeteLabScenarioId): boolean {
  return id === "reel_only" || id === "reel_casual" || id === "reel_question";
}
