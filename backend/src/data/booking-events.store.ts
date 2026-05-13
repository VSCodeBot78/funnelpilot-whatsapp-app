import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import type { BookingEventLogEntry } from "../types/types.js";

const DATA_DIR = env.DATA_DIR;
const BOOKING_EVENTS_FILE = path.join(DATA_DIR, "booking-events.json");
const bookingEventsStore = new Map<string, BookingEventLogEntry>();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readBookingEventsFile(): BookingEventLogEntry[] {
  ensureDataDir();

  if (!fs.existsSync(BOOKING_EVENTS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(BOOKING_EVENTS_FILE, "utf8");
    if (!raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is BookingEventLogEntry =>
          item && typeof item === "object" && typeof (item as any).id === "string",
      );
    }
  } catch (error) {
    console.error("booking events store read error:", error);
  }

  return [];
}

function writeBookingEventsFile(entries: BookingEventLogEntry[]): void {
  ensureDataDir();
  fs.writeFileSync(BOOKING_EVENTS_FILE, JSON.stringify(entries, null, 2), "utf8");
}

function persistBookingEvents(): void {
  writeBookingEventsFile(Array.from(bookingEventsStore.values()));
}

function hydrateBookingEventsFromFile(): void {
  const entries = readBookingEventsFile();
  for (const entry of entries) {
    bookingEventsStore.set(entry.id, entry);
  }
}

hydrateBookingEventsFromFile();

export function getAllBookingEvents(): BookingEventLogEntry[] {
  return Array.from(bookingEventsStore.values());
}

export function getBookingEventByIdempotencyKey(
  idempotencyKey: string,
): BookingEventLogEntry | undefined {
  return Array.from(bookingEventsStore.values())
    .filter((entry) => entry.idempotencyKey === idempotencyKey)
    .sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt))[0];
}

export function saveBookingEventLogEntry(
  entry: BookingEventLogEntry,
): BookingEventLogEntry {
  bookingEventsStore.set(entry.id, entry);
  persistBookingEvents();
  return entry;
}
