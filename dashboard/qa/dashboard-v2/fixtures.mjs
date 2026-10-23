// Synthetic browser-only QA records, NEVER imported by product code or saved
// into a backend. Every fixture screenshot is visibly labelled as test data.
export const leads = [
  {
    id: "qa-ada",
    name: "Ada Winter",
    phone: "+49 000 000001",
    source: "Instagram",
    campaignId: "qa-campaign",
    readiness: "hot",
    tags: ["Heißer Lead", "Gespräch läuft"],
    stage: "qualification",
    intent: "scheduling",
    note: "QA-Testnotiz: Möchte zuerst den Ablauf verstehen.",
    lastActivityAt: "2026-10-23T12:18:00Z",
    booked: false,
  },
  {
    id: "qa-ben",
    name: "Ben Sommer",
    phone: "+49 000 000002",
    source: "WhatsApp",
    campaignId: "qa-campaign",
    readiness: "hot",
    tags: ["Heißer Lead"],
    stage: "discovery",
    note: "QA-Testnotiz: Nur ein Beispielkontakt.",
    lastActivityAt: "2026-10-23T11:45:00Z",
    booked: false,
  },
  {
    id: "qa-clara",
    name: "Clara Berg",
    phone: "+49 000 000003",
    source: "Instagram",
    campaignId: "qa-campaign",
    readiness: "warm",
    tags: ["Gespräch läuft"],
    stage: "discovery",
    lastActivityAt: "2026-10-23T10:22:00Z",
    booked: false,
  },
  {
    id: "qa-david",
    name: "David Nord",
    phone: "+49 000 000004",
    source: "WhatsApp",
    campaignId: "qa-campaign",
    tags: ["Termin gebucht"],
    stage: "booking",
    booked: true,
    bookingData: {
      status: "booked",
      selectedSlot: "26.10.2026 · 17:00",
      bookingProvider: "manual",
    },
    lastActivityAt: "2026-10-22T15:30:00Z",
  },
  {
    id: "qa-elena",
    name: "Elena Langnamen-Darstellungsprüfung",
    source: "Instagram",
    campaignId: "qa-campaign",
    tags: [],
    booked: false,
  },
];
export const campaigns = [
  {
    id: "qa-campaign",
    name: "QA · Kennenlernen",
    trigger: "START",
    askNameFirst: true,
    peteCampaign: {
      sources: ["instagram_dm", "whatsapp_dm"],
      keywords: ["START"],
      openingText:
        "Danke für deine Nachricht. Was möchtest du zuerst über den Ablauf wissen?",
      autoReplyEnabled: false,
      peteHandoffEnabled: false,
      followUpEnabled: false,
      flowDraftEnabled: false,
    },
    booking: { provider: "manual" },
  },
];
export const conversations = leads
  .slice(0, 4)
  .map((lead, index) => ({
    leadId: lead.id,
    campaignId: "qa-campaign",
    leadName: lead.name,
    phone: lead.phone,
    owner: index === 0 ? "human" : "ai",
    aiPaused: index === 0,
    updatedAt: lead.lastActivityAt,
    lastUserMessageAt: "2026-10-23T12:15:00Z",
  }));
export const readiness = {
  ok: true,
  status: "ready",
  service: "funnel-pilot-backend",
  nodeEnv: "development",
  instagramSendEnabled: false,
  whatsappSendEnabled: false,
  instagramEngineEnabled: false,
  instagramAllowAllSenders: false,
  instagramAutoEnableNewLeads: false,
  instagramAllowedSenderCount: 0,
  destructiveRoutesDisabled: true,
  genericWebhooksEnabled: false,
  openAiApiKeyConfigured: false,
  instagramSendConfigured: false,
  metaSendConfigured: false,
};
export const settings = {
  productName: "Funnel Pilot",
  adminName: "QA Betreiber",
  companyName: "QA Workspace",
  assistantName: "Pete",
  defaultTheme: "light",
  aiEnabled: false,
  aiModel: "gpt-6.1-sol",
  coachOnboardingDraft: {
    version: 1,
    identity: {
      brandName: "QA Workspace",
      operatorName: "QA Betreiber",
      assistantName: "Pete",
      audience: "QA Zielgruppe",
      tone: "Klar und freundlich",
    },
    offers: [],
    faqs: [],
  },
};
export function fixtureResponse(path, { empty = false } = {}) {
  if (path === "/health") return { ok: true, status: "healthy" };
  if (path === "/health/readiness") return readiness;
  if (path === "/settings-config")
    return { ok: true, settings, openAiApiKeyConfigured: false };
  if (path === "/leads") return { ok: true, leads: empty ? [] : leads };
  if (path === "/campaigns")
    return { ok: true, campaigns: empty ? [] : campaigns };
  if (path === "/conversations")
    return { ok: true, conversations: empty ? [] : conversations };
  if (path === "/ghosting/schedule")
    return {
      ok: true,
      schedules: [
        {
          cycle: 1,
          slots: [
            {
              stage: "cycle1_within24h_6h",
              dayOffsetHours: 6,
              sendHour: 0,
              sendMinute: 0,
            },
          ],
        },
      ],
    };
  if (path === "/booking-events") return { ok: true, events: [] };
  if (path === "/availability-config")
    return {
      ok: true,
      config: { sourceMode: "manual", maxSuggestions: 2, weeklySlots: {} },
    };
  if (path.startsWith("/scheduling-config/"))
    return {
      ok: true,
      config: { defaultProvider: "manual", providers: {}, texts: {} },
    };
  if (path.startsWith("/conversations/qa-campaign/")) {
    const id = path.split("/").at(-1);
    return {
      ok: true,
      state: {
        ...conversations.find((state) => state.leadId === id),
        messages: [
          {
            id: "m1",
            role: "user",
            actor: "lead",
            text: "Hallo, ich würde gern mehr über den Ablauf erfahren.",
            createdAt: "2026-10-23T12:10:00Z",
          },
          {
            id: "m2",
            role: "assistant",
            actor: "ai",
            text: "Gern. Was ist dir im Moment besonders wichtig?",
            createdAt: "2026-10-23T12:12:00Z",
            sent: false,
            dryRun: true,
          },
          {
            id: "m3",
            role: "user",
            actor: "lead",
            text: "Ich möchte wissen, ob das zu meinem Alltag passt. Können wir dazu kurz sprechen?",
            createdAt: "2026-10-23T12:15:00Z",
          },
          {
            id: "m4",
            role: "assistant",
            actor: "human",
            text: "Ich schaue mir deinen Kontext an und melde mich persönlich.",
            createdAt: "2026-10-23T12:18:00Z",
            sent: false,
          },
        ],
      },
    };
  }
  if (path.startsWith("/ghosting/preview/qa-campaign/"))
    return {
      ok: true,
      campaignId: "qa-campaign",
      leadId: path.split("/").at(-1),
      lastUserMessageAt: "2026-10-23T12:15:00Z",
      evaluation: {
        active: false,
        dueNow: false,
        stage: "inactive",
        reason: "Lead hat nach der letzten Nachricht geantwortet.",
        nextDueAt: null,
      },
      messagePreview: null,
    };
  return null;
}
