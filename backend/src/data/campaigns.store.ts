import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

export type CampaignRecord = {
  id: string;
  offerContext?: CampaignOfferContext;
  entryConfig?: CampaignEntryConfig;
  [key: string]: unknown;
};

export type CampaignOfferContext = {
  priceInquiryText: string;
  infoLink1Enabled: boolean;
  infoLink1Label: string;
  infoLink1Url: string;
  infoLink2Enabled: boolean;
  infoLink2Label: string;
  infoLink2Url: string;
  internalNote: string;
};

export const DEFAULT_OFFER_CONTEXT: CampaignOfferContext = {
  priceInquiryText:
    "Die Preise hängen davon ab, welche Begleitung wirklich zu deiner Situation passt. Wenn du möchtest, schauen wir im Strategiegespräch kurz, was sinnvoll ist.",
  infoLink1Enabled: true,
  infoLink1Label: "Angebot ansehen",
  infoLink1Url: "",
  infoLink2Enabled: false,
  infoLink2Label: "Video ansehen",
  infoLink2Url: "",
  internalNote: "",
};

export type CampaignEntryChannel =
  | "meta_ctwa"
  | "website_whatsapp_link"
  | "qr_shortlink"
  | "organic_dm"
  | "manual";

export type CampaignStarterMode =
  | "prefilled_message"
  | "start_conversation_prompt"
  | "whatsapp_flow"
  | "free_text";

export type CampaignEntryMatchingMode =
  | "hybrid"
  | "referral_only"
  | "text_only"
  | "fallback_only";

export type CampaignEntryConfig = {
  entryChannel: CampaignEntryChannel;
  starterMode: CampaignStarterMode;
  suggestedEntryMessage: string;
  matchingMode: CampaignEntryMatchingMode;
  exactTriggerRequired: boolean;
  triggerFallbackEnabled: boolean;
  ctwaAttributionEnabled: boolean;
  metaAdId: string;
  metaAdName: string;
  metaCampaignId: string;
  metaCampaignName: string;
  unknownEntryFallbackText: string;
};

export const DEFAULT_UNKNOWN_ENTRY_FALLBACK_TEXT =
  "Danke dir. Damit ich dich sauber einordne: Geht es bei dir gerade eher um Energie, Bauch, Schlaf/Stress oder Struktur?";

export const DEFAULT_ENTRY_CONFIG: CampaignEntryConfig = {
  entryChannel: "meta_ctwa",
  starterMode: "prefilled_message",
  suggestedEntryMessage: "",
  matchingMode: "hybrid",
  exactTriggerRequired: false,
  triggerFallbackEnabled: true,
  ctwaAttributionEnabled: true,
  metaAdId: "",
  metaAdName: "",
  metaCampaignId: "",
  metaCampaignName: "",
  unknownEntryFallbackText: DEFAULT_UNKNOWN_ENTRY_FALLBACK_TEXT,
};

const DATA_DIR = env.DATA_DIR;
const CAMPAIGNS_FILE = path.join(DATA_DIR, "campaigns.json");

