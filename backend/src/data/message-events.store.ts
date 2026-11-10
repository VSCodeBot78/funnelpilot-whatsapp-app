import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { writePrivateJsonAtomic } from "./private-json-file.js";

export type MessageEventStatus =
  | "received"
  | "processed"
  | "ignored_duplicate"
  | "ignored_status"
  | "ignored_unsupported"
  | "failed";

export type MessageEventProvider = "meta_whatsapp" | "meta_instagram";

export type MessageEventLogEntry = {
  id: string;
  provider: MessageEventProvider;
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
const ERASED_INSTAGRAM_MID_PREFIX = "erased-sha256:";

/** Stable one-way pseudonym for replay protection; NOT anonymous deletion.
 * Message IDs carry high-entropy provider-generated values, not follower names.
 */
function erasedInstagramMessageId(messageId: string): string {
  return ERASED_INSTAGRAM_MID_PREFIX + createHash("sha256")
    .update("funnelpilot:instagram-erasure:v1\0")
    .update(messageId)
    .digest("hex");
}

export function isErasedInstagramEvent(entry: MessageEventLogEntry): boolean {
  return entry.provider === "meta_instagram" &&
    entry.messageId.startsWith(ERASED_INSTAGRAM_MID_PREFIX);
}

let messageEventsStore: MessageEventLogEntry[] = [];

/** Instagram delivery telemetry must not create a second copy of lead/chat
 * content. Also scrub old in-memory events when a saved store is loaded.
 */
function minimizeEventContent(entry: MessageEventLogEntry): MessageEventLogEntry {
  if (entry.provider !== "meta_instagram" || !entry.raw) return { ...entry };
  const raw = { ...entry.raw };
  delete raw.textPreview;
  delete raw.botReplyPreview;
  return { ...entry, raw };
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
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
      if (env.NODE_ENV === "production") throw new Error("empty_message_events_store");
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      if (env.NODE_ENV === "production") throw new Error("invalid_message_events_store_shape");
      return [];
    }

    return parsed.filter(
      (item): item is MessageEventLogEntry =>
        item &&
        typeof item === "object" &&
        (item.provider === "meta_whatsapp" ||
          item.provider === "meta_instagram") &&
        typeof item.messageId === "string" &&
        typeof item.status === "string",
    ).map(minimizeEventContent);
  } catch (error) {
    if (env.NODE_ENV === "production") throw new Error("message_events_store_invalid_stop_restore", { cause: error });
    console.error("message events store read error:", error);
    return [];
  }
}

function writeMessageEventsFile(events: MessageEventLogEntry[]): void {
  ensureDataDir();
  writePrivateJsonAtomic(MESSAGE_EVENTS_FILE, events.slice(-MAX_EVENTS));
}

function persistMessageEventsStore(): void {
  writeMessageEventsFile(messageEventsStore);
}

messageEventsStore = readMessageEventsFile();

export function getMessageEventByMessageId(
  provider: MessageEventProvider,
  messageId: string,
): MessageEventLogEntry | undefined {
  const cleanMessageId = String(messageId || "").trim();
  if (!cleanMessageId) {
    return undefined;
  }

  const blockingStatuses: MessageEventStatus[] = provider === "meta_instagram"
    // Inbound is synchronously claimed before its first await. Replays and
    // concurrent duplicate signed deliveries must fail closed, including
    // "received" and paused events. A crashed claim needs operator review.
    ? ["received", "processed", "ignored_status", "ignored_unsupported", "failed"]
    : ["processed", "ignored_unsupported", "failed"];

  return [...messageEventsStore].reverse().find(
    (event) =>
      event.provider === provider &&
      (event.messageId === cleanMessageId ||
        (provider === "meta_instagram" && event.messageId === erasedInstagramMessageId(cleanMessageId))) &&
      blockingStatuses.includes(event.status),
  );
}

export function saveMessageEventLogEntry(
  entry: MessageEventLogEntry,
): MessageEventLogEntry {
  const safeEntry = minimizeEventContent(entry);
  messageEventsStore = [...messageEventsStore, safeEntry].slice(-MAX_EVENTS);
  persistMessageEventsStore();
  return safeEntry;
}

/** Removes sender/recipient references and raw metadata when a synthetic/real
 * Instagram lead is deleted. Retains only a pseudonymous replay tombstone so
 * a signed provider retry cannot silently recreate the erased conversation.
 * Retention period and legal basis for tombstones require separate approval.
 * Commit to disk before changing the in-memory store; a failed disk write must
 * stop lead deletion rather than report a successful erasure.
 */
export function redactInstagramEventsForSender(instagramScopedId: string): number {
  const sender = instagramScopedId.trim();
  if (!sender) return 0;
  let count = 0;
  const next = messageEventsStore.map(entry => {
    if (entry.provider !== "meta_instagram" ||
        (entry.from !== sender && entry.raw?.recipientId !== sender)) return entry;
    count++;
    return {
      id: "erased-" + createHash("sha256").update(entry.id).digest("hex"),
      provider: "meta_instagram" as const,
      messageId: erasedInstagramMessageId(entry.messageId),
      receivedAt: entry.receivedAt.slice(0, 10),
      status: "processed" as const,
    };
  });
  if (!count) return 0;
  writeMessageEventsFile(next);
  messageEventsStore = next;
  return count;
}

export function getAllMessageEvents(): MessageEventLogEntry[] {
  return messageEventsStore.map((event) => ({ ...event }));
}
