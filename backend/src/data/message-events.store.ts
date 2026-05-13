import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

export type MessageEventStatus =
  | "received"
  | "processed"
  | "ignored_duplicate"
  | "ignored_status"
  | "ignored_unsupported"
  | "failed";

export type MessageEventLogEntry = {
  id: string;
  provider: "meta_whatsapp";
  messageId: string;
  from?: string;
  receivedAt: string;
  type?: string;
  status: MessageEventStatus;
  raw?: Record<string, unknown>;
};

const DATA_DIR = env.DATA_DIR;
const MESSAGE_EVENTS_FILE = path.join(DATA_DIR, "message-events.json");
const MAX_EVENTS = 1000;

let messageEventsStore: MessageEventLogEntry[] = [];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readMessageEventsFile(): MessageEventLogEntry[] {
  ensureDataDir();

  if (!fs.existsSync(MESSAGE_EVENTS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(MESSAGE_EVENTS_FILE, "utf8");
    if (!raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is MessageEventLogEntry =>
        item &&
        typeof item === "object" &&
        item.provider === "meta_whatsapp" &&
        typeof item.messageId === "string" &&
        typeof item.status === "string",
    );
  } catch (error) {
    console.error("message events store read error:", error);
    return [];
  }
}

function writeMessageEventsFile(events: MessageEventLogEntry[]): void {
  ensureDataDir();
  fs.writeFileSync(
    MESSAGE_EVENTS_FILE,
    JSON.stringify(events.slice(-MAX_EVENTS), null, 2),
    "utf8",
  );
}

function persistMessageEventsStore(): void {
  writeMessageEventsFile(messageEventsStore);
}

messageEventsStore = readMessageEventsFile();

export function getMessageEventByMessageId(
  provider: "meta_whatsapp",
  messageId: string,
): MessageEventLogEntry | undefined {
  const cleanMessageId = String(messageId || "").trim();
  if (!cleanMessageId) {
    return undefined;
  }

  const blockingStatuses: MessageEventStatus[] = [
    "processed",
    "ignored_unsupported",
    "failed",
  ];

  return [...messageEventsStore].reverse().find(
    (event) =>
      event.provider === provider &&
      event.messageId === cleanMessageId &&
      blockingStatuses.includes(event.status),
  );
}

export function saveMessageEventLogEntry(
  entry: MessageEventLogEntry,
): MessageEventLogEntry {
  const safeEntry = { ...entry };
  messageEventsStore = [...messageEventsStore, safeEntry].slice(-MAX_EVENTS);
  persistMessageEventsStore();
  return safeEntry;
}

export function getAllMessageEvents(): MessageEventLogEntry[] {
  return messageEventsStore.map((event) => ({ ...event }));
}
