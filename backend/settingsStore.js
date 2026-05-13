const fs = require("fs");
const path = require("path");

const configuredDataDir = String(process.env.DATA_DIR || "").trim();
const DATA_DIR = configuredDataDir
  ? path.resolve(process.cwd(), configuredDataDir)
  : path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const READ_ONLY_SETTING_KEYS = new Set([
  "openAiApiKeyConfigured",
  "openAiModelConfigured",
  "aiBotSettingsConfigured",
]);

const DEFAULT_NO_GOS = [
  "- kein Druckverkauf",
  "- keine Diagnose",
  "- keine medizinischen Versprechen",
  "- keine Heilversprechen",
  "- keine unrealistischen Ergebnisse versprechen",
  "- keine aggressiven Closing-Techniken",
].join("\n");

const DEFAULT_SETTINGS = {
  productName: "Funnel Pilot",
  adminName: "Jochen Kammerer",
  adminRole: "Admin",
  defaultTheme: "dark",
  brandHint: "Funnel Pilot / White Label sp\u00e4ter",
  topbarSubtitle: "Produktstruktur mit Sidebar, Topbar und getrennten Modulen",
  footerText: "copyright Jochen Kammerer",
  aiEnabled: false,
  testMode: true,
  aiProvider: "OpenAI",
  aiModel: String(process.env.OPENAI_MODEL || "").trim() || "gpt-4.1-mini",
  aiFallback: "Wenn die KI ausf\u00e4llt, \u00fcbernimmt der Regel-Flow ohne Eskalation.",
  assistantName: "Pete",
  assistantRole: "",
  defaultBotTone: "ruhig",
  defaultLanguage: "Deutsch",
  brandVoice: "Jochen-Sprache",
  answerLength: "kurz",
  fallbackReply:
    "Da m\u00f6chte ich nichts Falsches sagen. Ich gebe das lieber an Jochen weiter, damit du eine saubere Antwort bekommst.",
  qualificationPrompt: "",
  escalationHint:
    "Wenn der Lead medizinische Beschwerden schildert, rechtliche Fragen stellt, aggressiv wird, konkrete Preise verhandeln will oder deutlich zeigt, dass ein Mensch \u00fcbernehmen sollte.",
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
};

function sanitizeSettings(value) {
  const sanitized = { ...(value || {}) };
  for (const key of READ_ONLY_SETTING_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureSettingsFile() {
  ensureDataDir();

  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      "utf8",
    );
  }
}

function readSettings() {
  ensureSettingsFile();

  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      aiModel: String(parsed.aiModel || DEFAULT_SETTINGS.aiModel).trim()
        || DEFAULT_SETTINGS.aiModel,
    };
  } catch (error) {
    console.error("settings read error:", error);
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(nextSettings) {
  ensureSettingsFile();

  const merged = {
    ...DEFAULT_SETTINGS,
    ...sanitizeSettings(nextSettings),
  };

  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(merged, null, 2),
    "utf8",
  );

  return merged;
}

function resetSettings() {
  ensureSettingsFile();

  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(DEFAULT_SETTINGS, null, 2),
    "utf8",
  );

  return { ...DEFAULT_SETTINGS };
}

module.exports = {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  resetSettings,
};
