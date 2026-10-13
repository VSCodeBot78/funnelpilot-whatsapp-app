import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Persist draft UI config safely, without calling providers or any outbound API.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-campaign-drafts-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const {
  normalizeCampaignAutomationDraft,
  saveCampaign,
  getCampaignById,
  getAllCampaigns,
  deleteCampaign,
} = await import("../data/campaigns.store.js");

test("Phase 62: editable ManyChat-like mini-campaigns remain safe drafts", async t => {
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await t.test("new campaign has safe defaults", () => {
    const clean = normalizeCampaignAutomationDraft(undefined);
    assert.equal(clean.enabled, false);
    assert.equal(clean.followupMode, "off");
    assert.equal(clean.triggers.comments, false);
    assert.equal(clean.triggers.directMessages, false);
    assert.equal(clean.publicReplies.length, 3);
  });
  await t.test("multiple switches, six public replies, comments and opt-in follow-up persist", () => {
    const record = saveCampaign({
      id: "mini-check-phase62",
      name: "CHECK Reel and DMs",
      automationDraft: {
        enabled: true,
        triggers: { comments: true, directMessages: true, storyReplies: true },
        commentScope: "specific",
        specificPostIds: "post_1,post_2",
        keywords: "CHECK, ELTERNCHECK",
        publicReplyEnabled: true,
        publicReplies: ["Ist unterwegs.", "Schau in deine DMs.", "Hier kommt dein Check.", "Gern!", "Der Check kommt.", "Schau mal ins Postfach."],
        openingMessageEnabled: true,
        openingMessage: "Soll ich dir den Check schicken?",
        confirmationLabel: "Schick mir den Check",
        resourceKey: "check",
        linkMessage: "Hier kommt dein Check.",
        followupMode: "when_allowed",
        followupDelayHours: 24,
        followupText: "Konntest du den Check anschauen?",
      },
    });
    assert.ok(record.automationDraft);
    const draft = record.automationDraft;
    assert.equal(draft.enabled, true, "stored enabled is just draft, not a send switch");
    assert.equal(draft.triggers.comments, true);
    assert.equal(draft.triggers.directMessages, true);
    assert.equal(draft.triggers.storyReplies, true);
    assert.equal(draft.triggers.adClicks, false);
    assert.equal(draft.publicReplies.length, 6);
    assert.equal(draft.followupMode, "when_allowed");
    assert.equal(draft.resourceKey, "check");
    assert.equal(getCampaignById(record.id)?.automationDraft?.confirmationLabel, "Schick mir den Check");
    assert.ok(getAllCampaigns().some(row => row.id === record.id));
    deleteCampaign(record.id);
  });
  await t.test("malformed arrays, invalid modes and long strings are constrained", () => {
    const bad = normalizeCampaignAutomationDraft({
      enabled: true,
      triggers: { comments: "yes", directMessages: 1, adClicks: true },
      commentScope: "hijack",
      publicReplies: [...Array.from({ length: 12 }, () => "x".repeat(400)), 17],
      resourceKey: "unverified-url",
      confirmationLabel: "X".repeat(1000),
      followupMode: "always-even-after-stop",
      followupDelayHours: 999,
      followupText: "t".repeat(1200),
    });
    assert.equal(bad.triggers.comments, false);
    assert.equal(bad.triggers.directMessages, false);
    assert.equal(bad.triggers.adClicks, true);
    assert.equal(bad.commentScope, "all");
    assert.equal(bad.resourceKey, "check");
    assert.equal(bad.publicReplies.length, 6);
    assert.equal(bad.publicReplies[0].length, 220);
    assert.equal(bad.confirmationLabel.length, 45);
    assert.equal(bad.followupMode, "off");
    assert.equal(bad.followupDelayHours, 24);
    assert.equal(bad.followupText.length, 500);
  });
});
