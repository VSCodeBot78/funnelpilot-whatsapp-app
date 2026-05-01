import { Router } from "express";
import { getConversationState, saveConversationState } from "../data/store.js";
import { appendAssistantMessage } from "../core/state-manager.js";
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

router.post("/send-due/:campaignId/:leadId", (req, res) => {
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

    state.ghosting = applyGhostingEvaluationToState(state.ghosting, evaluation);
    appendAssistantMessage(state, messageText);
    state.ghosting = markGhostingStageAsSent(
      {
        ...state.ghosting,
        cycle: evaluation.cycle,
      },
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
      ghostingState: state.ghosting,
      lastAssistantMessageAt: state.lastAssistantMessageAt ?? null,
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
