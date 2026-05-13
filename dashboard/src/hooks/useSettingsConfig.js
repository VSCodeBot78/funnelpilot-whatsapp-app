import { useEffect, useState, useCallback } from "react";
import {
  loadSettingsConfig as loadSettingsConfigFromApi,
  saveSettings as saveSettingsToApi,
  resetSettings as resetSettingsFromApi,
} from "../services/settingsApi";

function getResolvedDarkMode(themeValue) {
  if (themeValue === "light") return false;
  if (themeValue === "dark") return true;

  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  return true;
}

function getUserInitial(name) {
  const clean = String(name || "").trim();
  if (!clean) return "A";
  return clean.charAt(0).toUpperCase();
}

const defaultNoGos = [
  "- kein Druckverkauf",
  "- keine Diagnose",
  "- keine medizinischen Versprechen",
  "- keine Heilversprechen",
  "- keine unrealistischen Ergebnisse versprechen",
  "- keine aggressiven Closing-Techniken",
].join("\n");

export const defaultSettings = {
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
  aiModel: "gpt-4.1-mini",
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
  noGos: defaultNoGos,
  openAiApiKeyConfigured: false,
  openAiModelConfigured: true,
  defaultBookingUrl:
    "https://calendly.com/eltern-fitundvital/strategiegespraech",
  onboardingBookingUrl:
    "https://calendly.com/eltern-fitundvital/strategiegespraech",
  starterCheckoutUrl:
    "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
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

function isInvalidOptionalUrl(value) {
  const url = String(value || "").trim();
  return Boolean(url) && !url.startsWith("http://") && !url.startsWith("https://");
}

export function useSettingsConfig({
  onSettingsLoaded,
  onSettingsSaved,
  onSettingsReset,
} = {}) {
  const [settings, setSettings] = useState(defaultSettings);
  const [darkMode, setDarkMode] = useState(
    getResolvedDarkMode(defaultSettings.defaultTheme),
  );
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    if (!settingsMessage) return;
    const timeout = setTimeout(() => setSettingsMessage(""), 2500);
    return () => clearTimeout(timeout);
  }, [settingsMessage]);

  const loadSettingsConfig = useCallback(async () => {
    try {
      const nextSettings = await loadSettingsConfigFromApi(settings.apiBaseUrl);

      const mergedSettings = {
        ...defaultSettings,
        ...nextSettings,
      };

      setSettings(mergedSettings);
      setDarkMode(getResolvedDarkMode(mergedSettings.defaultTheme));

      if (typeof onSettingsLoaded === "function") {
        onSettingsLoaded(mergedSettings);
      }

      return mergedSettings;
    } catch (error) {
      console.error("settings config load error:", error);
      setSettings(defaultSettings);
      setDarkMode(getResolvedDarkMode(defaultSettings.defaultTheme));
      return null;
    }
  }, [onSettingsLoaded, settings.apiBaseUrl]);

  const saveSettings = useCallback(async () => {
    try {
      if (
        isInvalidOptionalUrl(settings.privacyPolicyUrl) ||
        isInvalidOptionalUrl(settings.imprintUrl)
      ) {
        setSettingsMessage(
          "Rechtliche Links m\u00fcssen leer sein oder mit http:// bzw. https:// beginnen.",
        );
        return null;
      }

      const savedSettings = await saveSettingsToApi(settings);
      const mergedSettings = {
        ...defaultSettings,
        ...savedSettings,
      };

      setSettings(mergedSettings);
      setDarkMode(getResolvedDarkMode(mergedSettings.defaultTheme));

      if (typeof onSettingsSaved === "function") {
        onSettingsSaved(mergedSettings);
      }

      setSettingsMessage("Einstellungen im Backend gespeichert.");
      return mergedSettings;
    } catch (error) {
      console.error("settings save error:", error);
      setSettingsMessage("Settings konnten nicht gespeichert werden.");
      return null;
    }
  }, [onSettingsSaved, settings]);

  const resetSettings = useCallback(async () => {
    try {
      const resetData = await resetSettingsFromApi(settings.apiBaseUrl);
      const mergedSettings = {
        ...defaultSettings,
        ...resetData,
      };

      setSettings(mergedSettings);
      setDarkMode(getResolvedDarkMode(mergedSettings.defaultTheme));

      if (typeof onSettingsReset === "function") {
        onSettingsReset(mergedSettings);
      }

      setSettingsMessage("Settings im Backend zur\u00fcckgesetzt.");
      return mergedSettings;
    } catch (error) {
      console.error("settings reset error:", error);
      setSettingsMessage("Settings konnten nicht zur\u00fcckgesetzt werden.");
      return null;
    }
  }, [onSettingsReset, settings.apiBaseUrl]);

  return {
    settings,
    setSettings,
    settingsMessage,
    darkMode,
    setDarkMode,
    loadSettingsConfig,
    saveSettings,
    resetSettings,
    userInitial: getUserInitial(settings.adminName),
    defaultSettings,
  };
}
