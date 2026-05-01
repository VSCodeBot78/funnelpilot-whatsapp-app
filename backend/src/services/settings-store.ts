import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

export type SettingsConfig = {
  productName: string;
  adminName: string;
  adminRole: string;
  defaultTheme: "dark" | "light" | "system";
  brandHint: string;
  aiEnabled: boolean;
  testMode: boolean;
  aiProvider: string;
  aiModel: string;
  aiFallback: string;
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

export const DEFAULT_SETTINGS: SettingsConfig = {
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
  privacyPolicyUrl: "",
  imprintUrl: "",
};

const DATA_DIR = env.DATA_DIR;
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

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
    ...DEFAULT_SETTINGS,
    ...nextSettings,
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
