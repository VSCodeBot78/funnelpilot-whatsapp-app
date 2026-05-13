import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import type { ConversationState, StoreRecord } from "../types/types.js";

const DATA_DIR = env.DATA_DIR;
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");
const store = new Map<string, ConversationState>();

function buildKey(leadId: string, campaignId: string): string {
  return `${campaignId}::${leadId}`;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readConversationsFile(): StoreRecord {
  ensureDataDir();

  if (!fs.existsSync(CONVERSATIONS_FILE)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(CONVERSATIONS_FILE, "utf8");
    if (!raw.trim()) {
      return {};
    }

    const parsed = JSON.parse(raw) as StoreRecord;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error("conversation store read error:", error);
  }

  return {};
}

function writeConversationsFile(data: StoreRecord): void {
  ensureDataDir();
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(data, null, 2), "utf8");
}

function persistStore(): void {
  const records: StoreRecord = Object.fromEntries(store.entries());
  writeConversationsFile(records);
}

function hydrateStoreFromFile(): void {
  const records = readConversationsFile();

  Object.entries(records).forEach(([key, state]) => {
    if (state && typeof state === "object" && state.leadId && state.campaignId) {
      store.set(key, state);
    }
  });
}

hydrateStoreFromFile();

export function getConversationState(
  leadId: string,
  campaignId: string,
): ConversationState | undefined {
  return store.get(buildKey(leadId, campaignId));
}

export function saveConversationState(state: ConversationState): void {
  const key = buildKey(state.leadId, state.campaignId);
  store.set(key, state);
  persistStore();
}

export function deleteConversationState(
  leadId: string,
  campaignId: string,
): void {
  store.delete(buildKey(leadId, campaignId));
  persistStore();
}

export function getAllConversationStates(): ConversationState[] {
  return Array.from(store.values());
}

export function getConversationStatesByLeadId(
  leadId: string,
): ConversationState[] {
  return Array.from(store.values()).filter(
    (state) => String(state.leadId).trim() === String(leadId).trim(),
  );
}

export function deleteConversationStatesByLeadId(leadId: string): void {
  const targetId = String(leadId).trim();
  for (const [key, state] of Array.from(store.entries())) {
    if (String(state.leadId).trim() === targetId) {
      store.delete(key);
    }
  }

  persistStore();
}

export function deleteConversationStatesByBackendLeadId(
  backendLeadId: string,
): void {
  const targetId = String(backendLeadId).trim();
  for (const [key, state] of Array.from(store.entries())) {
    if (String(state.backendLeadId ?? "").trim() === targetId) {
      store.delete(key);
    }
  }

  persistStore();
}

export function deleteOtherConversationStatesByBackendLeadId(
  backendLeadId: string,
  keepLeadId: string,
  keepCampaignId: string,
): void {
  const targetId = String(backendLeadId).trim();
  const keepKey = buildKey(keepLeadId, keepCampaignId);

  for (const [key, state] of Array.from(store.entries())) {
    if (
      String(state.backendLeadId ?? "").trim() === targetId &&
      key !== keepKey
    ) {
      store.delete(key);
    }
  }

  persistStore();
}

export function clearConversationStore(): void {
  store.clear();
  persistStore();
}
