import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_TRIGGERS,
  getDefaultAutomationDraft,
  getNormalizedAutomationDraft,
  parseAutomationKeywords,
} from "./campaignAutomation.js";

test("mini campaign draft: safe initial state and independent switches", () => {
  const draft = getDefaultAutomationDraft();
  assert.equal(draft.enabled, false);
  assert.equal(draft.followupMode, "off");
  assert.ok(AUTOMATION_TRIGGERS.length >= 5);
  draft.triggers.comments = true;
  draft.triggers.directMessages = true;
  const second = getDefaultAutomationDraft();
  assert.equal(second.triggers.comments, false, "new campaigns cannot inherit enabled triggers");
  const normalized = getNormalizedAutomationDraft({ automationDraft: draft });
  assert.equal(normalized.triggers.comments, true);
  assert.equal(normalized.triggers.directMessages, true);
  assert.equal(normalized.triggers.storyReplies, false);
  assert.equal(normalized.resourceKey, "check");
});

test("keyword parser is case-insensitive, trims and de-duplicates", () => {
  assert.deepEqual(parseAutomationKeywords("Check, KETO, check, BULLSHIT"), [
    "CHECK", "KETO", "BULLSHIT",
  ]);
  assert.deepEqual(parseAutomationKeywords(" ,  ,"), []);
});

test("invalid stored mini-campaign fields cannot enable followups", () => {
  const normalized = getNormalizedAutomationDraft({ automationDraft: {
    enabled: "yes",
    triggers: { comments: "yes", directMessages: true },
    publicReplies: [...Array(10)].map((_, index) => "a".repeat(260) + index),
    resourceKey: "https://evil.example",
    followupMode: "always",
    followupDelayHours: 300,
    openingMessage: "m".repeat(1100),
  } });
  assert.equal(normalized.enabled, false);
  assert.equal(normalized.triggers.comments, false);
  assert.equal(normalized.triggers.directMessages, true);
  assert.equal(normalized.followupMode, "off");
  assert.equal(normalized.followupDelayHours, 24);
  assert.equal(normalized.resourceKey, "check");
  assert.equal(normalized.publicReplies.length, 6);
  assert.equal(normalized.publicReplies[0].length, 220);
  assert.equal(normalized.openingMessage.length, 800);
});

test("explicitly enabled campaign remains data only until separate Meta approval", () => {
  const draft = getNormalizedAutomationDraft({ automationDraft: {
    enabled: true,
    triggers: { comments: true, storyReplies: true },
    keywords: "CHECK, KETO",
    publicReplyEnabled: true,
    followupMode: "when_allowed",
    followupDelayHours: 24,
  } });
  assert.equal(draft.enabled, true);
  assert.equal(draft.followupMode, "when_allowed");
  assert.equal(draft.triggers.storyReplies, true);
  assert.equal(typeof draft.send, "undefined", "draft has no executable send action");
  assert.equal(typeof draft.execute, "undefined");
});
