import { Router } from "express";
import {
  clearConversationStore,
  deleteConversationState,
  deleteConversationStatesByBackendLeadId,
  deleteConversationStatesByLeadId,
  deleteOtherConversationStatesByBackendLeadId,
  getAllConversationStates,
  getConversationState,
  saveConversationState,
} from "../data/store.js";
import type { ConversationState } from "../types/types.js";
import { normalizeBookingData } from "../domain/booking-sync.js";
import { createInitialGhostingState } from "../services/ghosting.service.js";

const router = Router();

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/\D+/g, "").trim();
}

function normalizeName(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findUniqueConversationStateByFallback(
  leadName: string,
  phone: string,
  campaignId: string,
): ConversationState | undefined {
  const normalizedPhone = normalizePhone(phone);
  const normalizedName = normalizeName(leadName);

  const byPhone = getAllConversationStates().filter(
    (state) =>
      String(state.campaignId).trim() === campaignId &&
      normalizedPhone &&
      normalizePhone(state.phone) === normalizedPhone,
  );

  if (byPhone.length === 1) {
    return byPhone[0];
  }

  const byName = getAllConversationStates().filter(
    (state) =>
      String(state.campaignId).trim() === campaignId &&
      normalizedName &&
      normalizeName(state.leadName) === normalizedName,
  );

  if (byName.length === 1) {
    return byName[0];
  }

  return undefined;
}

function buildSeedState(input: {
  leadId: string;
  campaignId: string;
  leadName: string;
  phone: string;
  updatedAt: string;
  lastAssistantMessageAt: string;
  lastUserMessageAt?: string;
  notes?: string;
}): ConversationState {
  const state = {
    leadId: input.leadId,
    backendLeadId: input.leadId,
    campaignId: input.campaignId,
    updatedAt: input.updatedAt,
    createdAt: input.updatedAt,
    startedAt: input.updatedAt,

    lastAssistantMessageAt: input.lastAssistantMessageAt,
    lastUserMessageAt: input.lastUserMessageAt,

    stage: "booking",
    leadName: input.leadName,
    phone: input.phone,
    notes: input.notes ?? "",

    ghosting: createInitialGhostingState(),

    messages: [
      {
        role: "assistant",
        text: "Hallo, schön dass du da bist.",
        createdAt: input.lastAssistantMessageAt,
      },
      ...(input.lastUserMessageAt
        ? [
            {
              role: "user",
              text: "Ich möchte gern mehr erfahren, wie das abläuft.",
              createdAt: input.lastUserMessageAt,
            },
          ]
        : []),
    ],
  };

  return state as unknown as ConversationState;
}

router.get("/conversations", (_req, res) => {
  try {
    const states = getAllConversationStates();

    return res.json({
      ok: true,
      count: states.length,
      conversations: states.map((state) => ({
        leadId: state.leadId,
        leadName: state.leadName || null,
        phone: state.phone || null,
        campaignId: state.campaignId,
        createdAt: state.createdAt ?? null,
        startedAt: state.startedAt ?? null,
        updatedAt: state.updatedAt ?? null,
        lastAssistantMessageAt: state.lastAssistantMessageAt ?? null,
        lastUserMessageAt: state.lastUserMessageAt ?? null,
        ghosting: state.ghosting ?? null,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Laden der Conversations.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.get("/conversations/:campaignId/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;
    const state = getConversationState(String(leadId).trim(), String(campaignId).trim());

    if (!state) {
      return res.status(404).json({
        ok: false,
        error: "Conversation State nicht gefunden.",
      });
    }

    return res.json({ ok: true, state });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Laden des Conversation State.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.post("/conversations/ensure", (req, res) => {
  try {
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const leadId = String(raw.leadId ?? "").trim();
    const campaignId = String(raw.campaignId ?? "").trim();
    const backendLeadId = String(raw.backendLeadId ?? "").trim() || leadId;
    const leadName = String(raw.leadName ?? "").trim();
    const phone = String(raw.phone ?? "").trim();
    const source = raw.source === undefined ? undefined : String(raw.source ?? "").trim();
    const note = raw.note === undefined ? undefined : String(raw.note ?? "").trim();
    const rawBookingData = raw.bookingData as Record<string, unknown> | undefined;
    const bookingStatus = String(rawBookingData?.status ?? "").trim().toLowerCase();
    const isBooked = Boolean(raw.booked) || bookingStatus === "booked";
    const bookingData = normalizeBookingData(rawBookingData ?? {}, isBooked);

    if (!leadId || !campaignId || !leadName || !phone) {
      return res.status(400).json({
        ok: false,
        error: "leadId, campaignId, leadName und phone sind erforderlich.",
      });
    }

    const existingExact = getConversationState(leadId, campaignId);
    if (existingExact) {
      const updatedState: ConversationState = {
        ...existingExact,
        backendLeadId,
        leadName,
        phone,
        source,
        notes: note === undefined ? existingExact.notes : note,
        bookingData,
        providerBooking: isBooked
          ? {
              ...existingExact.providerBooking,
              status: "booked",
            }
          : existingExact.providerBooking,
      };

      saveConversationState(updatedState);
      deleteOtherConversationStatesByBackendLeadId(
        backendLeadId,
        updatedState.leadId,
        updatedState.campaignId,
      );

      getAllConversationStates()
        .filter(
          (state) =>
            String(state.leadId).trim() === leadId &&
            String(state.campaignId).trim() !== campaignId,
        )
        .forEach((state) => {
          deleteConversationState(state.leadId, state.campaignId);
        });

      return res.json({ ok: true, state: updatedState });
    }

    const existingByBackendLeadId = getAllConversationStates().find(
      (state) =>
        String(state.backendLeadId ?? "").trim() === backendLeadId,
    );

    if (existingByBackendLeadId) {
      deleteConversationStatesByBackendLeadId(backendLeadId);

      const movedState: ConversationState = {
        ...existingByBackendLeadId,
        leadId,
        backendLeadId,
        campaignId,
        leadName,
        phone,
        source,
        notes: note === undefined ? existingByBackendLeadId.notes : note,
        bookingData,
        providerBooking: isBooked
          ? {
              ...existingByBackendLeadId.providerBooking,
              status: "booked",
            }
          : existingByBackendLeadId.providerBooking,
      };

      saveConversationState(movedState);
      return res.json({ ok: true, state: movedState });
    }

    const existingByLeadId = getAllConversationStates().find(
      (state) => String(state.leadId).trim() === leadId,
    );

    if (existingByLeadId) {
      deleteConversationStatesByLeadId(leadId);

      const movedState: ConversationState = {
        ...existingByLeadId,
        backendLeadId,
        campaignId,
        leadName,
        phone,
        source,
        notes: note === undefined ? existingByLeadId.notes : note,
        bookingData,
        providerBooking: isBooked
          ? {
              ...existingByLeadId.providerBooking,
              status: "booked",
            }
          : existingByLeadId.providerBooking,
      };

      saveConversationState(movedState);
      return res.json({ ok: true, state: movedState });
    }

    const fallbackState = findUniqueConversationStateByFallback(leadName, phone, campaignId);
    if (fallbackState) {
      deleteConversationState(fallbackState.leadId, fallbackState.campaignId);

      const movedState: ConversationState = {
        ...fallbackState,
        backendLeadId,
        leadId,
        campaignId,
        leadName,
        phone,
        source,
        notes: note === undefined ? fallbackState.notes : note,
        bookingData,
        providerBooking: isBooked
          ? {
              ...fallbackState.providerBooking,
              status: "booked",
            }
          : fallbackState.providerBooking,
      };

      saveConversationState(movedState);
      return res.json({ ok: true, state: movedState });
    }

    const now = new Date().toISOString();
    const initialState: ConversationState = {
      leadId,
      backendLeadId,
      campaignId,
      currentStep: leadName && phone ? "booking" : "ask_name",
      createdAt: now,
      startedAt: now,
      updatedAt: now,
      lastAssistantMessageAt: now,
      leadName,
      phone,
      source,
      notes: note,
      answers: {},
      flags: {
        stopped: false,
        paused: false,
        askedInstallments: false,
        wantsBooking: false,
        wantsLongTermSupport: false,
        wantsDirectBuyStarter: false,
        askedPrice: false,
        wantsInfoOnly: false,
        wantsInfoLinkOnly: false,
      },
      messages: [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Hallo, schön dass du da bist.",
          createdAt: now,
        },
      ],
      ghosting: createInitialGhostingState(),
      bookingData,
      providerBooking: {
        status: "inactive",
        active: false,
        stage: "inactive",
        sentHistory: [],
      },
    };

    saveConversationState(initialState);

    return res.json({ ok: true, state: initialState });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Erstellen des Conversation State.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.post("/conversations/seed", (_req, res) => {
  try {
    clearConversationStore();

    const seeds: ConversationState[] = [
      buildSeedState({
        leadId: "lead_sarah",
        campaignId: "mama-papa-kampagne",
        leadName: "Sarah",
        phone: "+49 171 12345678",
        updatedAt: minutesAgo(20),
        lastAssistantMessageAt: hoursAgo(28),
        notes: "Interessiert, möchte zügig starten.",
      }),

      buildSeedState({
        leadId: "lead_bianca",
        campaignId: "mama-papa-kampagne",
        leadName: "Bianca",
        phone: "+49 151 22222222",
        updatedAt: hoursAgo(2),
        lastAssistantMessageAt: hoursAgo(52),
        notes: "Noch unklar, ob Timing gerade passt.",
      }),

      buildSeedState({
        leadId: "lead_timo",
        campaignId: "mama-papa-kampagne",
        leadName: "Timo",
        phone: "+49 176 55544321",
        updatedAt: minutesAgo(12),
        lastAssistantMessageAt: hoursAgo(6),
        lastUserMessageAt: minutesAgo(12),
        notes: "Hat kürzlich geantwortet, daher kein Ghosting fällig.",
      }),

      buildSeedState({
        leadId: "lead_dummy_lea",
        campaignId: "dummy-kampagne",
        leadName: "Dummy Lea",
        phone: "+49 170 1112233",
        updatedAt: minutesAgo(34),
        lastAssistantMessageAt: hoursAgo(75),
        notes: "Sollte im zweiten Zyklus bzw. kurz vor dead landen.",
      }),
    ];

    seeds.forEach(saveConversationState);

    return res.json({
      ok: true,
      message: "Seed-Conversations wurden erstellt.",
      count: seeds.length,
      conversations: seeds.map((state) => ({
        leadId: state.leadId,
        campaignId: state.campaignId,
        updatedAt: state.updatedAt ?? null,
        lastAssistantMessageAt: state.lastAssistantMessageAt ?? null,
        lastUserMessageAt: state.lastUserMessageAt ?? null,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Erstellen der Seed-Conversations.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.delete("/conversations/seed", (_req, res) => {
  try {
    clearConversationStore();

    return res.json({
      ok: true,
      message: "Seed-Conversations wurden gelöscht.",
      count: 0,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler beim Löschen der Seed-Conversations.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
