import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
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
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is LeadRecord =>
        item && typeof item === "object" && typeof (item as any).id === "string",
    );
  } catch (error) {
    console.error("lead store read error:", error);
    return [];
  }
}

function writeLeadsFile(leads: LeadRecord[]): void {
  ensureDataDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf8");
}

function persistLeadsStore(): void {
  writeLeadsFile(Array.from(leadsStore.values()));
}

const defaultLeads: LeadRecord[] = [
  {
    id: "101",
    backendLeadId: "101",
    name: "Sarah",
    phone: "+49 171 12345678",
    source: "WhatsApp",
    campaignId: "fit",
    tags: ["Heißer Lead", "Gespräch läuft"],
    stage: "booking",
    resumeStage: null,
    score: 9,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "Interessiert, möchte zügig starten.",
    isBotTyping: false,
    intent: "scheduling",
    readiness: "hot",
    bookingData: {
      selectedSlot: "",
      startAt: undefined,
      endAt: undefined,
      bookingProvider: "",
      bookingId: "",
      externalBookingId: "",
      calendarEventId: "",
      meetingLink: "",
      meetingType: "unknown",
      status: "inactive",
      confirmedAt: null,
      cancelledAt: null,
      notes: "",
    },
    lastActivityAt: Date.now() - 20 * 60 * 1000,
    messages: [
      { id: 1, role: "bot", text: "Hallo Sarah, schön dass du da bist.", time: "15:05" },
      { id: 2, role: "contact", text: "Ich möchte gern mehr erfahren, wie das abläuft.", time: "15:07" },
      { id: 3, role: "bot", text: "Sehr gern. Lass uns kurz schauen, was für dich sinnvoll ist.", time: "15:09" },
      { id: 4, role: "contact", text: "Klingt gut.", time: "15:10" },
    ],
  },
  {
    id: "102",
    backendLeadId: "102",
    name: "Bianca",
    phone: "+49 151 22222222",
    source: "Facebook",
    campaignId: "fit",
    tags: ["Gespräch läuft"],
    stage: "consequence_freetext",
    resumeStage: null,
    score: null,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "",
    isBotTyping: false,
    intent: "",
    readiness: "warm",
    bookingData: {
      selectedSlot: "",
      startAt: undefined,
      endAt: undefined,
      bookingProvider: "",
      bookingId: "",
      externalBookingId: "",
      calendarEventId: "",
      meetingLink: "",
      meetingType: "unknown",
      status: "inactive",
      confirmedAt: null,
      cancelledAt: null,
      notes: "",
    },
    lastActivityAt: Date.now() - 2 * 60 * 60 * 1000,
    messages: [
      {
        id: 1,
        role: "contact",
        text: "Hi Jochen, ich habe deine Anzeige gesehen und interessiere mich für die ELTERN VITAL METHODE. Kannst du mir mehr Infos schicken?",
        time: "09:11",
      },
      {
        id: 2,
        role: "bot",
        text: "Hey 😊 Mit wem schreibe ich gerade? Schreib mir einfach kurz deinen Vornamen.",
        time: "09:11",
      },
    ],
  },
  {
    id: "103",
    backendLeadId: "103",
    name: "Timo",
    phone: "+49 176 55544321",
    source: "Instagram",
    campaignId: "fit",
    tags: ["Neuer Lead"],
    stage: "ask_name",
    resumeStage: null,
    score: null,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "",
    isBotTyping: false,
    intent: "",
    readiness: "cold",
    bookingData: {
      selectedSlot: "",
      startAt: undefined,
      endAt: undefined,
      bookingProvider: "",
      bookingId: "",
      externalBookingId: "",
      calendarEventId: "",
      meetingLink: "",
      meetingType: "unknown",
      status: "inactive",
      confirmedAt: null,
      cancelledAt: null,
      notes: "",
    },
    lastActivityAt: Date.now() - 8 * 60 * 1000,
    messages: [
      {
        id: 1,
        role: "contact",
        text: "Hi Jochen, ich habe deine Anzeige gesehen und interessiere mich für die ELTERN VITAL METHODE. Kannst du mir mehr Infos schicken?",
        time: "18:42",
      },
      {
        id: 2,
        role: "bot",
        text: "Hey 😊 Mit wem schreibe ich gerade? Schreib mir einfach kurz deinen Vornamen.",
        time: "18:42",
      },
    ],
  },
  {
    id: "104",
    backendLeadId: "104",
    name: "Dummy Lea",
    phone: "+49 170 1112233",
    source: "Testsystem",
    campaignId: "reset",
    tags: ["Dummy"],
    stage: "goal_choice",
    resumeStage: null,
    score: null,
    botEnabled: true,
    excluded: false,
    booked: false,
    note: "Sandbox-Lead für Bot-Tests.",
    isBotTyping: false,
    intent: "",
    readiness: "cold",
    bookingData: {
      selectedSlot: "",
      startAt: undefined,
      endAt: undefined,
      bookingProvider: "",
      bookingId: "",
      externalBookingId: "",
      calendarEventId: "",
      meetingLink: "",
      meetingType: "unknown",
      status: "inactive",
      confirmedAt: null,
      cancelledAt: null,
      notes: "",
    },
    lastActivityAt: Date.now() - 30 * 60 * 1000,
    messages: [
      { id: 1, role: "contact", text: "DUMMY TEST", time: "16:00" },
      {
        id: 2,
        role: "bot",
        text: "Hey [Name] 😊\ndas ist die Dummy Kampagne.\nHier kannst du frei testen, wie der Bot auf andere Hooks oder Antworten reagiert.",
        time: "16:01",
      },
    ],
  },
];

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
    leadsStore = buildStoreFromDefaults();
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
