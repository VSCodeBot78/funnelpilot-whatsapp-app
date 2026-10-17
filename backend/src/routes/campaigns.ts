import { Router } from "express";
import { evaluateCampaignEntryPreview } from "../services/pete-campaign-entry-preview.service.js";
import {
  deleteCampaign,
  getAllCampaigns,
  getCampaignById,
  resetCampaigns,
  saveCampaign,
  type CampaignRecord,
} from "../data/campaigns.store.js";

const router = Router();

function normalizeCampaignPayload(input: unknown): CampaignRecord {
  const raw = (input ?? {}) as Record<string, unknown>;
  const id = String(raw.id ?? "").trim();

  if (!id) {
    throw new Error("Campaign braucht eine id.");
  }

  return {
    ...raw,
    id,
  } as CampaignRecord;
}

router.get("/", (_req, res) => {
  try {
    const campaigns = getAllCampaigns();
    return res.json({ ok: true, campaigns });
  } catch (error) {
    console.error("campaigns route error:", error);
    return res.status(500).json({ ok: false, error: "campaigns_load_failed" });
  }
});

// Owner-only control-plane preview, guarded by the existing app admin guard.
// Never starts a lead conversation or invokes a provider; sendAllowed is
// permanently false and no scheduling or campaign changes are made.
router.post("/preview-entry", (req, res) => {
  try {
    const input = req.body && typeof req.body === "object" ? req.body : {};
    const result = evaluateCampaignEntryPreview(getAllCampaigns(), {
      source: input.source,
      messageText: input.messageText,
    });
    if (result.status === "invalid_source" || result.status === "invalid_message") {
      return res.status(400).json({ ok: false, preview: result });
    }
    return res.json({ ok: true, preview: result });
  } catch (error) {
    console.error("campaign entry preview error:", error);
    return res.status(500).json({ ok: false, error: "campaign_preview_failed" });
  }
});

router.post("/", (req, res) => {
  try {
    const campaign = normalizeCampaignPayload(req.body);
    const savedCampaign = saveCampaign(campaign);
    return res.json({ ok: true, campaign: savedCampaign });
  } catch (error) {
    console.error("campaigns create error:", error);
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "campaign_create_failed" });
  }
});

router.put("/:id", (req, res) => {
  try {
    const campaignId = String(req.params.id || "").trim();
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "invalid_campaign_id" });
    }

    const existing = getCampaignById(campaignId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "campaign_not_found" });
    }

    const campaign = normalizeCampaignPayload({ ...req.body, id: campaignId });
    const savedCampaign = saveCampaign(campaign);
    return res.json({ ok: true, campaign: savedCampaign });
  } catch (error) {
    console.error("campaigns update error:", error);
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "campaign_update_failed" });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const campaignId = String(req.params.id || "").trim();
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "invalid_campaign_id" });
    }

    const deleted = deleteCampaign(campaignId);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "campaign_not_found" });
    }

    return res.json({ ok: true, campaignId });
  } catch (error) {
    console.error("campaigns delete error:", error);
    return res.status(500).json({ ok: false, error: "campaign_delete_failed" });
  }
});

router.post("/reset", (_req, res) => {
  try {
    const campaigns = resetCampaigns();
    return res.json({ ok: true, campaigns });
  } catch (error) {
    console.error("campaigns reset error:", error);
    return res.status(500).json({ ok: false, error: "campaigns_reset_failed" });
  }
});

export default router;
