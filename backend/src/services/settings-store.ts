import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { writePrivateJsonAtomic } from "../data/private-json-file.js";

export type SettingsConfig = {
  productName: string;
  adminName: string;
  adminRole: string;
  defaultTheme: "dark" | "light" | "system";
  brandHint: string;
  companyName: string;
  companyWebsite: string;
  companyNiche: string;
  companyAudience: string;
  companyOfferSummary: string;
  setupVideoUrl: string;
  topbarSubtitle: string;
  footerText: string;
  aiEnabled: boolean;
  testMode: boolean;
  aiProvider: string;
  aiModel: string;
  aiFallback: string;
  assistantName: string;
  assistantRole: string;
  defaultBotTone: "ruhig" | "direkt" | "freundlich" | "knapp" | string;
  defaultLanguage: string;
  brandVoice: string;
  masterPrompt: string;
  customerTopObjections: string;
  dmConversationMode: "natural" | "legacy";
  answerLength: "kurz" | "mittel" | string;
  fallbackReply: string;
  qualificationPrompt: string;
  escalationHint: string;
  noGos: string;
  defaultBookingUrl: string;
  onboardingBookingUrl: string;
  starterCheckoutUrl: string;
  maxSuggestions: string;
  bookingPrompt: string;
  apiBaseUrl: string;
  whatsappProvider: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  calendarId: string;
  tokenHint: string;
  privacyPolicyUrl: string;
  imprintUrl: string;
};

const DEFAULT_FALLBACK_TEXT =
  "Da m\u00f6chte ich nichts Falsches sagen. Ich gebe das lieber an Jochen weiter, damit du eine saubere Antwort bekommst.";

const DEFAULT_ESCALATION_RULE =
  "Wenn der Lead medizinische Beschwerden schildert, rechtliche Fragen stellt, aggressiv wird, konkrete Preise verhandeln will oder deutlich zeigt, dass ein Mensch \u00fcbernehmen sollte.";

const DEFAULT_NO_GOS = [
  "- kein Druckverkauf",
  "- keine Diagnose",
  "- keine medizinischen Versprechen",
  "- keine Heilversprechen",
  "- keine unrealistischen Ergebnisse versprechen",
  "- keine aggressiven Closing-Techniken",
].join("\n");

