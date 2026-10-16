import { Router } from "express";
import { getConversationState, saveConversationState } from "../data/store.js";
import { appendAssistantMessage } from "../core/state-manager.js";
import { evaluateLatestAiOutboundPermission } from "../services/ai-outbound-guard.service.js";
import { sendConversationTextOutbound } from "../services/manual-outbound.service.js";
import { updateLatestAssistantMessageSendResult } from "../services/conversation-outbound.service.js";
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

router.post("/send-due/:campaignId/:leadId", async (req, res) => {
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

    const outboundPermission = evaluateLatestAiOutboundPermission({
      leadId,
      campaignId,
      purpose: "automated_followup",
    });

    if (!outboundPermission.allowed) {
      return res.json({
        ok: true,
        leadId,
        campaignId,
        sent: false,
        dryRun: true,
        sendSkipped: true,
        sendSkipReason: `outbound_guard_${outboundPermission.reason}`,
        messageText,
        evaluation,
        providerBookingState: state.providerBooking,
      });
    }

    // Capture the latest state before awaiting Meta. A human may take over
    // or the lead may decline follow-ups before the HTTP request completes.
    const beforeSend = {
      updatedAt: state.updatedAt,
      owner: state.owner,
      aiPaused: state.aiPaused,
      latestMessageId: state.messages.at(-1)?.id,
    };
    const outbound = await sendConversationTextOutbound({
      state,
      messageText,
      followUpStageKey: "provider_booking:" + evaluation.stage,
    });

    if (!outbound.ok || !outbound.sent) {
      return res.json({
        ok: true,
        leadId,
        campaignId,
        sent: false,
        dryRun: outbound.dryRun,
        sendSkipped: outbound.sendSkipped,
        sendSkipReason: outbound.reason,
        sendError: outbound.error,
        outboundTransport: outbound.transport,
        messageText,
        evaluation,
        providerBookingState: state.providerBooking,
      });
    }

    // Reconcile the successful send with the authoritative conversation, not
    // the possibly obsolete snapshot created before network I/O.
    const current = getConversationState(leadId, campaignId);
    if (!current) {
      return res.json({
        ok: true, leadId, campaignId, sent: true, dryRun: false,
        sendSkipped: false, receiptRecorded: false,
        outboundTransport: outbound.transport,
        metaMessageId: outbound.metaMessageId ?? undefined,
      });
    }
    const changedDuringSend =
      current.updatedAt !== beforeSend.updatedAt ||
      current.owner !== beforeSend.owner ||
      current.aiPaused !== beforeSend.aiPaused ||
      current.messages.at(-1)?.id !== beforeSend.latestMessageId;
    const earlierActor = current.lastActor;
    const earlierUpdatedAt = current.updatedAt;
    // A message may already have been sent despite a concurrent takeover.
    appendAssistantMessage(current, messageText);
    updateLatestAssistantMessageSendResult({
      messages: current.messages,
      replyText: messageText,
      transport: outbound.transport,
      outboundStatus: "sent",
      sentAt: new Date().toISOString(),
      metaMessageId: outbound.metaMessageId ?? null,
    });
    if (changedDuringSend) {
      // Do not reactivate a booking flow that was manually stopped or canceled.
      current.lastActor = earlierActor;
      current.updatedAt = earlierUpdatedAt;
      if (current.providerBooking &&
          !current.providerBooking.sentHistory.some((entry) => entry.stage === evaluation.stage)) {
        current.providerBooking = {
          ...current.providerBooking,
          sentHistory: [
            ...current.providerBooking.sentHistory,
            { stage: evaluation.stage, sentAt: now.toISOString() },
          ],
        };
      }
    } else if (current.providerBooking) {
      current.providerBooking = markProviderFollowUpAsSent(
        current.providerBooking, evaluation.stage, now.toISOString(),
      );
    }
    saveConversationState(current);

    return res.json({
      ok: true,
      leadId,
      campaignId,
      sent: true,
      dryRun: false,
      sendSkipped: false,
      outboundTransport: outbound.transport,
      metaMessageId: outbound.metaMessageId ?? undefined,
      sentStage: evaluation.stage,
      sentAt: now.toISOString(),
      messageText,
      providerBookingState: current.providerBooking,
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
