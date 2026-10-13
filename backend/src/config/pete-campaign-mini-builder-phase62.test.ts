import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-campaign-draft-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { saveCampaign, getCampaignById, normalizeCampaignAutomationDraft } =
  await import("../data/campaigns.store.js");

test("Phase 62: campaign builder draft saves multiple triggers but cannot send", t => {
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const defaults = normalizeCampaignAutomationDraft(null);
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.followupMode, "off");
  assert.equal(defaults.triggers.comments, false);
  const bad = normalizeCampaignAutomationDraft({
    enabled: "true",
    triggers: { comments: "true", adClicks: true },
    followupMode: "send_now",
    followupDelayHours: 240,
    publicReplies: Array(12).fill("x".repeat(310)),
    resourceKey: "https://wrong.invalid",
  });
  assert.equal(bad.enabled, false);
  assert.equal(bad.triggers.comments, false);
  assert.equal(bad.triggers.adClicks, true);
  assert.equal(bad.followupMode, "off");
  assert.equal(bad.followupDelayHours, 24);
  assert.equal(bad.publicReplies.length, 6);
  assert.equal(bad.publicReplies[0].length, 220);
  assert.equal(bad.resourceKey, "check");

  const campaign = saveCampaign({
    id: "phase62-draft-only",
    name: "CHECK Reel",
    automationDraft: {
      ...defaults,
      enabled: true,
      triggers: { ...defaults.triggers, comments: true, storyReplies: true, adClicks: true },
      keywords: "CHECK, KETO",
      followupMode: "when_allowed",
    },
    q1: "ALTE FRAGE BLEIBT NUR ARCHIV",
  });
  assert.equal(campaign.automationDraft?.enabled, true);
  assert.equal(campaign.automationDraft?.triggers.comments, true);
  assert.equal(campaign.automationDraft?.triggers.storyReplies, true);
  assert.equal(campaign.automationDraft?.triggers.adClicks, true);
  assert.equal(campaign.automationDraft?.followupMode, "when_allowed");
  assert.equal(campaign.q1, "ALTE FRAGE BLEIBT NUR ARCHIV");
  const loaded = getCampaignById("phase62-draft-only");
  assert.deepEqual(loaded?.automationDraft, campaign.automationDraft);
  assert.equal(loaded?.automationDraft?.enabled, true);
  assert.equal(typeof (loaded as Record<string, unknown>)?.send, "undefined");
});
