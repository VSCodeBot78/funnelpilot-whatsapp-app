import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { writePrivateJsonAtomic } from "./private-json-file.js";
import type { BookingData } from "../types/types.js";

type LeadRecord = {
  id: string;
  backendLeadId?: string;
  name: string;
  phone: string;
  source: string;
  campaignId: string;
  tags: string[];
  stage: string;
  resumeStage: string | null;
  score: number | null;
  botEnabled: boolean;
  excluded: boolean;
  booked: boolean;
  note: string;
  isBotTyping: boolean;
  intent: string;
  readiness: string;
  bookingData: BookingData;
  messages: Array<{
    id: number;
    role: "bot" | "contact";
    text: string;
    time: string;
  }>;
  lastActivityAt: number;
};

const DATA_DIR = env.DATA_DIR;
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function readLeadsFile(): LeadRecord[] {
  ensureDataDir();
  if (!fs.existsSync(LEADS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(LEADS_FILE, "utf8");
    if (!raw.trim()) {
      if (env.NODE_ENV === "production") throw new Error("empty_leads_store");
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      if (env.NODE_ENV === "production") throw new Error("invalid_leads_store_shape");
      return [];
    }

    return parsed.filter(
      (item): item is LeadRecord =>
        item && typeof item === "object" && typeof (item as any).id === "string",
    );
  } catch (error) {
    if (env.NODE_ENV === "production") throw new Error("leads_store_invalid_stop_restore", { cause: error });
    console.error("lead store read error:", error);
    return [];
  }
}

function writeLeadsFile(leads: LeadRecord[]): void {
  ensureDataDir();
  writePrivateJsonAtomic(LEADS_FILE, leads);
}

function persistLeadsStore(): void {
  writeLeadsFile(Array.from(leadsStore.values()));
}

// The operator dashboard must start without fictional contacts. Keep existing
// persisted leads untouched; synthetic Pete-Lab sessions live separately.
const defaultLeads: LeadRecord[] = [];

let leadsStore = new Map<string, LeadRecord>();

function cloneLead(lead: LeadRecord): LeadRecord {
  return {
    ...lead,
    tags: [...lead.tags],
    bookingData: { ...lead.bookingData },
    messages: lead.messages.map((message) => ({ ...message })),
  };
}

function cloneLeads(leads: LeadRecord[]): LeadRecord[] {
  return leads.map(cloneLead);
}

function buildStoreFromDefaults(): Map<string, LeadRecord> {
  return new Map(defaultLeads.map((lead) => [lead.id, cloneLead(lead)]));
}

function hydrateStoreFromFile(): void {
  const savedLeads = readLeadsFile();
  if (savedLeads.length > 0) {
    leadsStore = new Map(savedLeads.map((lead) => [lead.id, cloneLead(lead)]));
  } else {
    // Never present demo personas as genuine customers in a production tenant.
    // Existing persisted leads are not silently deleted by this guard.
    leadsStore = env.NODE_ENV === "production"
      ? new Map<string, LeadRecord>()
      : buildStoreFromDefaults();
  }
}

leadsStore = new Map<string, LeadRecord>();
hydrateStoreFromFile();

export type { LeadRecord };

export function getAllLeads(): LeadRecord[] {
  return Array.from(leadsStore.values()).map(cloneLead);
}

export function getLeadById(id: string): LeadRecord | undefined {
  const lead = leadsStore.get(String(id));
  return lead ? cloneLead(lead) : undefined;
}

export function saveLead(lead: LeadRecord): LeadRecord {
  const safeLead = cloneLead(lead);
  leadsStore.set(String(safeLead.id), safeLead);
  persistLeadsStore();
  return cloneLead(safeLead);
}

export function deleteLead(id: string): boolean {
  const removed = leadsStore.delete(String(id));
  if (removed) {
    persistLeadsStore();
  }
  return removed;
}

export function resetLeadsStore(): LeadRecord[] {
  leadsStore = buildStoreFromDefaults();
  persistLeadsStore();
  return getAllLeads();
}
