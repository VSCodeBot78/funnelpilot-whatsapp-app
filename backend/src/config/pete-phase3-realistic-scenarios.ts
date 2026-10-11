/**
 * Ten truly distinct, entirely fictional Phase-3 conversation transcripts.
 * These are lead messages written like real parents, not dataset labels such
 * as "Ich bin Käufer behauptet Zahlung".
 * STOP/human handover MUST end the synthetic conversation immediately.
 */
export type PeteRealisticScenario = {
  id: string;
  role: string;
  turns: readonly string[];
};
export const PETE_PHASE3_REALISTIC: readonly PeteRealisticScenario[] = [
  {
    id: "family-01", role: "Vollzeitmama, 2 Kinder, Abendplan gescheitert",
    turns: [
      "Ich hab zwei Kinder, arbeite Vollzeit und bin abends einfach durch.",
      "Der Kleine war die letzten zwei Wochen ständig krank. Feste Sportabende klappen hier überhaupt nicht.",
      "Ich hatte drei Abende pro Woche geplant. Ging genau zwei Wochen, dann gar nichts mehr.",
      "Was wäre denn bei uns konkret besser als so ein starrer Wochenplan?",
      "Ganz ehrlich, ich kann nicht noch mehr Druck gebrauchen. Ich will eine Lösung, die nicht sofort kaputtgeht.",
      "Muss ich die verpassten Einheiten irgendwann aufholen?",
      "Und wenn wieder beide Kinder krank sind, was dann?",
      "Okay. Was wäre ein sinnvoller nächster Schritt, ohne gleich ein Coaching zu kaufen?",
    ],
  },
  {
    id: "frustration-01", role: "Mutter ohne Geduld für Bots",
    turns: [
      "Ich hab schon drei solcher Bots probiert und alle haben mich nur ausgefragt.",
      "Ich will keine Standardantwort. Ich versuche seit Monaten mehr Sport, aber ständig fällt wegen der Kinder was aus.",
      "Letzte Woche schon wieder: Ich hatte drei Abende eingeplant, dann hatte meine Tochter Fieber.",
      "Wie soll ich da überhaupt dranbleiben, ohne jedes Mal wieder bei null zu starten?",
      "Beantworte die Frage bitte konkret, ich hab dir doch schon gesagt, was passiert ist.",
      "Genau das nervt mich: Wenn ich etwas erkläre, will ich nicht dieselbe Frage nochmal hören.",
      "Muss ich dafür jeden Tag trainieren oder gibt es eine andere Idee?",
      "Und bitte am Ende nicht gleich 'Willst du ein Gespräch buchen?' schreiben.",
    ],
  },
  {
    id: "frustration-06", role: "Papa will Energie, nicht abnehmen",
    turns: [
      "Ich bin Papa von zwei Kindern. Bei mir geht es NICHT um Abnehmen. Ich möchte nach der Arbeit noch Energie haben.",
      "Mir wurde auf Instagram schon zweimal ein Bauchfett-Programm angeboten. Das geht komplett an mir vorbei.",
      "Die Kinder schlafen spät, ich stehe früh auf und hänge nachmittags durch.",
      "Was kann ich denn allgemein zuerst prüfen, ohne wieder zehn Fragen zu beantworten?",
      "Hast du wirklich verstanden, dass mein Gewicht kein Thema ist?",
      "Ich mache sogar schon Krafttraining zweimal pro Woche, das muss ich nicht erst lernen.",
      "Wie würde man Schlaf und Alltag realistisch einbeziehen?",
      "Passt, ich will erst nachdenken und keine Verkaufsnachricht.",
    ],
  },
  {
    id: "knowledge-01", role: "Mutter trainiert nach vergangener Schwangerschaft",
    turns: [
      "Meine letzte Schwangerschaft ist über zwei Jahre her. Ich trainiere zweimal die Woche schwer, aber das Gewicht bewegt sich kaum.",
      "Bitte komm mir nicht mit 'einfach mehr Sport'. Das mache ich schon.",
      "Ich schlafe wegen Job und Kind oft nur sechs Stunden und sitze tagsüber viel.",
      "Was sagt die Forschung allgemein zu Gewichtsstagnation trotz Krafttraining?",
      "Ich möchte keine Ferndiagnose. Meine Werte wurden beim Arzt schon überprüft.",
      "Ist dann mehr Cardio wirklich automatisch die beste Idee?",
      "Ich brauche etwas, das in meinen Alltag passt, nicht wieder einen Plan von der Stange.",
      "Was wäre ein vernünftiger erster Beobachtungspunkt?",
    ],
  },
  {
    id: "knowledge-02", role: "Vegetarischer Vater zweifelt an Keto-Mythen",
    turns: [
      "Ich bin Vater, esse vegetarisch und beschäftige mich mit Keto. Im Netz wird ja alles Mögliche behauptet.",
      "Manche sagen, ohne Keto nehme man kaum Körperfett ab. Das klingt für mich fragwürdig.",
      "Ich trainiere schon lange und möchte eine ehrliche wissenschaftliche Einordnung, keine Werbung.",
      "Macht Keto bei gleicher Kalorien- und Eiweißmenge nachweislich mehr Fettverlust?",
      "Und ist das überhaupt sinnvoll, wenn die Kinder weiter normal Brot und Nudeln essen?",
      "Ich will nicht zwei komplett verschiedene Gerichte kochen.",
      "Was wäre eine pragmatische Lösung für die Familie?",
      "Danke. Und was ist daran gesichert und was eher persönliche Erfahrung?",
    ],
  },
  {
    id: "budget-05", role: "Vater befürchtet versteckte Gebühren",
    turns: [
      "Ich finde das Angebot interessant, aber ich hab schon mal in einem Checkout böse Überraschungen erlebt.",
      "Wir müssen momentan ziemlich aufs Geld achten, also bitte keine Verkaufsshow.",
      "Ich will ungern wieder was kaufen, das dann ungenutzt herumliegt.",
      "Was ist denn beim Selbststarter enthalten und was kostet er?",
      "Kannst du verbindlich versprechen, dass keine Zusatzkosten irgendwo auftauchen?",
      "Mir reicht erstmal eine sachliche Antwort. Ich entscheide nicht heute.",
      "Was würde sich ändern, wenn ich doch persönliche Unterstützung möchte?",
      "Okay, ich bespreche das erstmal mit meiner Partnerin.",
    ],
  },
  {
    id: "handoff-02", role: "Calendly-Buchung nicht verifiziert",
    turns: [
      "Ich habe gestern über den Kalender einen Termin gewählt, aber keine Bestätigung bekommen.",
      "Kannst du wirklich im System sehen, ob der Termin gebucht ist?",
      "Ich hatte schon mal Probleme mit einer falschen Buchungsbestätigung.",
      "Ich will nicht nochmal dass ein Bot sagt, alles sei sicher, obwohl niemand nachgeschaut hat.",
    ],
  },
  {
    id: "handoff-03", role: "Mutter fürchtet doppelte IG-/WhatsApp-Antworten",
    turns: [
      "Ich hab euch bei Instagram und bei WhatsApp geschrieben und bekomme auf beiden Kanälen Antworten.",
      "Ich will nicht wieder von zwei Bots gleichzeitig angequatscht werden.",
      "Kannst du garantieren, dass ab jetzt nur noch ein Chat weiterläuft?",
      "Wenn Jochen persönlich schreibt, muss die KI aufhören. Geht das bei euch wirklich?",
      "Ich möchte keine falsche Zusage bekommen.",
      "Okay, wie kläre ich das am besten mit Jochen?",
    ],
  },
  {
    id: "handoff-05", role: "Käufer hat keine Zugangsdaten",
    turns: [
      "Ich habe gestern den Selbststarter gekauft, aber finde die Zugangs-Mail nicht.",
      "Kannst du prüfen, ob die Zahlung wirklich angekommen ist?",
      "Mein Spam-Ordner ist leer. Bitte bestätige nichts, wenn du es nicht überprüfen kannst.",
      "Dann soll Jochen die Bestellung persönlich prüfen.",
    ],
  },
  {
    id: "switch-03", role: "Vermuteter Kauf ohne Beleg, dann anderes Interesse",
    turns: [
      "Ich meine, ich hab den Selbststarter letzte Woche bestellt, finde aber keine Bestätigung.",
      "Bitte sag nicht einfach, ich hätte bezahlt. Kannst du das verifizieren?",
      "Ich hatte zuerst wegen Keto geschrieben, inzwischen möchte ich aber mehr über Schlaf lernen.",
      "Bitte nicht wieder auf das alte Keto-Keyword zurückspringen.",
      "Falls die Bestellung wirklich da ist, kann Jochen das übernehmen.",
    ],
  },
];
if (PETE_PHASE3_REALISTIC.length !== 10 ||
    new Set(PETE_PHASE3_REALISTIC.map(c => c.id)).size !== 10 ||
    PETE_PHASE3_REALISTIC.some(c => c.turns.length < 4 || c.turns.length > 10)) {
  throw Error("phase3_realistic_scenarios_invalid");
}
export function getRealisticPhase3Message(
  id: string, turn: number, previousPeteReply: string,
): string | null {
  const scenario = PETE_PHASE3_REALISTIC.find(p => p.id === id);
  if (!scenario) throw Error("Unknown Phase 3 scenario: " + id);
  let message = scenario.turns[turn];
  if (!message) return null;
  // Only adapt when Pete repeats a preanswered discovery question.
  if (turn >= 3 && /was hast du bisher versucht|woran ist es bisher gescheitert|wie oft kannst du trainieren/i.test(previousPeteReply)) {
    message += " Das habe ich doch bereits erzählt. Warum fragst du wieder dasselbe?";
  }
  return message;
}
