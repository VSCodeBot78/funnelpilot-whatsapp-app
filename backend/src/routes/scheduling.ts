import { Router } from "express";
import { buildSchedulingPreviewByLead } from "../services/scheduling-request.service.js";

const router = Router();

router.get("/preview/:campaignId/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;

    if (!campaignId || !leadId) {
      return res.status(400).json({
        ok: false,
        ready: false,
        error: "campaignId und leadId sind erforderlich.",
      });
    }

    const result = buildSchedulingPreviewByLead(leadId, campaignId);

    if (!result.ok) {
      return res.status(404).json(result);
    }

    return res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler im Scheduling Preview.";

    return res.status(500).json({
      ok: false,
      ready: false,
      error: message,
    });
  }
});

export default router;
