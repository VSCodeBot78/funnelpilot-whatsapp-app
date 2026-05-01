import type { AiObjectionCategory } from "../types/ai-funnel.types.js";

export type AiObjectionFrameworkEntry = {
  category: AiObjectionCategory;
  purpose: string;
  coreRule: string;
  doList: string[];
  dontList: string[];
};

export const AI_OBJECTION_FRAMEWORK: Record<AiObjectionCategory, AiObjectionFrameworkEntry> = {
  price: {
    category: "price",
    purpose: "Preis-Einwand einordnen, ohne den Einwand groß zu machen, und zurück in eine Entscheidung führen.",
    coreRule:
      "Preis nicht rechtfertigen. Nicht weich werden. Nicht zu früh Infos anbieten. Kurz spiegeln und dann auf Entscheidungsebene zurückführen.",
    doList: [
      "kurz spiegeln",
      "eigentliche Ebene aufmachen",
      "ruhig führen",
      "bei Bedarf auf binäre Entscheidung zuspitzen",
    ],
    dontList: [
      "Preis verteidigen",
      "Rabatt andeuten",
      "zu früh den Info-Ausgang öffnen",
      "verkaufsdrückend klingen",
    ],
  },
  no_time: {
    category: "no_time",
    purpose: "Zeit-Einwand als Struktur- oder Prioritätsthema einordnen und wieder in Führung bringen.",
    coreRule:
      "Nicht akzeptieren, dass Zeit der Endpunkt ist. Kurz spiegeln und auf Priorität oder alltagstaugliche Lösung zurückführen.",
    doList: [
      "Alltagsrealität anerkennen",
      "Priorität öffnen",
      "zur realistischen Lösung zurückführen",
    ],
    dontList: [
      "mit Zeit diskutieren",
      "den Lead belehren",
      "lange Motivationsreden halten",
    ],
  },
  partner: {
    category: "partner",
    purpose: "Mitentscheider respektieren, aber Commitment und Klarheit beim Lead prüfen.",
    coreRule:
      "Nicht pitchen. Nicht drängen. Erst klären, ob der Lead selbst grundsätzlich schon Ja sagt oder noch unklar ist.",
    doList: [
      "Abstimmung respektieren",
      "Eigenklarheit des Leads prüfen",
      "saubere nächste Stufe anbieten",
    ],
    dontList: [
      "Partner aushebeln wollen",
      "zu früh Druck machen",
      "zu viel erklären",
    ],
  },
  already_tried: {
    category: "already_tried",
    purpose: "Muster benennen: nicht fehlendes Wissen, sondern fehlende Alltagstauglichkeit oder Stabilität.",
    coreRule:
      "Nicht mitleidig werden. Muster klar spiegeln und den Lead sauber weiterführen.",
    doList: [
      "Wissensproblem von Umsetzungsproblem trennen",
      "Alltag als Hebel benennen",
      "kurz und präzise spiegeln",
    ],
    dontList: [
      "lange Analyse",
      "zu weich werden",
      "den Lead im Problem baden lassen",
    ],
  },
  unclear_real_chat: {
    category: "unclear_real_chat",
    purpose: "Unklare Freitextantworten kurz einordnen und wieder strukturiert in den Funnel führen.",
    coreRule:
      "Nicht labern. Kurz spiegeln, Sinn ordnen, nächste Frage sauber vorbereiten.",
    doList: [
      "kurz zusammenfassen",
      "klar einordnen",
      "Brücke zur nächsten Frage bauen",
    ],
    dontList: [
      "kompliziert antworten",
      "zu viele Optionen auf einmal öffnen",
      "offen im Nichts enden",
    ],
  },
};
