import { Router } from "express";
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
