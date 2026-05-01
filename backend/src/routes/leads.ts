import { Router } from "express";
import {
  deleteLead,
  getAllLeads,
  getLeadById,
  resetLeadsStore,
  saveLead,
  type LeadRecord,
} from "../data/leads.store.js";
import { normalizeBookingData } from "../domain/booking-sync.js";
import {
  deleteConversationState,
  deleteConversationStatesByBackendLeadId,
  deleteConversationStatesByLeadId,
  getAllConversationStates,
} from "../data/store.js";

const router = Router();

function normalizeLeadPayload(input: unknown): LeadRecord {
  const raw = (input ?? {}) as Record<string, unknown>;

  const id = String(raw.id ?? "").trim();
  if (!id) {
    throw new Error("Lead braucht eine id.");
  }

  const rawBookingData = raw.bookingData as Record<string, unknown> | undefined;
  const rawBookingStatus = String(rawBookingData?.status ?? "").trim().toLowerCase();
  const isBooked = Boolean(raw.booked) || rawBookingStatus === "booked";
  const normalizedBookingData = normalizeBookingData(rawBookingData ?? {}, isBooked);

  return {
    id,
    backendLeadId:
      raw.backendLeadId === null || raw.backendLeadId === undefined
        ? id
        : String(raw.backendLeadId ?? "").trim() || id,
    name: String(raw.name ?? "").trim(),
    phone: String(raw.phone ?? "").trim(),
    source: String(raw.source ?? "Instagram").trim(),
    campaignId: String(raw.campaignId ?? "fit").trim(),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((tag) => String(tag)).filter(Boolean)
      : ["Neuer Lead"],
    stage: String(raw.stage ?? "").trim(),
    resumeStage:
      raw.resumeStage === null || raw.resumeStage === undefined
        ? null
        : String(raw.resumeStage),
    score:
      raw.score === null || raw.score === undefined || raw.score === ""
        ? null
        : Number(raw.score),
    botEnabled: Boolean(raw.botEnabled),
    excluded: Boolean(raw.excluded),
    booked: isBooked,
    note: String(raw.note ?? ""),
    isBotTyping: Boolean(raw.isBotTyping),
    intent: String(raw.intent ?? ""),
    readiness: String(raw.readiness ?? "cold"),
    bookingData: normalizedBookingData,
    messages: Array.isArray(raw.messages)
      ? raw.messages.map((message, index) => {
          const msg = (message ?? {}) as Record<string, unknown>;
          return {
            id:
              typeof msg.id === "number"
                ? msg.id
                : index + 1,
            role: msg.role === "contact" ? "contact" : "bot",
            text: String(msg.text ?? ""),
            time: String(msg.time ?? ""),
          };
        })
      : [],
    lastActivityAt:
      typeof raw.lastActivityAt === "number"
        ? raw.lastActivityAt
        : Date.now(),
  };
}

router.get("/leads", (_req, res) => {
  try {
    const leads = getAllLeads();
    return res.json({
      ok: true,
      count: leads.length,
      leads,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Laden der Leads.";
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.get("/leads/:id", (req, res) => {
  try {
    const lead = getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        ok: false,
        error: "Lead nicht gefunden.",
      });
    }

    return res.json({
      ok: true,
      lead,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Laden des Leads.";
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.post("/leads", (req, res) => {
  try {
    const lead = normalizeLeadPayload(req.body);
    const saved = saveLead(lead);

    return res.json({
      ok: true,
      message: "Lead gespeichert.",
      lead: saved,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern des Leads.";
    return res.status(400).json({
      ok: false,
      error: message,
    });
  }
});

router.put("/leads/:id", (req, res) => {
  try {
    const lead = normalizeLeadPayload({
      ...(req.body ?? {}),
      id: req.params.id,
    });
    const saved = saveLead(lead);

    return res.json({
      ok: true,
      message: "Lead aktualisiert.",
      lead: saved,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Aktualisieren des Leads.";
    return res.status(400).json({
      ok: false,
      error: message,
    });
  }
});

router.delete("/leads/:id", (req, res) => {
  try {
    const leadId = req.params.id;
    const existingLead = getLeadById(leadId);
    const deleted = deleteLead(leadId);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Lead nicht gefunden.",
      });
    }

    if (existingLead) {
      if (existingLead.backendLeadId) {
        deleteConversationStatesByBackendLeadId(existingLead.backendLeadId);
      }

      deleteConversationStatesByLeadId(leadId);

      const campaignId = String(existingLead.campaignId).trim();
      const normalizedPhone = String(existingLead.phone || "")
        .replace(/\D+/g, "")
        .trim();
      const normalizedName = String(existingLead.name || "")
        .trim()
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9 ]+/g, "")
        .replace(/\s+/g, " ")
        .trim();

      getAllConversationStates()
        .filter((state) => String(state.campaignId).trim() === campaignId)
        .forEach((state) => {
          const statePhone = String(state.phone || "").replace(/\D+/g, "").trim();
          const stateName = String(state.leadName || "")
            .trim()
            .toLowerCase()
            .replace(/ä/g, "ae")
            .replace(/ö/g, "oe")
            .replace(/ü/g, "ue")
            .replace(/ß/g, "ss")
            .replace(/[^a-z0-9 ]+/g, "")
            .replace(/\s+/g, " ")
            .trim();

          if (
            (normalizedPhone && statePhone === normalizedPhone) ||
            (normalizedName && stateName === normalizedName)
          ) {
            deleteConversationState(state.leadId, state.campaignId);
          }
        });
    }

    return res.json({
      ok: true,
      message: "Lead gelöscht.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen des Leads.";
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.post("/leads/reset", (_req, res) => {
  try {
    const leads = resetLeadsStore();
    return res.json({
      ok: true,
      message: "Leads wurden auf Standard zurückgesetzt.",
      count: leads.length,
      leads,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Reset der Leads.";
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
