import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

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
    sanitized[key] = rawValue;
  }
  return sanitized as Partial<SettingsConfig>;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureSettingsFile(): void {
  ensureDataDir();

  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      "utf8",
    );
  }
}

export function readSettings(): SettingsConfig {
  ensureSettingsFile();

  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}") as Partial<SettingsConfig>;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      aiModel:
        String(parsed.aiModel ?? DEFAULT_SETTINGS.aiModel).trim() ||
        DEFAULT_SETTINGS.aiModel,
    };
  } catch (error) {
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

  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(merged, null, 2),
    "utf8",
  );

  return merged;
}

export function resetSettings(): SettingsConfig {
  ensureSettingsFile();

  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(DEFAULT_SETTINGS, null, 2),
    "utf8",
  );

  return { ...DEFAULT_SETTINGS };
}
