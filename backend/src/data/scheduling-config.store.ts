import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import type { MeetingType, SchedulingProvider } from "../types/scheduling.types.js";

export type EditableProviderConfig = {
  provider: SchedulingProvider;
  platform: string;
  meetingType: MeetingType;
  bookingUrl?: string;
};

export type EditableBookingTextsConfig = {
  bookingPrompt?: string;
  starterCheckoutUrl?: string;
  onboardingBookingUrl?: string;
};

export type EditableCampaignSchedulingConfig = {
  defaultProvider: SchedulingProvider;
  providers: Record<string, EditableProviderConfig>;
  texts?: EditableBookingTextsConfig;
};

const DATA_DIR = env.DATA_DIR;
const SCHEDULING_CONFIGS_FILE = path.join(DATA_DIR, "scheduling-configs.json");
const store = new Map<string, EditableCampaignSchedulingConfig>();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readSchedulingConfigsFile(): Record<string, EditableCampaignSchedulingConfig> {
  ensureDataDir();

  if (!fs.existsSync(SCHEDULING_CONFIGS_FILE)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(SCHEDULING_CONFIGS_FILE, "utf8");
    if (!raw.trim()) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, EditableCampaignSchedulingConfig>;
    }
  } catch (error) {
    console.error("scheduling config store read error:", error);
  }

  return {};
}

function writeSchedulingConfigsFile(
  configs: Record<string, EditableCampaignSchedulingConfig>,
): void {
  ensureDataDir();
  fs.writeFileSync(
    SCHEDULING_CONFIGS_FILE,
    JSON.stringify(configs, null, 2),
    "utf8",
  );
}

function persistSchedulingConfigs(): void {
  writeSchedulingConfigsFile(Object.fromEntries(store.entries()));
}

function hydrateSchedulingConfigsFromFile(): void {
  const configs = readSchedulingConfigsFile();

  Object.entries(configs).forEach(([campaignId, config]) => {
    if (
      config &&
      typeof config === "object" &&
      config.defaultProvider &&
      config.providers &&
      typeof config.providers === "object"
    ) {
      store.set(campaignId, config);
    }
  });
}

hydrateSchedulingConfigsFromFile();

export function getSchedulingConfig(
  campaignId: string,
): EditableCampaignSchedulingConfig | undefined {
  return store.get(campaignId);
}

export function saveSchedulingConfig(
  campaignId: string,
  config: EditableCampaignSchedulingConfig,
): void {
  store.set(campaignId, config);
  persistSchedulingConfigs();
}

export function deleteSchedulingConfig(campaignId: string): void {
  store.delete(campaignId);
  persistSchedulingConfigs();
}

export function getAllSchedulingConfigs(): Record<string, EditableCampaignSchedulingConfig> {
  return Object.fromEntries(store.entries());
}
