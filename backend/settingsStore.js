const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const DEFAULT_SETTINGS = {
  productName: "Funnel Pilot",
  adminName: "Jochen Kammerer",
  adminRole: "Admin",
  defaultTheme: "dark",
  brandHint: "Funnel Pilot / White Label später",
  aiEnabled: false,
  testMode: true,
  aiProvider: "openai",
  aiModel: "gpt-5.4-thinking",
  aiFallback: "Wenn die KI ausfällt, übernimmt der Regel-Flow ohne Eskalation.",
  defaultBookingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
  onboardingBookingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
  starterCheckoutUrl: "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
  maxSuggestions: "2",
  bookingPrompt:
    "Ein kurzer Austausch ist hier am sinnvollsten.\nWann passt es dir eher?\na) unter der Woche abends\nb) Freitag oder Samstag tagsüber\nc) ich bin flexibel",
  apiBaseUrl: "http://localhost:3001",
  whatsappProvider: "meta",
  phoneNumberId: "",
  webhookVerifyToken: "",
  calendarId: "",
  tokenHint: "später sicher speichern",
};

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
    ...(nextSettings || {}),
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