export const DEFAULT_MASTER_PROMPT = [
  "Du bist Pete, der offen als KI-Assistent von Eltern fit & vital auftritt. Gib niemals vor, Jochen persönlich zu sein.",
  "Zielgruppe: berufstätige Mütter und Väter zwischen etwa 35 und 55 Jahren; häufig zu wenig Energie, Bauchfett, Stress, zu wenig Schlaf und wenig Zeit.",
  "Sprich wie ein guter, ruhiger Verkäufer und Fit-&-Vital-Coach: direkt, unkompliziert, bodenständig und in kurzen WhatsApp-Nachrichten. Kein Werbesprech, kein künstliches Lob, keine langen Gedankenstriche, keine KI-Floskeln.",
  "Führe ein echtes Gespräch statt einen Fragebogen abzuspulen. Spiegel das konkrete Problem kurz, stelle höchstens eine passende Anschlussfrage pro Nachricht, bleib freundlich und klar.",
  "Denk in vier Kommunikationsbedürfnissen: Blau = nachvollziehbare Struktur, Rot = klare Resultate, Grün = Sicherheit, Gelb = anschauliches Lebensgefühl. Passe dich an die Sprache des Leads an.",
  "Inhalte: alltagsnahe Krafttrainings- und Bewegungsroutinen, familienkompatible Ernährung, Schlaf, Stress und konsequente Umsetzung statt perfekter Diät.",
  "Keto ist optionales Werkzeug, kein Dogma und kein notwendiger Weg für alle. Kein Heilversprechen, keine erfundenen Studien oder Ergebnisse, keine medizinischen Diagnosen.",
  "Keine kostenlosen individuellen Ernährungspläne versprechen und keine isolierten Ernährungspläne verkaufen. Bei konkreten Fragen erst Situation, Ziel und bisherige Versuche klären.",
  "Angebote, Preise, Links und Buchungen ausschließlich anhand der aktuell im System hinterlegten geprüften Angebotsdaten nennen. Keine Preise, Rabatte oder Terminverfügbarkeiten erfinden.",
  "Wenn ein Mensch übernehmen soll, Jochen genannt wird, gesundheitliche Fragen kritisch sind oder der Lead STOP sagt: Übergabe- und Stopregeln beachten; keinesfalls einfach weiter closen.",
  "DM-Stil: Greife zuerst die konkrete Aussage der Person auf, spiegle kurz das eigentliche Problem und stelle EINE passende Frage. Keine starren A-B-C-D-Auswahlfragen, keine Wichtigkeitsskalen, keine automatischen Future-Pacing-Fragen.",
  "Qualifikation: meistens 3–4 sinnvolle Schritte. Situationsproblem, bisherige Versuche, Umsetzungsblockade, gewünschte Art der Unterstützung. Die nächste Frage ergibt sich aus der vorigen Antwort. Namen nur dann erfragen, wenn sie für den nächsten Schritt gebraucht werden.",
  "Verkaufspsychologie im Sinne professionellen, respektvollen Settings: aktives Zuhören, offene Fragen, Kaufmotive erkennen, Einwände isolieren, Kosten-Nutzen klar machen, Entscheidung freiwillig erleichtern. Keine manipulative Dringlichkeit, kein falsches Verknappen, keine Schuldgefühle und keine Tricks aus Verkaufstrainings imitieren.",
  "Wenn ein Lead konkret kaufen möchte: direkt und klar Preise und passende nächste Schritte benennen; nicht unnötig ins Strategiegespräch drücken. Preisfragen zum zuletzt besprochenen Angebot beantworten, niemals ungefragt die komplette Preisliste.",
  "Wünscht jemand ein Gespräch mit Jochen, zwischen persönlicher Übernahme hier im Chat und Termin für ein Strategiegespräch unterscheiden. Beim persönlichen Chat Human Handover statt Kalenderlink.",
  "Bei Budgetbedenken zunächst unterscheiden, ob wirklich kein Budget oder eher Unsicherheit über die Passung besteht. Selbststarter erst anbieten, wenn dieser Weg tatsächlich sinnvoll ist.",
  "Keto-Begleitung gehört als mögliche, individuell angepasste Ernährungsform zur 5-Wochen-Startphase für 499 Euro. Sie ist kein gesondertes Pflichtprodukt. Keto ist ein Werkzeug, keine Religion. Bei Keto-Spezialfragen mit Erkrankungen, Medikamenten oder Therapie sofort persönlich übergeben.",
  "Keto Guide auf ausdrückliche Nachfrage kostenlos als PDF und Hörversion mit korrektem Link anbieten. Keto-Coaching-Fragen nicht einfach zum kostenlosen Keto Guide umleiten.",
  "Kein Coaching ohne Auftrag: einen hilfreichen Gedanken geben, aber keinen persönlichen Ernährungs-, Trainings- oder Therapieplan im kostenlosen DM entwerfen. Individuelle Arbeit gehört in die Begleitung.",
  "Kernziel: echte Orientierung, passende Qualifikation und ein sinnvoller nächster Schritt, ohne Druckverkauf oder unnötig viele Fragen.",
].join("\n");

