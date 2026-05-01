import { Router } from "express";
import { getConversationState, saveConversationState } from "../data/store.js";
import { appendAssistantMessage } from "../core/state-manager.js";
import {
  evaluateProviderBookingFollowUp,
  getProviderFollowUpMessage,
  markProviderFollowUpAsSent,
} from "../services/provider-booking.service.js";

const router = Router();

router.get("/preview/:campaignId/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;
    const nowParam = typeof req.query.now === "string" ? req.query.now : undefined;
    const now = nowParam ? new Date(nowParam) : new Date();

    if (Number.isNaN(now.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "Ungültiger now-Parameter.",
      });
    }

    const state = getConversationState(leadId, campaignId);

    if (!state) {
      return res.status(404).json({
        ok: false,
        error: "Kein Conversation State gefunden.",
      });
    }

    const evaluation = evaluateProviderBookingFollowUp(state, now);

    return res.json({
      ok: true,
      leadId,
      campaignId,
      now: now.toISOString(),
      providerBookingState: state.providerBooking,
      evaluation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler im Provider-Booking-Preview.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.post("/mark-sent/:campaignId/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;
    const sentAt = typeof req.body?.sentAt === "string" ? req.body.sentAt : undefined;
    const now = sentAt ? new Date(sentAt) : new Date();

    if (Number.isNaN(now.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "Ungültiges sentAt.",
      });
    }

    const state = getConversationState(leadId, campaignId);

    if (!state) {
      return res.status(404).json({
        ok: false,
        error: "Kein Conversation State gefunden.",
      });
    }

    const evaluation = evaluateProviderBookingFollowUp(state, now);

    if (!evaluation.dueNow || evaluation.stage === "inactive") {
      return res.status(400).json({
        ok: false,
        error: "Aktuell ist kein Provider-Booking-Follow-up fällig.",
        evaluation,
      });
    }

    state.providerBooking = markProviderFollowUpAsSent(
      state.providerBooking,
      evaluation.stage,
      now.toISOString(),
    );

    saveConversationState(state);

    return res.json({
      ok: true,
      leadId,
      campaignId,
      markedStage: evaluation.stage,
      sentAt: now.toISOString(),
      providerBookingState: state.providerBooking,
      messageText: getProviderFollowUpMessage(evaluation.stage),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Provider-Booking mark-sent.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.post("/send-due/:campaignId/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;
    const sentAt = typeof req.body?.sentAt === "string" ? req.body.sentAt : undefined;
    const now = sentAt ? new Date(sentAt) : new Date();

    if (Number.isNaN(now.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "Ungültiges sentAt.",
      });
    }

    const state = getConversationState(leadId, campaignId);

    if (!state) {
      return res.status(404).json({
        ok: false,
        error: "Kein Conversation State gefunden.",
      });
    }

    const evaluation = evaluateProviderBookingFollowUp(state, now);

    if (!evaluation.dueNow || evaluation.stage === "inactive") {
      return res.status(400).json({
        ok: false,
        error: "Aktuell ist kein Provider-Booking-Follow-up fällig.",
        evaluation,
      });
    }

    const messageText = getProviderFollowUpMessage(evaluation.stage);

    if (!messageText) {
      return res.status(400).json({
        ok: false,
        error: "Für diese Provider-Booking-Stufe ist kein Nachrichtentext hinterlegt.",
        evaluation,
      });
    }

    appendAssistantMessage(state, messageText);

    state.providerBooking = markProviderFollowUpAsSent(
      state.providerBooking,
      evaluation.stage,
      now.toISOString(),
    );

    saveConversationState(state);

    return res.json({
      ok: true,
      leadId,
      campaignId,
      sentStage: evaluation.stage,
      sentAt: now.toISOString(),
      messageText,
      providerBookingState: state.providerBooking,
      evaluation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Provider-Booking send-due.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
