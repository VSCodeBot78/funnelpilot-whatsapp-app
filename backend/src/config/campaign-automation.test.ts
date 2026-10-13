import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-campaign-draft-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";

const { normalizeCampaignAutomation, DEFAULT_CAMPAIGN_AUTOMATION } =
  await import("./campaign-automation.js");
const { saveCampaign, getCampaignById } = await import("../data/campaigns.store.js");

test("Step 4A: mini-automation is a saved draft, never a message send", async t => {
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  await t.test("new campaign defaults have every automation trigger disabled", () => {
    const out = normalizeCampaignAutomation(undefined);
    assert.equal(out.enabled, false);
    assert.equal(out.followUpMode, "off");
    assert.equal(Object.values(out.triggers).filter(Boolean).length, 0);
    assert.equal(out.resourceLinkSlot, "");
    assert.deepEqual(out.publicCommentReplies, DEFAULT_CAMPAIGN_AUTOMATION.publicCommentReplies);
  });

  await t.test("multi-select persists and normalizes keywords, replies and source link slot", () => {
    const record = saveCampaign({
      id: "qa-phase4a-check",
      name: "Reel CHECK",
      automationConfig: {
        ...DEFAULT_CAMPAIGN_AUTOMATION,
        enabled: true,
        triggers: { ...DEFAULT_CAMPAIGN_AUTOMATION.triggers,
          post_reel_comment: true, instagram_message: true, story_reply: false },
        commentScope: "next",
        keywordMode: "specific",
        keywords: ["check", " Bullshit ", "KETO"],
        publicCommentReplyEnabled: true,
        publicCommentReplies: [
          "Schau mal in deine Nachrichten.",
          "Kommt per DM.",
          "Ich habe dir geschrieben.",
          "Hier kommt deine Nachricht.",
          "Link ist unterwegs.",
          "Schau ins Postfach.",
          "Darf nie ein siebter werden",
        ],
        openingDmText: "Soll ich dir den Check schicken?",
        confirmationButtonText: "Schick mir den Check",
        resourceLinkSlot: "infoLink3",
        linkDmText: "Hier kommt dein Check.",
        followUpMode: "conditional",
        followUpAfterHours: 3,
        followUpDmText: "Hast du den Check angesehen?",
      },
    });
    assert.equal(record.automationConfig?.enabled, true);
    const loaded = getCampaignById("qa-phase4a-check");
    const automation = loaded?.automationConfig;
    assert.equal(automation?.triggers.post_reel_comment, true);
    assert.equal(automation?.triggers.instagram_message, true);
    assert.equal(automation?.triggers.story_reply, false);
    assert.equal(automation?.commentScope, "next");
    assert.deepEqual(automation?.keywords, ["CHECK", "BULLSHIT", "KETO"]);
    assert.equal(automation?.publicCommentReplies.length, 6);
    assert.equal(automation?.resourceLinkSlot, "infoLink3");
    assert.equal(automation?.followUpMode, "conditional");
    assert.equal(automation?.followUpAfterHours, 24);
  });

  await t.test("invalid option values and untrusted arbitrary URLs are not enabled as link slots", () => {
    const invalid = normalizeCampaignAutomation({
      enabled: "yes", triggers: { post_reel_comment: "true" },
      resourceLinkSlot: "https://unverified.example/pay",
      commentScope: "everywhere", followUpMode: "unconditional",
      publicCommentReplies: ["", "  Ein echter Satz.  "],
      keywords: ["KETO"],
    });
    assert.equal(invalid.enabled, false);
    assert.equal(invalid.triggers.post_reel_comment, false);
    assert.equal(invalid.resourceLinkSlot, "");
    assert.equal(invalid.commentScope, "any");
    assert.equal(invalid.followUpMode, "off");
    assert.deepEqual(invalid.publicCommentReplies, ["Ein echter Satz."]);
  });
});
