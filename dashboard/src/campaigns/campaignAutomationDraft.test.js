import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_TRIGGER_OPTIONS,
  getDefaultCampaignAutomation,
  getNormalizedCampaignAutomation,
} from "./campaignAutomationDraft.js";

test("campaign draft editor uses six independent trigger switches", () => {
  const defaults = getDefaultCampaignAutomation();
  assert.equal(AUTOMATION_TRIGGER_OPTIONS.length, 6);
  assert.equal(Object.values(defaults.triggers).filter(Boolean).length, 0);
  const combined = getNormalizedCampaignAutomation({
    ...defaults,
    enabled: true,
    triggers: { post_reel_comment: true, instagram_message: true, instagram_ad: true },
    keywords: ["check", "keto"],
  });
  assert.equal(combined.enabled, true);
  assert.equal(combined.triggers.post_reel_comment, true);
  assert.equal(combined.triggers.instagram_message, true);
  assert.equal(combined.triggers.instagram_ad, true);
  assert.equal(combined.triggers.story_reply, false);
  assert.deepEqual(combined.keywords, ["CHECK", "KETO"]);
});

test("campaign draft has explicit disabled followup default and keeps comment variant edits", () => {
  const base = getNormalizedCampaignAutomation(undefined);
  assert.equal(base.followUpMode, "off");
  assert.equal(base.resourceLinkSlot, "");
  const withVariants = getNormalizedCampaignAutomation({
    ...base,
    publicCommentReplies: ["Erste Antwort", "", "Dritte Antwort"],
    followUpMode: "conditional",
    resourceLinkSlot: "infoLink4",
  });
  assert.deepEqual(withVariants.publicCommentReplies, ["Erste Antwort", "", "Dritte Antwort"]);
  assert.equal(withVariants.followUpMode, "conditional");
  assert.equal(withVariants.followUpAfterHours, 24);
  assert.equal(withVariants.resourceLinkSlot, "infoLink4");
});

test("editor cannot promote invalid external checkout URL to a trusted link slot", () => {
  const normalized = getNormalizedCampaignAutomation({ enabled: "true",
    resourceLinkSlot: "https://unknown.example/link" });
  assert.equal(normalized.enabled, false);
  assert.equal(normalized.resourceLinkSlot, "");
});
