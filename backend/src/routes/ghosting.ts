import { Router } from "express";
import { getConversationState, saveConversationState } from "../data/store.js";
import { appendAssistantMessage } from "../core/state-manager.js";
import { evaluateLatestAiOutboundPermission } from "../services/ai-outbound-guard.service.js";
import { sendConversationTextOutbound } from "../services/manual-outbound.service.js";
import { updateLatestAssistantMessageSendResult } from "../services/conversation-outbound.service.js";
import {
  applyGhostingEvaluationToState,
  evaluateGhostingState,
  getGhostingMessageText,
  getGhostingSchedules,
  markGhostingStageAsSent,
} from "../services/ghosting.service.js";

const router = Router();

router.get("/schedule", (_req, res) => {
  return res.json({
    ok: true,
    schedules: getGhostingSchedules(),
  });
});

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

    if (!campaignId || !leadId) {
      return res.status(400).json({
        ok: false,
        error: "campaignId und leadId sind erforderlich.",
      });
    }

    const state = getConversationState(leadId, campaignId);

    if (!state) {
      return res.status(404).json({
        ok: false,
        error: "Kein Conversation State gefunden.",
      });
    }

    const evaluation = evaluateGhostingState(state, state.ghosting, now);

    return res.json({
      ok: true,
      leadId,
      campaignId,
      now: now.toISOString(),
      lastAssistantMessageAt: state.lastAssistantMessageAt ?? null,
      lastUserMessageAt: state.lastUserMessageAt ?? null,
      ghostingState: state.ghosting,
      evaluation,
      messagePreview: evaluation.dueNow ? getGhostingMessageText(evaluation.stage) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler im Ghosting Preview.";

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

    const evaluation = evaluateGhostingState(state, state.ghosting, now);

    if (!evaluation.dueNow) {
      return res.status(400).json({
        ok: false,
        error: "Aktuell ist keine Ghosting-Nachricht fällig.",
        evaluation,
      });
    }

    state.ghosting = markGhostingStageAsSent(
      applyGhostingEvaluationToState(state.ghosting, evaluation),
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
      ghostingState: state.ghosting,
      messageText: getGhostingMessageText(evaluation.stage),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Markieren als gesendet.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.post("/send-due/:campaignId/:leadId", async (req, res) => {
  try {
    const { campaignId, leadId } = req.params;
    const sendAt = typeof req.body?.sendAt === "string" ? req.body.sendAt : undefined;
    const now = sendAt ? new Date(sendAt) : new Date();

    if (Number.isNaN(now.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "Ungültiges sendAt.",
      });
    }

    const state = getConversationState(leadId, campaignId);

    if (!state) {
      return res.status(404).json({
        ok: false,
        error: "Kein Conversation State gefunden.",
      });
    }

    const evaluation = evaluateGhostingState(state, state.ghosting, now);

    if (!evaluation.dueNow) {
      return res.status(400).json({
        ok: false,
        error: "Aktuell ist keine Ghosting-Nachricht fällig.",
        evaluation,
      });
    }

    const messageText = getGhostingMessageText(evaluation.stage);

    if (!messageText) {
      return res.status(400).json({
        ok: false,
        error: "Für diese Ghosting-Stufe ist kein Nachrichtentext hinterlegt.",
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
        ghostingState: state.ghosting,
      });
    }

    // Another owner, opt-out or incoming message may arrive during Meta I/O.
    const beforeSend = {
      updatedAt: state.updatedAt,
      owner: state.owner,
      aiPaused: state.aiPaused,
      latestMessageId: state.messages.at(-1)?.id,
    };
    const outbound = await sendConversationTextOutbound({
      state,
      messageText,
      idempotencyKey: `ghosting:${evaluation.cycle}:${evaluation.stage}`,
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
        ghostingState: state.ghosting,
      });
    }

    // Never save the pre-await state over a newer human takeover or lead STOP.
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
    if (!changedDuringSend) {
      current.ghosting = applyGhostingEvaluationToState(
        current.ghosting, evaluation,
      );
    }
    // The outbound call already succeeded; persist the receipt on CURRENT state.
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
      // Preserve later lead/human activity and any manual Ghosting pause.
      current.lastActor = earlierActor;
      current.updatedAt = earlierUpdatedAt;
      const sentHistory = current.ghosting.sentHistory ?? [];
      if (!sentHistory.some((entry) => entry.stage === evaluation.stage)) {
        current.ghosting = {
          ...current.ghosting,
          sentHistory: [...sentHistory, { stage: evaluation.stage, sentAt: now.toISOString() }],
        };
      }
    } else {
      current.ghosting = markGhostingStageAsSent(
        { ...current.ghosting, cycle: evaluation.cycle },
        evaluation.stage,
        now.toISOString(),
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
      ghostingState: current.ghosting,
      lastAssistantMessageAt: current.lastAssistantMessageAt ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Ghosting-Senden.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
