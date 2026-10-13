import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// UI-only campaign drafts. No Meta or OpenAI network traffic, all sending off.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-mini-campaign-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { saveCampaign, getCampaignById, normalizeCampaignAutomationDraft } =
  await import("../data/campaigns.store.js");

test("Phase 62: mini campaign drafts are persisted safely but never execute", (t) => {
  t.after(() => fs.rmSync(dir, { force: true, recursive: true }));
  const id = "synthetic-comment-check-001";
  const oldQuestions = {
    welcome: "Legacy welcome must be kept for rollback",
    q1: "Legacy Frage 1", q2: "Legacy Frage 2", q3: "Legacy Frage 3",
    goal: "Legacy Zielfrage", scale: "Legacy Skala",
  };
  const saved = saveCampaign({
    id, name: "Eltern Check", trigger: "CHECK",
    ...oldQuestions,
    automationDraft: {
      enabled: true,
      triggers: { comments: true, storyReplies: true, directMessages: true,
        adClicks: false, referrals: false },
      commentScope: "specific",
      specificPostIds: "178400001, 178400002",
      keywords: "CHECK, check, ELTERN",
      publicReplyEnabled: true,
      publicReplies: [
        "Schau mal in deine DMs.", "Hab dir den Check vorbereitet.",
        "Kommt direkt in dein Postfach.",
      ],
      openingMessageEnabled: true,
      openingMessage: "Möchtest du deinen Elterncheck?",
      confirmationLabel: "Schick mir den Check",
      resourceKey: "check",
      linkMessage: "Hier ist dein Check.",
      followupMode: "when_allowed",
      followupDelayHours: 24,
      followupText: "Konntest du dir den Check anschauen?",
    },
  });
  assert.ok(saved.automationDraft);
  const draft = saved.automationDraft;
  assert.equal(draft.enabled, true);
  assert.equal(draft.triggers.comments, true);
  assert.equal(draft.triggers.storyReplies, true);
  assert.equal(draft.triggers.directMessages, true);
  assert.equal(draft.triggers.adClicks, false);
  assert.equal(draft.commentScope, "specific");
  assert.equal(draft.followupMode, "when_allowed");
  assert.equal(draft.followupDelayHours, 24);

  const persisted = getCampaignById(id);
  assert.ok(persisted);
  assert.equal(persisted.automationDraft?.publicReplies.length, 3);
  assert.equal(persisted.automationDraft?.confirmationLabel, "Schick mir den Check");
  assert.equal(persisted.q1, oldQuestions.q1);
  assert.equal(persisted.q3, oldQuestions.q3);
  assert.equal(persisted.goal, oldQuestions.goal);

  const contents = fs.readFileSync(path.join(dir, "campaigns.json"), "utf8");
  assert.match(contents, /synthetic-comment-check-001/);
  assert.match(contents, /"followupMode": "when_allowed"/);

  const defaults = normalizeCampaignAutomationDraft(undefined);
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.followupMode, "off");
  assert.deepEqual(Object.values(defaults.triggers), [false, false, false, false, false]);

  const bad = normalizeCampaignAutomationDraft({
    enabled: "true",
    triggers: { comments: "true", storyReplies: true },
    commentScope: "unknown", resourceKey: "invalid", followupMode: "always_send",
    followupDelayHours: 3000,
    confirmationLabel: "x".repeat(200),
    publicReplies: ["x".repeat(400), { text: "inject" }, null],
  });
  assert.equal(bad.enabled, false);
  assert.equal(bad.triggers.comments, false);
  assert.equal(bad.triggers.storyReplies, true);
  assert.equal(bad.commentScope, "all");
  assert.equal(bad.resourceKey, "check");
  assert.equal(bad.followupMode, "off");
  assert.equal(bad.followupDelayHours, 24);
  assert.equal(bad.confirmationLabel.length, 45);
  assert.equal(bad.publicReplies.length, 1);
  assert.equal(bad.publicReplies[0].length, 220);
});