const DEFAULT_CAMPAIGNS: CampaignRecord[] = [
  {
    id: "fit",
    name: "Mama Papa Kampagne",
    trigger:
      "Hi Jochen, ich habe deine Anzeige gesehen und interessiere mich für die ELTERN VITAL METHODE. Kannst du mir mehr Infos schicken?",
    askNameFirst: true,
    offerContext: { ...DEFAULT_OFFER_CONTEXT },
    entryConfig: {
      ...DEFAULT_ENTRY_CONFIG,
      suggestedEntryMessage:
        "Hi Jochen, ich habe deine Anzeige gesehen und interessiere mich fÃ¼r die ELTERN VITAL METHODE. Kannst du mir mehr Infos schicken?",
    },
    slot1: "Montag 19:00",
    slot2: "Montag 19:45",
    booking: {
      provider: "calendly",
      calendarId: "",
      externalBookingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
      videoProvider: "none",
      meetingType: "phone",
      durationMinutes: 15,
      maxSuggestions: 2,
      notes: "Produktive Hauptkampagne mit Backend-Flowtexten als Referenz.",
      bookingPrompt:
        "Ein kurzer Austausch ist hier am sinnvollsten.\nWann passt es dir eher?\na) unter der Woche abends\nb) Freitag oder Samstag tagsüber\nc) ich bin flexibel",
      starterCheckoutUrl: "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
      onboardingBookingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
    },
    welcome: `Freut mich [Name]
Bevor ich dir einfach irgendwas schicke,
lass uns kurz schauen, ob das überhaupt zu deiner Situation passt.
Ich stelle dir dazu kurz ein paar schnelle Fragen, ok?`,
    q1: `Was merkst du aktuell im Alltag am meisten?
a) ich bin oft müde / platt
b) ich fühle mich nicht mehr wohl in meinem Körper
c) ich kriege Bewegung nicht mehr richtig unter
d) irgendwie alles zusammen`,
    q2: `Hast du bisher schon mal was versucht, um etwas zu verändern?`,
    q3: `Und wenn sich in den nächsten 2-3 Monaten nichts verändert:
Was würde dich daran am meisten nerven?`,
    goal: `Und wenn du 3-6 Monate weiter wärst, was wäre für dich der wichtigste Unterschied?
a) wieder mehr Energie im Alltag
b) mich wieder wohler in meinem Körper fühlen
c) wieder regelmäßig Bewegung schaffen
d) endlich alles zusammen in meinem Griff bekommen`,
    scale: `Und wenn du jetzt 100% ehrlich bist:
Wie wichtig ist dir das gerade auf einer Skala von 1-10, das wirklich anzugehen?`,
    hot: `Ein kurzer Austausch ist hier am sinnvollsten.
Wann passt es dir eher?
a) unter der Woche abends
b) Freitag oder Samstag tagsüber
c) ich bin flexibel`,
    followUp24h: `Hey [Name] 😊
Kurze Erinnerung – ich weiß, der Elternalltag ist manchmal hektisch.
Wenn du noch interessiert bist, bin ich da.`,
    followUp3d: `Hey [Name] 😊
Letzte Erinnerung von mir.`,
  },
  {
    id: "reset",
    name: "Dummy Kampagne",
    trigger: "DUMMY TEST",
    askNameFirst: true,
    offerContext: { ...DEFAULT_OFFER_CONTEXT },
    entryConfig: {
      ...DEFAULT_ENTRY_CONFIG,
      suggestedEntryMessage: "DUMMY TEST",
    },
    slot1: "Mittwoch 12:00",
    slot2: "Donnerstag 18:30",
    booking: {
      provider: "manual",
      calendarId: "",
      externalBookingUrl: "",
      videoProvider: "none",
      meetingType: "phone",
      durationMinutes: 15,
      maxSuggestions: 2,
      notes: "Bewusste Testkampagne zum Rumprobieren ohne Risiko für den Hauptflow.",
      bookingPrompt:
        "Dummy Buchungsfrage:\nWann würdest du prinzipiell Zeit finden?\na) eher morgens\nb) eher abends\nc) ganz unterschiedlich",
      starterCheckoutUrl: "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S",
      onboardingBookingUrl: "https://calendly.com/eltern-fitundvital/strategiegespraech",
    },
    welcome: `Hey [Name] 😊
das ist die Dummy Kampagne.
Hier kannst du frei testen, wie der Bot auf andere Hooks oder Antworten reagiert.`,
    q1: `Was soll hier getestet werden?
a) Hook
b) Frage
c) Einwand
d) Booking`,
    q2: `Was genau willst du ausprobieren?`,
    q3: `Woran würdest du merken, dass die Antwort besser ist?`,
    goal: `Was ist in dieser Dummy Kampagne gerade dein Ziel?
a) bessere Hooks
b) besserer Flow
c) bessere Antworten
d) einfach testen`,
    scale: `Wie wichtig ist dir dieser Test gerade auf einer Skala von 1-10?`,
    hot: `Alles klar 👍
Dann testen wir hier weiter, ohne die Hauptkampagne anzufassen.`,
    followUp24h: `Dummy Follow-up nach 24h.`,
    followUp3d: `Dummy Follow-up nach 3 Tagen.`,
  },
];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureCampaignsFile(): void {
  ensureDataDir();

  if (!fs.existsSync(CAMPAIGNS_FILE)) {
    fs.writeFileSync(
      CAMPAIGNS_FILE,
      JSON.stringify(DEFAULT_CAMPAIGNS, null, 2),
      "utf8",
    );
  }
}

