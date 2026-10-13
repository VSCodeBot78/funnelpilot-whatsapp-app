import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-campaign-draft-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
const { normalizeCampaignAutomationDraft, getAllCampaigns, saveCampaign, getCampaignById } =
  await import("../data/campaigns.store.js");

test("Mini-campaign draft is validated, persisted and never executed", async t => {
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  await t.test("multiple trigger flags and six short replies are supported", () => {
    const candidate = normalizeCampaignAutomationDraft({
      enabled: true, triggers: { comments: true, storyReplies: true, directMessages: true },
      commentScope: "specific", specificPostIds: "reel-1234",
      keywords: "CHECK, KETO, BULLSHIT",
      publicReplies: ["Eins", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben"],
      resourceKey: "check", followupMode: "when_allowed", followupDelayHours: 27,
    });
    assert.equal(candidate.enabled, true);
    assert.equal(candidate.triggers.comments, true);
    assert.equal(candidate.triggers.storyReplies, true);
    assert.equal(candidate.triggers.directMessages, true);
    assert.equal(candidate.triggers.adClicks, false);
    assert.equal(candidate.commentScope, "specific");
    assert.equal(candidate.publicReplies.length, 6);
    assert.equal(candidate.followupDelayHours, 24);
  });

  await t.test("unknown types, wrong options and long input fail to safe draft", () => {
    const invalid = normalizeCampaignAutomationDraft({
      enabled: "yes", triggers: { comments: "true", referrals: 1 },
      resourceKey: "unknown", followupMode: "send_everywhere",
      publicReplies: ["ok", 999, null], keywords: "k".repeat(350),
    });
    assert.equal(invalid.enabled, false);
    assert.equal(invalid.triggers.comments, false);
    assert.equal(invalid.triggers.referrals, false);
    assert.equal(invalid.resourceKey, "check");
    assert.equal(invalid.followupMode, "off");
    assert.deepEqual(invalid.publicReplies, ["ok"]);
    assert.ok(invalid.keywords.length <= 300);
    assert.equal(normalizeCampaignAutomationDraft(undefined).enabled, false);
  });

  await t.test("saved campaign preserves new draft and old content without dispatch", () => {
    const id = "test-pete-automations-only";
    const prepared = {
      id, name: "Test CHECK", trigger: "CHECK",
      q1: "Historische Frage wird nur im Legacy-Editor sichtbar",
      automationDraft: {
        enabled: true, triggers: { comments: true, directMessages: true },
        keywords: "CHECK", followupMode: "when_allowed",
      },
    };
    const saved = saveCampaign(prepared);
    assert.equal(saved.id, id);
    const restored = getCampaignById(id);
    assert.ok(restored);
    assert.equal(restored?.q1, prepared.q1);
    assert.equal(restored?.automationDraft?.enabled, true);
    assert.equal(restored?.automationDraft?.triggers.comments, true);
    assert.equal(restored?.automationDraft?.triggers.directMessages, true);
    assert.equal(restored?.automationDraft?.followupMode, "when_allowed");
    assert.equal(getAllCampaigns().filter(c => c.id === id).length, 1);
    assert.equal(process.env.INSTAGRAM_SEND_ENABLED, "false");
    assert.equal(process.env.WHATSAPP_SEND_ENABLED, "false");
  });
});
