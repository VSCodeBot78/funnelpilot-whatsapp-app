import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase4-preview-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = tmp;
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { evaluateCampaignEntryPreview } =
  await import("../services/pete-campaign-entry-preview.service.js");
const { saveCampaign, getAllCampaigns } =
  await import("../data/campaigns.store.js");

const campaigns = [
  { id: "generic", peteCampaign: {
    sources: ["instagram_dm", "whatsapp_dm", "instagram_new_follower"],
    keywords: [], openingText: "Hallo, wie kann ich helfen?", followUpEnabled: false,
  } },
  { id: "check", peteCampaign: {
    sources: ["instagram_dm", "instagram_reel_comment", "instagram_new_follower"],
    keywords: ["CHECK"], openingText: "Hier geht es zum Elterncheck.", followUpEnabled: true,
  } },
  { id: "keto", peteCampaign: {
    sources: ["instagram_story_reply"], keywords: ["KETO"],
    openingText: "Hier findest du den Keto Guide.", followUpEnabled: false,
  } },
];

test("Phase 4: read-only campaign matching stays fail-closed", async t => {
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  await t.test("explicit keyword wins over a general Instagram-DM campaign", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "instagram_dm", messageText: " #check! ",
    });
    assert.equal(result.status, "matched");
    assert.equal(result.matchedCampaignId, "check");
    assert.equal(result.matchedKeyword, "CHECK");
    assert.equal(result.sendAllowed, false);
    assert.equal(result.mode, "preview_only");
    assert.equal(result.followUpDraftConfigured, true);
  });

  await t.test("short keyword must be exact, not part of a sales conversation", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "instagram_reel_comment", messageText: "CHECK das mal",
    });
    assert.equal(result.status, "no_match");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("unconfigured incoming source does not select a campaign", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "whatsapp_ctwa", messageText: "CHECK",
    });
    assert.equal(result.status, "no_match");
  });

  await t.test("generic WhatsApp-DM source can be previewed without sending", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "whatsapp_dm", messageText: "Hallo, ich habe eine Frage",
    });
    assert.equal(result.matchedCampaignId, "generic");
    assert.equal(result.sendAllowed, false);
  });

  await t.test("two equal campaigns lead to ambiguity, not two replies", () => {
    const result = evaluateCampaignEntryPreview([...campaigns, {
      id: "check-duplicate", peteCampaign: {
        sources: ["instagram_dm"], keywords: ["CHECK"], openingText: "Andere",
        followUpEnabled: false,
      },
    }], { source: "instagram_dm", messageText: "CHECK" });
    assert.equal(result.status, "ambiguous");
    assert.equal(result.matchedCampaignId, null);
    assert.deepEqual(result.candidateIds, ["check", "check-duplicate"]);
    assert.equal(result.sendAllowed, false);
  });

  await t.test("new follower can only be greeted manually", () => {
    const result = evaluateCampaignEntryPreview(campaigns, {
      source: "instagram_new_follower", messageText: "CHECK",
    });
    assert.equal(result.status, "manual_only");
    assert.equal(result.matchedCampaignId, null);
    assert.equal(result.sendAllowed, false);
  });

  await t.test("invalid input is rejected and never matched", () => {
    for (const input of [
      { source: "instagram_fake", messageText: "CHECK" },
      { source: "instagram_dm", messageText: { text: "CHECK" } },
      { source: "instagram_dm", messageText: "x".repeat(2001) },
    ]) {
      const result = evaluateCampaignEntryPreview(campaigns, input);
      assert.equal(result.sendAllowed, false);
      assert.equal(result.matchedCampaignId, null);
      assert.ok(result.status.startsWith("invalid"));
    }
  });

  await t.test("saved draft settings are available without enabling runtime sends", () => {
    saveCampaign({
      id: "phase4-preview-campaign",
      peteCampaign: {
        sources: ["instagram_story_reply"],
        keywords: ["KETO"],
        openingText: "Keto Guide.",
        followUpEnabled: false,
      },
    });
    const result = evaluateCampaignEntryPreview(getAllCampaigns(), {
      source: "instagram_story_reply", messageText: "KETO",
    });
    assert.equal(result.matchedCampaignId, "phase4-preview-campaign");
    assert.equal(result.sendAllowed, false);
  });
});
