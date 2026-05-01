import { Router } from "express";
import { processIncomingMessage } from "../core/conversation-engine.js";
import { getConversationState } from "../data/store.js";

const router = Router();

router.post("/message", async (req, res) => {
  try {
    const { leadId, campaignId, messageText } = req.body ?? {};

    if (!leadId || !campaignId || !messageText) {
      return res.status(400).json({
        ok: false,
        error: "leadId, campaignId und messageText sind erforderlich.",
      });
    }

    const result = await processIncomingMessage({
      leadId,
      campaignId,
      messageText,
    });

    return res.json({
      ok: true,
      reply: result.text,
      nextStep: result.nextStep,
      detectedIntent: result.detectedIntent,
      state: result.state,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler im Test-Chat.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

router.get("/state/:campaignId/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;

    if (!leadId || !campaignId) {
      return res.status(400).json({
        ok: false,
        error: "leadId und campaignId sind erforderlich.",
      });
    }

    const state = getConversationState(leadId, campaignId);

    if (!state) {
      return res.status(404).json({
        ok: false,
        error: "Kein Conversation State gefunden.",
      });
    }

    return res.json({
      ok: true,
      leadId,
      campaignId,
      state,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Laden des Test-States.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