function normalizeOfferContext(value: unknown): CampaignOfferContext {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<CampaignOfferContext>)
      : {};

  return {
    priceInquiryText:
      typeof raw.priceInquiryText === "string"
        ? raw.priceInquiryText
        : DEFAULT_OFFER_CONTEXT.priceInquiryText,
    infoLink1Enabled:
      typeof raw.infoLink1Enabled === "boolean"
        ? raw.infoLink1Enabled
        : DEFAULT_OFFER_CONTEXT.infoLink1Enabled,
    infoLink1Label:
      typeof raw.infoLink1Label === "string"
        ? raw.infoLink1Label
        : DEFAULT_OFFER_CONTEXT.infoLink1Label,
    infoLink1Url:
      typeof raw.infoLink1Url === "string"
        ? raw.infoLink1Url
        : DEFAULT_OFFER_CONTEXT.infoLink1Url,
    infoLink2Enabled:
      typeof raw.infoLink2Enabled === "boolean"
        ? raw.infoLink2Enabled
        : DEFAULT_OFFER_CONTEXT.infoLink2Enabled,
    infoLink2Label:
      typeof raw.infoLink2Label === "string"
        ? raw.infoLink2Label
        : DEFAULT_OFFER_CONTEXT.infoLink2Label,
    infoLink2Url:
      typeof raw.infoLink2Url === "string"
        ? raw.infoLink2Url
        : DEFAULT_OFFER_CONTEXT.infoLink2Url,
    internalNote:
      typeof raw.internalNote === "string"
        ? raw.internalNote
        : DEFAULT_OFFER_CONTEXT.internalNote,
  };
}

function normalizeEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