export const DEFAULT_SETTINGS: SettingsConfig = {
  productName: "Funnel Pilot",
  adminName: "Jochen Kammerer",
  adminRole: "Admin",
  defaultTheme: "dark",
  brandHint: "Funnel Pilot / White Label sp\u00e4ter",
  companyName: "Eltern fit & vital",
  companyWebsite: "https://jochen-kammerer.de",
  companyNiche: "Fitness & Vitalität für Eltern",
  companyAudience: "Berufstätige Eltern 35–55",
  companyOfferSummary: "No Bullshit Elternfitness, Selbststarter und Coaching",
  setupVideoUrl: "",
  topbarSubtitle: "Produktstruktur mit Sidebar, Topbar und getrennten Modulen",
  footerText: "copyright Jochen Kammerer",
  aiEnabled: false,
  testMode: true,
  aiProvider: "OpenAI",
  aiModel: env.OPENAI_MODEL || "gpt-4.1-mini",
  aiFallback: "Wenn die KI ausf\u00e4llt, \u00fcbernimmt der Regel-Flow ohne Eskalation.",
  assistantName: "Pete",
  assistantRole: "",
  defaultBotTone: "ruhig",
  defaultLanguage: "Deutsch",
  brandVoice: "Jochen-Sprache",
  masterPrompt: DEFAULT_MASTER_PROMPT,
  customerTopObjections: "Keine Zeit im Elternalltag\nPreis oder Budget\nSchon vieles versucht",
  dmConversationMode: "natural",
  answerLength: "kurz",
  fallbackReply: DEFAULT_FALLBACK_TEXT,
  qualificationPrompt: "",
  escalationHint: DEFAULT_ESCALATION_RULE,
  noGos: DEFAULT_NO_GOS,
  defaultBookingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
  onboardingBookingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
  starterCheckoutUrl: "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
  maxSuggestions: "2",
  bookingPrompt:
    "Ein kurzer Austausch ist hier am sinnvollsten.\nWann passt es dir eher?\na) unter der Woche abends\nb) Freitag oder Samstag tags\u00fcber\nc) ich bin flexibel",
  apiBaseUrl: "",
  whatsappProvider: "meta",
  phoneNumberId: "",
  webhookVerifyToken: "",
  calendarId: "",
  tokenHint: "sp\u00e4ter sicher speichern",
  privacyPolicyUrl: "",
  imprintUrl: "",
};

const DATA_DIR = env.DATA_DIR;
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
// The dashboard sends full settings today, but integrations and onboarding may
// send partial updates later. Only persisted, typed settings may be changed.
const ALLOWED_SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

function sanitizeSettings(
  value: Partial<SettingsConfig> & Record<string, unknown>,
): Partial<SettingsConfig> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (!ALLOWED_SETTING_KEYS.has(key)) continue;
    const defaultValue = DEFAULT_SETTINGS[key as keyof SettingsConfig];
    if (typeof rawValue !== typeof defaultValue) continue;
    if (key === "customerTopObjections") {
      sanitized[key] = String(rawValue)
        .split(/\r?\n/)
        .map((item) => item.trim().slice(0, 220))
        .filter(Boolean)
        .slice(0, 3)
        .join("\n");
      continue;
    }
    sanitized[key] = rawValue;
  }
  return sanitized as Partial<SettingsConfig>;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function ensureSettingsFile(): void {
  ensureDataDir();

  if (!fs.existsSync(SETTINGS_FILE)) {
    writePrivateJsonAtomic(SETTINGS_FILE, DEFAULT_SETTINGS);
  }
}

export function readSettings(): SettingsConfig {
  ensureSettingsFile();

  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    if (env.NODE_ENV === "production" && !raw.trim()) {
      throw new Error("empty_production_settings");
    }
    const parsed = JSON.parse(raw || "{}") as Partial<SettingsConfig>;
    if (env.NODE_ENV === "production" &&
        (!parsed || typeof parsed !== "object" || Array.isArray(parsed))) {
      throw new Error("invalid_production_settings_shape");
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      aiModel:
        String(parsed.aiModel ?? DEFAULT_SETTINGS.aiModel).trim() ||
        DEFAULT_SETTINGS.aiModel,
    };
  } catch (error) {
    if (env.NODE_ENV === "production") throw new Error("settings_store_invalid_stop_restore", { cause: error });
    console.error("settings read error:", error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(
  nextSettings: Partial<SettingsConfig>,
): SettingsConfig {
  ensureSettingsFile();

  const merged: SettingsConfig = {
    ...readSettings(),
    ...sanitizeSettings(
      nextSettings as Partial<SettingsConfig> & Record<string, unknown>,
    ),
  };

  writePrivateJsonAtomic(SETTINGS_FILE, merged);

  return merged;
}

export function resetSettings(): SettingsConfig {
  ensureSettingsFile();

  writePrivateJsonAtomic(SETTINGS_FILE, DEFAULT_SETTINGS);

  return { ...DEFAULT_SETTINGS };
}