function normalizeEntryConfig(campaign: CampaignRecord): CampaignEntryConfig {
  const raw =
    campaign.entryConfig && typeof campaign.entryConfig === "object"
      ? (campaign.entryConfig as Partial<CampaignEntryConfig>)
      : {};
  const legacyTrigger = typeof campaign.trigger === "string" ? campaign.trigger : "";

  return {
    entryChannel: normalizeEnumValue(
      raw.entryChannel,
      ["meta_ctwa", "website_whatsapp_link", "qr_shortlink", "organic_dm", "manual"],
      DEFAULT_ENTRY_CONFIG.entryChannel,
    ),
    starterMode: normalizeEnumValue(
      raw.starterMode,
      ["prefilled_message", "start_conversation_prompt", "whatsapp_flow", "free_text"],
      DEFAULT_ENTRY_CONFIG.starterMode,
    ),
    suggestedEntryMessage:
      typeof raw.suggestedEntryMessage === "string" && raw.suggestedEntryMessage.trim()
        ? raw.suggestedEntryMessage
        : legacyTrigger,
    matchingMode: normalizeEnumValue(
      raw.matchingMode,
      ["hybrid", "referral_only", "text_only", "fallback_only"],
      DEFAULT_ENTRY_CONFIG.matchingMode,
    ),
    exactTriggerRequired:
      typeof raw.exactTriggerRequired === "boolean"
        ? raw.exactTriggerRequired
        : DEFAULT_ENTRY_CONFIG.exactTriggerRequired,
    triggerFallbackEnabled:
      typeof raw.triggerFallbackEnabled === "boolean"
        ? raw.triggerFallbackEnabled
        : DEFAULT_ENTRY_CONFIG.triggerFallbackEnabled,
    ctwaAttributionEnabled:
      typeof raw.ctwaAttributionEnabled === "boolean"
        ? raw.ctwaAttributionEnabled
        : DEFAULT_ENTRY_CONFIG.ctwaAttributionEnabled,
    metaAdId:
      typeof raw.metaAdId === "string" ? raw.metaAdId : DEFAULT_ENTRY_CONFIG.metaAdId,
    metaAdName:
      typeof raw.metaAdName === "string"
        ? raw.metaAdName
        : DEFAULT_ENTRY_CONFIG.metaAdName,
    metaCampaignId:
      typeof raw.metaCampaignId === "string"
        ? raw.metaCampaignId
        : DEFAULT_ENTRY_CONFIG.metaCampaignId,
    metaCampaignName:
      typeof raw.metaCampaignName === "string"
        ? raw.metaCampaignName
        : DEFAULT_ENTRY_CONFIG.metaCampaignName,
    unknownEntryFallbackText:
      typeof raw.unknownEntryFallbackText === "string" && raw.unknownEntryFallbackText.trim()
        ? raw.unknownEntryFallbackText
        : DEFAULT_ENTRY_CONFIG.unknownEntryFallbackText,
  };
}

function normalizeCampaignRecord(campaign: CampaignRecord): CampaignRecord {
  return {
    ...campaign,
    offerContext: normalizeOfferContext(campaign.offerContext),
    entryConfig: normalizeEntryConfig(campaign),
  };
}

function readCampaignsFile(): CampaignRecord[] {
  ensureCampaignsFile();

  try {
    const raw = fs.readFileSync(CAMPAIGNS_FILE, "utf8");
    const parsed = JSON.parse(raw || "[]") as unknown;

    if (!Array.isArray(parsed)) {
      return [...DEFAULT_CAMPAIGNS];
    }

    return parsed.map((campaign) => {
      if (campaign && typeof campaign === "object" && "id" in campaign) {
        return normalizeCampaignRecord(campaign as CampaignRecord);
      }
      return null;
    }).filter((item): item is CampaignRecord => Boolean(item));
  } catch (error) {
    console.error("campaigns store read error:", error);
    return [...DEFAULT_CAMPAIGNS];
  }
}

function writeCampaignsFile(campaigns: CampaignRecord[]): CampaignRecord[] {
  ensureCampaignsFile();
  fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), "utf8");
  return campaigns;
}

export function getAllCampaigns(): CampaignRecord[] {
  return readCampaignsFile();
}

export function getCampaignById(id: string): CampaignRecord | undefined {
  const campaigns = readCampaignsFile();
  return campaigns.find((campaign) => String(campaign.id) === String(id));
}

export function saveCampaign(campaign: CampaignRecord): CampaignRecord {
  const normalizedCampaign = normalizeCampaignRecord(campaign);
  const campaigns = readCampaignsFile();
  const nextCampaigns = campaigns.filter(
    (existing) => String(existing.id) !== String(normalizedCampaign.id),
  );

  nextCampaigns.push(normalizedCampaign);
  writeCampaignsFile(nextCampaigns);
  return normalizedCampaign;
}

export function deleteCampaign(id: string): boolean {
  const campaigns = readCampaignsFile();
  const nextCampaigns = campaigns.filter(
    (campaign) => String(campaign.id) !== String(id),
  );

  if (nextCampaigns.length === campaigns.length) {
    return false;
  }

  writeCampaignsFile(nextCampaigns);
  return true;
}

export function resetCampaigns(): CampaignRecord[] {
  return writeCampaignsFile([...DEFAULT_CAMPAIGNS]);
}
